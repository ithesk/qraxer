const STORAGE_KEY = 'qraxer_scan_history';
const MAX_SCANS = 5;

export const scanHistory = {
  /**
   * Get all stored scans
   * @returns {Array} Array of scan records
   */
  getScans() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      console.log('[scanHistory] getScans raw data:', data);
      const parsed = data ? JSON.parse(data) : [];
      console.log('[scanHistory] getScans parsed:', parsed);
      return parsed;
    } catch (e) {
      console.error('[scanHistory] Error reading scan history:', e);
      return [];
    }
  },

  /**
   * Add a new scan to history
   * @param {Object} scan - The scan record to add
   * @param {number} scan.repairId - Repair ID
   * @param {string} scan.repairName - Repair name/description
   * @param {string} scan.oldState - Previous state
   * @param {string} scan.newState - New state
   * @param {string} scan.timestamp - ISO timestamp
   */
  addScan(scan) {
    try {
      console.log('[scanHistory] addScan called with:', scan);
      const scans = this.getScans();

      const newScan = {
        repairId: scan.repairId,
        repairName: scan.repairName || `Reparación #${scan.repairId}`,
        oldState: scan.oldState,
        newState: scan.newState,
        timestamp: scan.timestamp || new Date().toISOString(),
      };

      console.log('[scanHistory] newScan object:', newScan);

      // Add to beginning and keep only last MAX_SCANS
      const updatedScans = [newScan, ...scans].slice(0, MAX_SCANS);

      console.log('[scanHistory] updatedScans:', updatedScans);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedScans));
      console.log('[scanHistory] Saved to localStorage');
      return updatedScans;
    } catch (e) {
      console.error('[scanHistory] Error saving scan history:', e);
      return this.getScans();
    }
  },

  /**
   * Clear all scan history
   */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Format timestamp for display
   * @param {string} isoString - ISO timestamp
   * @returns {string} Formatted time string
   */
  formatTime(isoString) {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours}h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;

      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      });
    } catch (e) {
      return '';
    }
  }
};
