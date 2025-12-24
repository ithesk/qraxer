# QRaxer

PWA mobile-first para escanear codigos QR y actualizar estados de ordenes de reparacion en Odoo.

## Caracteristicas

- **Autenticacion con Odoo**: Login usando credenciales de usuario de Odoo
- **Escaner QR**: Escaneo de codigos QR con camara del dispositivo
- **Actualizacion rapida de estados**: Flujo simplificado con botones de accion rapida
- **PWA instalable**: Funciona como app nativa en iOS y Android
- **Offline-ready**: Cache de assets con Service Worker
- **Auditoria**: Registro de cambios en el chatter de Odoo

## Estructura del Proyecto

```
qraxer/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/         # Configuracion (env)
│   │   ├── middleware/     # Auth JWT, error handler
│   │   ├── routes/         # Endpoints API
│   │   └── services/       # Odoo client, QR service
│   └── .env                # Variables de entorno
├── frontend/               # PWA React/Vite
│   ├── public/            # Iconos PWA
│   ├── src/
│   │   ├── components/    # Login, Scanner, RepairConfirm, Result
│   │   ├── services/      # API client
│   │   └── styles/        # CSS global
│   └── scripts/           # Generador de iconos
└── pnpm-workspace.yaml    # Monorepo config
```

## Requisitos

- Node.js 18+ (para desarrollo local)
- pnpm 8+ (para desarrollo local)
- Docker y Docker Compose (para produccion)
- Acceso a instancia de Odoo con modulo `repair`

## Despliegue con Docker (Recomendado)

### Opcion 1: Docker Compose

```bash
# Clonar repositorio
git clone https://github.com/ithesk/qraxer.git
cd qraxer

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Construir y ejecutar
docker-compose up -d --build

# Ver logs
docker-compose logs -f
```

La aplicacion estara disponible en `http://localhost:8080`

### Opcion 2: Portainer Stack

1. En Portainer, ir a **Stacks** > **Add Stack**
2. Nombre: `qraxer`
3. En **Repository**, usar:
   - URL: `https://github.com/ithesk/qraxer`
   - Compose path: `docker-compose.yml`
4. En **Environment variables**, agregar:
   - `JWT_SECRET`: secreto-seguro-para-jwt
   - `ODOO_URL`: https://tu-instancia.odoo.com
   - `ODOO_DB`: nombre-base-datos
   - `PORT`: 8080 (o el puerto deseado)
5. Click en **Deploy the stack**

### Variables de Entorno

| Variable | Descripcion | Requerido |
|----------|-------------|-----------|
| JWT_SECRET | Secreto para firmar tokens JWT | Si |
| ODOO_URL | URL de la instancia de Odoo | Si |
| ODOO_DB | Nombre de la base de datos de Odoo | Si |
| PORT | Puerto donde exponer la app (default: 8080) | No |
| JWT_EXPIRES_IN | Expiracion del token (default: 7d) | No |
| QR_HMAC_SECRET | Secreto para firmar QRs | No |
| QR_EXPIRATION_MINUTES | Minutos de validez del QR (default: 60) | No |

## Instalacion Local (Desarrollo)

```bash
# Clonar repositorio
git clone <repo-url>
cd qraxer

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales de Odoo
```

## Configuracion

Editar `backend/.env`:

```env
# Servidor
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=tu-secreto-seguro-aqui

# Odoo
ODOO_URL=https://tu-instancia.odoo.com
ODOO_DB=nombre-base-datos

# QR (opcional)
QR_HMAC_SECRET=secreto-para-firmar-qr
QR_EXPIRATION_MINUTES=60
```

## Desarrollo

```bash
# Ejecutar backend y frontend en paralelo
pnpm run dev

# Solo backend
pnpm --filter qraxer-backend run dev

# Solo frontend
pnpm --filter qraxer-pwa run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Build de Produccion

```bash
# Build del frontend (genera PWA)
pnpm run build

# Los archivos se generan en frontend/dist/
```

## API Endpoints

### Autenticacion

```
POST /api/auth/login
Body: { "username": "user", "password": "pass" }
Response: { "token": "jwt...", "user": {...} }

POST /api/auth/logout
Headers: Authorization: Bearer <token>
```

### Reparaciones

```
POST /api/repair/scan
Headers: Authorization: Bearer <token>
Body: { "qrContent": "E707640" }
Response: { "repair": {...}, "availableStates": [...] }

POST /api/repair/update-state
Headers: Authorization: Bearer <token>
Body: { "qrContent": "E707640", "newState": "under_repair", "note": "" }
Response: { "success": true, "oldState": "...", "newState": "..." }

GET /api/repair/states
Headers: Authorization: Bearer <token>
Response: { "states": [...] }

GET /api/repair/:code
Headers: Authorization: Bearer <token>
Response: { "repair": {...}, "availableStates": [...] }
```

## Estados de Reparacion

| Estado | Label | Accion disponible |
|--------|-------|-------------------|
| draft | Borrador | Iniciar Reparacion |
| confirmed | Confirmado | Iniciar Reparacion |
| ready | Listo | Iniciar Reparacion |
| under_repair | En reparacion | Marcar como Reparado |
| 2binvoiced | Por facturar | Iniciar Reparacion |
| done | Reparado | Iniciar Reparacion |
| test | En pruebas | Iniciar Reparacion |
| cancel | Cancelado | Sin acciones |
| handover | Entregado | Sin acciones |
| guarantee | En garantia | Iniciar Reparacion |

## Flujo de Uso

1. Usuario inicia sesion con credenciales de Odoo
2. Escanea QR de una orden de reparacion (ej: `E707640`)
3. Ve informacion de la orden y estado actual
4. Si el equipo NO esta en reparacion → boton "Iniciar Reparacion"
5. Si el equipo ESTA en reparacion → boton "Marcar como Reparado"
6. Al actualizar, se asigna el usuario al campo `user_id` de la orden
7. Se registra el cambio en el chatter de Odoo para auditoria

## PWA

La aplicacion es una Progressive Web App completa:

- **Instalable**: En Chrome/Safari aparece opcion "Agregar a pantalla de inicio"
- **Iconos adaptables**: Soporte para iconos maskable en Android
- **Offline**: Assets cacheados con Workbox
- **Standalone**: Se ejecuta como app nativa sin barra de navegador

### Generar iconos

```bash
cd frontend
node scripts/generate-icons.mjs
```

## Seguridad

- Autenticacion JWT con expiracion configurable
- Sesiones de Odoo almacenadas por usuario
- QR firmados con HMAC (opcional, habilitado en produccion)
- CORS configurado para origenes permitidos

## Tecnologias

### Backend
- Node.js + Express
- JSON-RPC para comunicacion con Odoo
- JWT para autenticacion

### Frontend
- React 18
- Vite + vite-plugin-pwa
- html5-qrcode para escaneo
- Workbox para Service Worker

## Licencia

MIT
