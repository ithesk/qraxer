import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

// Check icon
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Popular device models for autocomplete
const DEVICE_MODELS = [
  // Apple iPhone
  { model: 'iPhone 16 Pro Max', brand: 'Apple' },
  { model: 'iPhone 16 Pro', brand: 'Apple' },
  { model: 'iPhone 16 Plus', brand: 'Apple' },
  { model: 'iPhone 16', brand: 'Apple' },
  { model: 'iPhone 15 Pro Max', brand: 'Apple' },
  { model: 'iPhone 15 Pro', brand: 'Apple' },
  { model: 'iPhone 15 Plus', brand: 'Apple' },
  { model: 'iPhone 15', brand: 'Apple' },
  { model: 'iPhone 14 Pro Max', brand: 'Apple' },
  { model: 'iPhone 14 Pro', brand: 'Apple' },
  { model: 'iPhone 14 Plus', brand: 'Apple' },
  { model: 'iPhone 14', brand: 'Apple' },
  { model: 'iPhone 13 Pro Max', brand: 'Apple' },
  { model: 'iPhone 13 Pro', brand: 'Apple' },
  { model: 'iPhone 13', brand: 'Apple' },
  { model: 'iPhone 13 Mini', brand: 'Apple' },
  { model: 'iPhone 12 Pro Max', brand: 'Apple' },
  { model: 'iPhone 12 Pro', brand: 'Apple' },
  { model: 'iPhone 12', brand: 'Apple' },
  { model: 'iPhone 12 Mini', brand: 'Apple' },
  { model: 'iPhone 11 Pro Max', brand: 'Apple' },
  { model: 'iPhone 11 Pro', brand: 'Apple' },
  { model: 'iPhone 11', brand: 'Apple' },
  { model: 'iPhone XS Max', brand: 'Apple' },
  { model: 'iPhone XS', brand: 'Apple' },
  { model: 'iPhone XR', brand: 'Apple' },
  { model: 'iPhone X', brand: 'Apple' },
  { model: 'iPhone SE 3', brand: 'Apple' },
  { model: 'iPhone SE 2', brand: 'Apple' },
  { model: 'iPhone 8 Plus', brand: 'Apple' },
  { model: 'iPhone 8', brand: 'Apple' },
  { model: 'iPhone 7 Plus', brand: 'Apple' },
  { model: 'iPhone 7', brand: 'Apple' },
  // Apple iPad
  { model: 'iPad Pro 12.9"', brand: 'Apple' },
  { model: 'iPad Pro 11"', brand: 'Apple' },
  { model: 'iPad Air', brand: 'Apple' },
  { model: 'iPad Mini', brand: 'Apple' },
  { model: 'iPad 10', brand: 'Apple' },
  // Samsung Galaxy S
  { model: 'Galaxy S24 Ultra', brand: 'Samsung' },
  { model: 'Galaxy S24+', brand: 'Samsung' },
  { model: 'Galaxy S24', brand: 'Samsung' },
  { model: 'Galaxy S23 Ultra', brand: 'Samsung' },
  { model: 'Galaxy S23+', brand: 'Samsung' },
  { model: 'Galaxy S23', brand: 'Samsung' },
  { model: 'Galaxy S22 Ultra', brand: 'Samsung' },
  { model: 'Galaxy S22+', brand: 'Samsung' },
  { model: 'Galaxy S22', brand: 'Samsung' },
  { model: 'Galaxy S21 Ultra', brand: 'Samsung' },
  { model: 'Galaxy S21+', brand: 'Samsung' },
  { model: 'Galaxy S21', brand: 'Samsung' },
  { model: 'Galaxy S20 Ultra', brand: 'Samsung' },
  { model: 'Galaxy S20+', brand: 'Samsung' },
  { model: 'Galaxy S20', brand: 'Samsung' },
  // Samsung Galaxy A
  { model: 'Galaxy A54', brand: 'Samsung' },
  { model: 'Galaxy A34', brand: 'Samsung' },
  { model: 'Galaxy A24', brand: 'Samsung' },
  { model: 'Galaxy A14', brand: 'Samsung' },
  { model: 'Galaxy A53', brand: 'Samsung' },
  { model: 'Galaxy A33', brand: 'Samsung' },
  { model: 'Galaxy A23', brand: 'Samsung' },
  { model: 'Galaxy A13', brand: 'Samsung' },
  // Samsung Galaxy Z
  { model: 'Galaxy Z Fold 5', brand: 'Samsung' },
  { model: 'Galaxy Z Flip 5', brand: 'Samsung' },
  { model: 'Galaxy Z Fold 4', brand: 'Samsung' },
  { model: 'Galaxy Z Flip 4', brand: 'Samsung' },
  // Samsung Galaxy Note
  { model: 'Galaxy Note 20 Ultra', brand: 'Samsung' },
  { model: 'Galaxy Note 20', brand: 'Samsung' },
  { model: 'Galaxy Note 10+', brand: 'Samsung' },
  { model: 'Galaxy Note 10', brand: 'Samsung' },
  // Xiaomi
  { model: 'Xiaomi 14 Ultra', brand: 'Xiaomi' },
  { model: 'Xiaomi 14 Pro', brand: 'Xiaomi' },
  { model: 'Xiaomi 14', brand: 'Xiaomi' },
  { model: 'Xiaomi 13 Ultra', brand: 'Xiaomi' },
  { model: 'Xiaomi 13 Pro', brand: 'Xiaomi' },
  { model: 'Xiaomi 13', brand: 'Xiaomi' },
  { model: 'Redmi Note 13 Pro+', brand: 'Xiaomi' },
  { model: 'Redmi Note 13 Pro', brand: 'Xiaomi' },
  { model: 'Redmi Note 13', brand: 'Xiaomi' },
  { model: 'Redmi Note 12 Pro+', brand: 'Xiaomi' },
  { model: 'Redmi Note 12 Pro', brand: 'Xiaomi' },
  { model: 'Redmi Note 12', brand: 'Xiaomi' },
  { model: 'Redmi 13C', brand: 'Xiaomi' },
  { model: 'Redmi 12', brand: 'Xiaomi' },
  { model: 'POCO X6 Pro', brand: 'Xiaomi' },
  { model: 'POCO X6', brand: 'Xiaomi' },
  { model: 'POCO F5', brand: 'Xiaomi' },
  // Motorola
  { model: 'Moto G84', brand: 'Motorola' },
  { model: 'Moto G73', brand: 'Motorola' },
  { model: 'Moto G54', brand: 'Motorola' },
  { model: 'Moto G34', brand: 'Motorola' },
  { model: 'Moto G24', brand: 'Motorola' },
  { model: 'Moto Edge 40 Pro', brand: 'Motorola' },
  { model: 'Moto Edge 40', brand: 'Motorola' },
  { model: 'Moto Razr 40 Ultra', brand: 'Motorola' },
  { model: 'Moto Razr 40', brand: 'Motorola' },
  // Huawei
  { model: 'Huawei P60 Pro', brand: 'Huawei' },
  { model: 'Huawei P60', brand: 'Huawei' },
  { model: 'Huawei P50 Pro', brand: 'Huawei' },
  { model: 'Huawei P50', brand: 'Huawei' },
  { model: 'Huawei Mate 60 Pro', brand: 'Huawei' },
  { model: 'Huawei Mate 60', brand: 'Huawei' },
  { model: 'Huawei Nova 12', brand: 'Huawei' },
  { model: 'Huawei Nova 11', brand: 'Huawei' },
  // Google Pixel
  { model: 'Pixel 8 Pro', brand: 'Google' },
  { model: 'Pixel 8', brand: 'Google' },
  { model: 'Pixel 7 Pro', brand: 'Google' },
  { model: 'Pixel 7', brand: 'Google' },
  { model: 'Pixel 7a', brand: 'Google' },
  { model: 'Pixel 6 Pro', brand: 'Google' },
  { model: 'Pixel 6', brand: 'Google' },
  // OnePlus
  { model: 'OnePlus 12', brand: 'OnePlus' },
  { model: 'OnePlus 11', brand: 'OnePlus' },
  { model: 'OnePlus Nord 3', brand: 'OnePlus' },
  { model: 'OnePlus Nord CE 3', brand: 'OnePlus' },
  // OPPO
  { model: 'OPPO Find X6 Pro', brand: 'OPPO' },
  { model: 'OPPO Find X6', brand: 'OPPO' },
  { model: 'OPPO Reno 10 Pro+', brand: 'OPPO' },
  { model: 'OPPO Reno 10 Pro', brand: 'OPPO' },
  { model: 'OPPO A98', brand: 'OPPO' },
  { model: 'OPPO A78', brand: 'OPPO' },
  // Realme
  { model: 'Realme GT 5 Pro', brand: 'Realme' },
  { model: 'Realme GT 3', brand: 'Realme' },
  { model: 'Realme 11 Pro+', brand: 'Realme' },
  { model: 'Realme 11 Pro', brand: 'Realme' },
  { model: 'Realme C55', brand: 'Realme' },
  // vivo
  { model: 'vivo X100 Pro', brand: 'vivo' },
  { model: 'vivo X100', brand: 'vivo' },
  { model: 'vivo V29 Pro', brand: 'vivo' },
  { model: 'vivo V29', brand: 'vivo' },
  // Honor
  { model: 'Honor Magic 6 Pro', brand: 'Honor' },
  { model: 'Honor Magic 5 Pro', brand: 'Honor' },
  { model: 'Honor 90', brand: 'Honor' },
  // Otros
  { model: 'Otro modelo', brand: 'Otro' },
];

