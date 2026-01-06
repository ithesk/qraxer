# Plan de Compatibilidad iPad - QRaxer

> **Fecha:** Enero 2026
> **Versión base:** v2.1.0-stable (tag: `v2.1.0-stable`)
> **Rama:** ios-capacitor
> **Estrategia:** Proyecto Adaptativo (mismo codebase)

---

## 1. Resumen Ejecutivo

### Objetivo
Hacer que QRaxer funcione correctamente en iPad sin crear una rama separada, usando CSS responsivo y media queries.

### Estado Actual
| Aspecto | Estado |
|---------|--------|
| Xcode TARGETED_DEVICE_FAMILY | ✅ `"1,2"` (iPhone + iPad) |
| Info.plist orientaciones iPad | ✅ Configurado |
| CSS responsivo | ❌ No implementado |
| Media queries tablet | ❌ No existen |
| `max-width: 480px` hardcodeado | ⚠️ 6 lugares |

### Esfuerzo Estimado
- **Total:** 12-15 horas
- **Riesgo:** Bajo (cambios solo en CSS)
- **Impacto iPhone:** Ninguno (breakpoints solo afectan pantallas > 768px)

---

## 2. Análisis de Breakpoints

### Dispositivos Target

| Dispositivo | Ancho Portrait | Ancho Landscape |
|-------------|----------------|-----------------|
| iPhone SE | 375px | 667px |
| iPhone 14 | 390px | 844px |
| iPhone 14 Pro Max | 430px | 932px |
| **iPad Mini** | **768px** | **1024px** |
| **iPad Air** | **820px** | **1180px** |
| **iPad Pro 11"** | **834px** | **1194px** |
| **iPad Pro 12.9"** | **1024px** | **1366px** |

### Breakpoints Propuestos

```css
/* Mobile (default) */
/* 0 - 767px */

/* Tablet Portrait */
@media (min-width: 768px) { }

/* Tablet Landscape / Desktop */
@media (min-width: 1024px) { }

/* iPad Pro 12.9" Landscape */
@media (min-width: 1280px) { }
```

---

## 3. Archivos a Modificar

### 3.1 CSS Principal
**Archivo:** `src/styles/global.css`

#### Variables CSS (línea ~16)
```css
:root {
  /* Existing variables... */

  /* NEW: Responsive content widths */
  --content-max-width: 480px;
  --content-padding: 16px;
  --scanner-aspect: 1;
}

/* Tablet Portrait (768px+) */
@media (min-width: 768px) {
  :root {
    --content-max-width: 680px;
    --content-padding: 24px;
    --tab-height: 64px;
  }
}

/* Tablet Landscape (1024px+) */
@media (min-width: 1024px) {
  :root {
    --content-max-width: 800px;
    --content-padding: 32px;
    --scanner-aspect: 16/10;
  }
}
```

#### Contenedores (reemplazar max-width hardcodeados)
```css
/* Líneas afectadas: 254, 514, 843, 1068, 1874, 2596 */
.container,
.header-content,
.bottom-nav-inner,
.login-container,
.profile-screen-ios,
.settings-screen {
  max-width: var(--content-max-width);
  padding-left: var(--content-padding);
  padding-right: var(--content-padding);
}
```

### 3.2 Componentes Específicos

#### Scanner Area
**Archivo:** `src/styles/global.css` (sección scanner)

```css
.scanner-area {
  aspect-ratio: var(--scanner-aspect);
  width: 100%;
  max-width: 400px;
}

@media (min-width: 768px) {
  .scanner-area {
    max-width: 500px;
  }
}

@media (min-width: 1024px) and (orientation: landscape) {
  .scanner-area {
    max-width: 600px;
    aspect-ratio: 16/10;
  }
}
```

#### Bottom Navigation
```css
.bottom-nav {
  /* Existing styles... */
}

@media (min-width: 1024px) and (orientation: landscape) {
  .bottom-nav {
    /* Opción A: Bottom nav más compacto */
    height: 60px;
  }

  .bottom-nav-inner {
    max-width: 600px;
  }

  /* Opción B: Sidebar (más avanzado) */
  /*
  .bottom-nav {
    position: fixed;
    left: 0;
    top: var(--sat);
    bottom: var(--sab);
    width: 80px;
    height: auto;
    flex-direction: column;
  }
  */
}
```

#### Header
```css
.header {
  /* Existing... */
}

@media (min-width: 768px) {
  .header-content {
    max-width: var(--content-max-width);
  }

  .header-logo img {
    height: 36px;
  }

  .header-user {
    width: 44px;
    height: 44px;
  }
}
```

#### Login Screen
```css
.login-container {
  max-width: var(--content-max-width);
}

@media (min-width: 768px) {
  .login-container {
    padding: 48px;
  }

  .login-form {
    max-width: 400px;
    margin: 0 auto;
  }

  .login-logo {
    width: 120px;
    height: 120px;
  }
}
```

