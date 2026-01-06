# Plan de Optimizacion y Cache - QRaxer

## Resumen Ejecutivo

La aplicacion tiene una buena base con IndexedDB para persistencia offline y cache basico en localStorage, pero hay oportunidades importantes de mejora en:
- Cache centralizado de datos API
- Estrategias de revalidacion (stale-while-revalidate)
- Reduccion de llamadas API

---

## 1. Estado Actual

### Que ya funciona bien:
- `qraxer_scan_history`: Ultimos 5 escaneos en localStorage
- `orderQueue`: Ordenes pendientes con IndexedDB
- Listeners reactivos para sincronizacion

### Problemas identificados:

| Endpoint | Problema |
|----------|----------|
| `/repair/states` | Se llama cada vez que se abre StateModal - datos estaticos |
| `/repair/config` | Se llama cada login pero no se cachea |
| `/repair/recent` | Sin cache - refetch completo cada cambio de filtro |
| `/products/barcode/{barcode}` | Sin cache - busquedas repetidas |

---

## 2. Plan de Implementacion

### FASE 1: Cache Service (Prioridad ALTA)

Crear `frontend/src/services/cacheService.js`:

```javascript
// TTLs recomendados:
const TTL = {
  REPAIR_STATES: 7 * 24 * 60 * 60 * 1000,    // 7 dias (estatico)
  REPAIR_CONFIG: 7 * 24 * 60 * 60 * 1000,    // 7 dias (estatico)
  RECENT_REPAIRS: 5 * 60 * 1000,              // 5 minutos
  REPAIR_DETAIL: 10 * 60 * 1000,              // 10 minutos
  PRODUCT_BARCODE: 60 * 60 * 1000,            // 1 hora
};

const cacheService = {
  async set(key, data, ttl) {
    const item = {
      data,
      expiresAt: Date.now() + ttl,
      version: 1
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
  },

  async get(key) {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;

    const item = JSON.parse(raw);
    if (Date.now() > item.expiresAt) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
    return item.data;
  },

  async getOrFetch(key, fetchFn, ttl) {
    const cached = await this.get(key);
    if (cached) return { data: cached, isStale: false };

    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);
    return { data: fresh, isStale: false };
  },

  async remove(key) {
    localStorage.removeItem(`cache_${key}`);
  },

  async cleanup() {
    // Eliminar items expirados
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_'))
      .forEach(key => {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (Date.now() > item.expiresAt) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      });
  }
};
```

### FASE 2: Stale-While-Revalidate (Prioridad ALTA)

Modificar History.jsx para mostrar datos cacheados mientras revalida:

```javascript
const [repairs, setRepairs] = useState([]);
const [isStale, setIsStale] = useState(false);

const loadRepairsWithCache = async () => {
  const cacheKey = `repairs_${filter}`;

  // 1. Mostrar cache inmediatamente si existe
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    setRepairs(cached);
    setIsStale(true);
  }

  // 2. Revalidar en background
  try {
    const fresh = await api.getRecentRepairs(days);
    await cacheService.set(cacheKey, fresh.repairs, 5*60*1000);
    setRepairs(fresh.repairs);
    setIsStale(false);
  } catch (err) {
    if (!cached) setError(err);
  }
};
```

### FASE 3: Cachear Repair States (Maximo impacto)

En `api.js`:

```javascript
async getRepairStates() {
  const cached = await cacheService.get('repair_states');
  if (cached) return cached;

  const response = await this.request('/repair/states', {method: 'GET'});
  const data = await response.json();

  if (!response.ok) throw new Error(data.error);

  // Cachear 7 dias - datos estaticos
  await cacheService.set('repair_states', data.states, 7*24*60*60*1000);
  return data.states || [];
}
```

### FASE 4: Cachear Repair Config

```javascript
async getRepairConfig() {
  const cached = await cacheService.get('repair_config');
  if (cached) return cached;

  const response = await this.request('/repair/config', {method: 'GET'});
  const data = await response.json();

  if (!response.ok) throw new Error(data.error);

  await cacheService.set('repair_config', data, 7*24*60*60*1000);
  return data;
}
```

---

## 3. Invalidacion de Cache

| Dato | TTL | Invalidar cuando |
|------|-----|-----------------|
| Repair States | 7 dias | Logout |
| Repair Config | 7 dias | Logout |
| Recent Repairs | 5 min | Manual refresh, crear orden |
| Repair Detail | 10 min | Cambiar estado |
| Products | 1 hora | Manual busqueda |

En logout:
```javascript
const logout = () => {
  cacheService.cleanup();
  localStorage.removeItem('cache_repair_states');
  localStorage.removeItem('cache_repair_config');
  // ... resto del logout
};
```

---

## 4. Impacto Esperado

### Reduccion de Trafico
- `getRepairStates()`: 100% reduccion
- `getRepairConfig()`: 100% reduccion
- `getRecentRepairs()`: ~80% reduccion
- **Total: ~40% menos llamadas API**

### Mejora de UX
- Datos disponibles offline
- Carga instantanea (cache-first)
- UI no bloqueada durante fetch

---

## 5. Checklist de Implementacion

### Semana 1
- [ ] Crear `cacheService.js`
- [ ] Integrar en `getRepairStates()`
- [ ] Integrar en `getRepairConfig()`
- [ ] Tests basicos

### Semana 2
- [ ] Implementar SWR en History.jsx
- [ ] Implementar SWR en ProductScanner.jsx
- [ ] Cleanup automatico en App.jsx
- [ ] Cache de productos por barcode

---

## 6. Consideraciones

### Mostrar estado de cache al usuario
```jsx
{isStale && (
  <div style={{
    padding: '8px',
    background: '#fef3c7',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#92400e',
    textAlign: 'center',
    marginBottom: '12px'
  }}>
    Actualizando datos...
  </div>
)}
```

### Boton de refresh manual
```jsx
<button onClick={() => {
  cacheService.remove(`repairs_${filter}`);
  loadRepairs();
}}>
  Actualizar
</button>
```

---

## 7. Storage Estimado

- IndexedDB disponible: ~50MB tipico
- Cache actual proyectado: ~500KB
- Margen amplio para crecer