const EquipmentSection = forwardRef(function EquipmentSection({ equipment, onChange, disabled }, ref) {
  const [inputValue, setInputValue] = useState(equipment.model || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredModels, setFilteredModels] = useState([]);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Exponer método focus al padre
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) {
        inputRef.current.focus();
        setShowSuggestions(true);
      }
    }
  }));

  // Filter models based on input
  useEffect(() => {
    if (inputValue.length >= 1) {
      const filtered = DEVICE_MODELS.filter(device =>
        device.model.toLowerCase().includes(inputValue.toLowerCase()) ||
        device.brand.toLowerCase().includes(inputValue.toLowerCase())
      ).slice(0, 8); // Limit to 8 suggestions
      setFilteredModels(filtered);
    } else {
      // Show popular models when empty
      setFilteredModels(DEVICE_MODELS.slice(0, 8));
    }
  }, [inputValue]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(true);

    // Clear selection if user is typing something new
    if (equipment.model !== value) {
      onChange({ ...equipment, model: value, brand: '' });
    }
  };

  const handleSelectModel = (device) => {
    setInputValue(device.model);
    onChange({
      ...equipment,
      model: device.model,
      brand: device.brand
    });
    setShowSuggestions(false);
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const isCompleted = equipment.model && equipment.model.length > 2;

  return (
    <div className="section" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="section-header">
        <div className="section-title">
          <span className={`section-number ${isCompleted ? 'completed' : ''}`}>
            {isCompleted ? <CheckIcon /> : '2'}
          </span>
          Equipo
        </div>
      </div>

      <div className="form-group" style={{ position: 'relative' }}>
        <label htmlFor="model">Modelo</label>
        <input
          ref={inputRef}
          id="model"
          type="text"
          placeholder="Ej: iPhone 14 Pro, Galaxy S24..."
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={disabled}
          autoComplete="off"
        />

        {/* Autocomplete suggestions */}
        {showSuggestions && !disabled && filteredModels.length > 0 && (
          <div
            ref={suggestionsRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 100,
              maxHeight: '240px',
              overflowY: 'auto',
              marginTop: '4px',
            }}
          >
            {filteredModels.map((device, index) => (
              <button
                key={`${device.brand}-${device.model}-${index}`}
                type="button"
                onClick={() => handleSelectModel(device)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: index < filteredModels.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--border-light)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontWeight: '500',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}>
                  {device.model}
                </span>
                <span style={{
                  color: 'var(--text-muted)',
                  fontSize: '12px'
                }}>
                  {device.brand}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Show selected brand */}
      {equipment.brand && (
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginTop: '-8px',
          marginBottom: '12px'
        }}>
          Marca: <strong>{equipment.brand}</strong>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="serial">IMEI / Serial (opcional)</label>
        <input
          id="serial"
          type="text"
          placeholder="Opcional"
          value={equipment.serial}
          onChange={(e) => onChange({ ...equipment, serial: e.target.value })}
          disabled={disabled}
        />
        <p className="form-hint">Solo si el cliente lo proporciona</p>
      </div>
    </div>
  );
});

export default EquipmentSection;