#### Profile Screen
```css
@media (min-width: 768px) {
  .profile-ios-avatar-container {
    width: 140px;
    height: 140px;
  }

  .profile-ios-card {
    max-width: 600px;
    margin: 0 auto 20px;
  }
}
```

#### Settings Screen
```css
@media (min-width: 768px) {
  .settings-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .settings-picker {
    max-width: 500px;
  }
}
```

#### Mo35 OCR Screen
```css
@media (min-width: 768px) {
  .mo35-ocr-screen {
    padding: var(--content-padding);
  }

  .mo35-ocr-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (min-width: 1024px) {
  .mo35-ocr-list {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

#### Modales y Action Sheets
```css
@media (min-width: 768px) {
  .modal-content,
  .settings-modal-backdrop .settings-picker,
  .profile-ios-action-sheet {
    max-width: 500px;
    margin: auto;
  }
}
```

---

## 4. Checklist de Implementación

### Fase 1: Variables y Base (2-3 horas)
- [ ] Agregar variables CSS responsivas en `:root`
- [ ] Crear media queries base (768px, 1024px)
- [ ] Reemplazar `max-width: 480px` por `var(--content-max-width)`
- [ ] Ajustar `--tab-height` para tablet

### Fase 2: Componentes Principales (3-4 horas)
- [ ] Header responsivo
- [ ] Bottom navigation adaptativo
- [ ] Login screen centrado en tablet
- [ ] Scanner area con aspect ratio dinámico

### Fase 3: Pantallas Secundarias (2-3 horas)
- [ ] Profile screen
- [ ] Settings screen
- [ ] Mo35 OCR screen (grid layout)
- [ ] Quick Creator forms

### Fase 4: Modales y Detalles (1-2 horas)
- [ ] Action sheets centrados
- [ ] Pickers con max-width
- [ ] Toast notifications posicionados
- [ ] Offline banner adaptativo

### Fase 5: Testing (3-4 horas)
- [ ] iPad Mini (768x1024)
- [ ] iPad Air (820x1180)
- [ ] iPad Pro 11" (834x1194)
- [ ] iPad Pro 12.9" (1024x1366)
- [ ] Ambas orientaciones
- [ ] Face ID en iPad
- [ ] Camera/Scanner en iPad

---

## 5. Configuración PWA

### Archivo: `vite.config.js`

```javascript
// Cambiar orientación de "portrait" a "any"
manifest: {
  // ...
  orientation: "any", // Era "portrait"
  // ...
}
```

---

## 6. Testing Matrix

| Funcionalidad | iPad Mini | iPad Air | iPad Pro |
|--------------|-----------|----------|----------|
| Login | ⬜ | ⬜ | ⬜ |
| Face ID | ⬜ | ⬜ | ⬜ |
| QR Scanner | ⬜ | ⬜ | ⬜ |
| OCR IMEI | ⬜ | ⬜ | ⬜ |
| Profile | ⬜ | ⬜ | ⬜ |
| Settings | ⬜ | ⬜ | ⬜ |
| Offline Banner | ⬜ | ⬜ | ⬜ |
| Quick Creator | ⬜ | ⬜ | ⬜ |
| Landscape | ⬜ | ⬜ | ⬜ |
| Portrait | ⬜ | ⬜ | ⬜ |

**Leyenda:** ⬜ Pendiente | ✅ Pasó | ❌ Falló

---

## 7. Rollback Plan

Si algo falla, revertir al tag estable:

```bash
# Ver estado estable
git checkout v2.1.0-stable

# O resetear la rama
git reset --hard v2.1.0-stable
```

---

## 8. Cronograma Sugerido

| Día | Tareas | Horas |
|-----|--------|-------|
| 1 | Fase 1 + Fase 2 parcial | 4-5h |
| 2 | Fase 2 + Fase 3 | 4-5h |
| 3 | Fase 4 + Fase 5 (testing) | 3-4h |

**Total: 3 días de trabajo (~12-15 horas)**

---

## 9. Notas Técnicas

### Safe Areas en iPad
Los iPads con Face ID tienen safe areas similares a iPhone. El CSS actual ya usa `env(safe-area-inset-*)` correctamente.

### Split View / Slide Over
Para soporte completo de multitasking en iPad, considerar:
- `@media (max-width: 320px)` para Slide Over
- Container queries para adaptarse al tamaño real disponible

### Teclado en iPad
El teclado de iPad es más grande. Verificar que los formularios no queden ocultos.

---

## 10. Referencias

- [Apple Human Interface Guidelines - iPad](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [CSS Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries)

---

## Aprobación

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Developer | | | |
| QA | | | |
| Product | | | |
