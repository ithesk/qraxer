Contexto del proyecto
Estamos desarrollando una PWA iOS-first llamada QRaxer, usada en mostrador y por técnicos para gestión de órdenes de reparación conectadas a Odoo.
Ya existe una versión de escaneo QR.
Ahora se quiere crear una nueva versión MVP con un Quick Creator para crear órdenes de reparación rápidamente desde el teléfono, sin enfocarse aún en performance avanzada.
Esta versión NO es producción final, es un MVP funcional para validar flujo y velocidad percibida.
Objetivo principal
Permitir crear una orden de reparación completa en ≤ 45 segundos desde un iPhone, incluso si Odoo tarda 1–3 segundos en responder.
La experiencia debe sentirse rápida, clara y sin fricción, usando UX para ocultar latencia.
Principios obligatorios
iPhone-first (Safari iOS / PWA)
UX simple, sin pasos innecesarios
Optimistic UI (no bloquear la interfaz esperando Odoo)
Arquitectura directa a Odoo (sin cache, sin Redis, sin colas en esta fase)
Solo lo mínimo necesario (MVP real)
Navegación de la app
Usar Bottom Navigation con 3 tabs:
Escanear
Crear (Quick Creator)
Historial
Feature 1 — Quick Creator (Crear Orden Rápida)
Flujo general
Identificar cliente (existente o nuevo)
Capturar equipo
Capturar problema
Crear orden
Mostrar confirmación con QR / número
Máximo 2 pantallas (form + confirmación).
1️⃣ Flujo Cliente (MVP)
Input principal
Campo: Teléfono del cliente
Teclado numérico
Botón: Buscar
Reglas
NO buscar en cada tecla
Buscar solo cuando:
usuario presiona “Buscar”
o el teléfono tiene ≥ 10 dígitos
Estados posibles
A) Cliente EXISTE
Mostrar card compacta:
Nombre
Teléfono
Acción:
Usar este cliente (1 toque)
Al seleccionar → avanzar automáticamente a “Equipo”
NO pedir confirmaciones extra.
B) Cliente NO EXISTE
Mostrar mensaje:
No encontramos ese cliente
Acción principal:
Crear cliente rápido
Modal: Crear Cliente Rápido
Campos:
Nombre (obligatorio)
Teléfono (prellenado)
Acción:
Guardar y continuar
UX obligatoria:
El modal se cierra inmediatamente
El cliente se considera “seleccionado”
La app avanza al paso Equipo SIN esperar respuesta de Odoo
(Optimistic UI)
2️⃣ Flujo Equipo (MVP)
Campos mínimos:
Marca (selector)
Modelo (texto libre o autocomplete simple)
IMEI / Serial (opcional)
No OCR, no validaciones complejas en esta fase.
3️⃣ Flujo Problema (MVP)
Chips rápidos (multi-select):
Pantalla
Batería
Carga
No enciende
Software
Diagnóstico
Campo opcional:
Nota breve
4️⃣ Crear Orden (CRÍTICO)
Al tocar “Crear Orden”
NO bloquear la interfaz esperando Odoo.
Flujo obligatorio:
Botón pasa a loading
Mostrar texto: “Creando orden…”
Generar un ID temporal (TMP-001)
Mostrar pantalla “Orden creada”
En background:
crear cliente (si aplica)
crear orden en Odoo
Al recibir respuesta:
reemplazar TMP-001 por número real (E707640)
Si Odoo falla:
Mostrar toast humano:
“No se pudo crear la orden. Intenta de nuevo.”
Feature 2 — Pantalla de Confirmación
Mostrar:
Número de orden (o ID temporal)
Estado inicial: Recibido
Acciones:
Mostrar QR
Compartir por WhatsApp
Crear otra orden (CTA principal)
Ver detalle (secundario)
Feature 3 — Escaneo QR (mejorado)
Botón “Abrir cámara”
Overlay fullscreen con marco
Texto: “Alinea el código QR”
Al detectar QR:
Vibración corta (haptic)
Flash visual verde (~150 ms)
Cerrar cámara automáticamente
Feature 4 — Historial (básico)
Lista simple de órdenes recientes
Mostrar:
Número
Estado (chip)
Equipo + cliente
Hora
Filtros básicos:
Hoy / 7 días / Todos
UX obligatoria (NO negociar)
Skeleton loaders en búsquedas
No spinners infinitos
No mensajes técnicos
Copy humano y corto
Botones grandes (dedos / mostrador)
Cosas que NO se deben implementar en este MVP
❌ Cache server
❌ Redis
❌ Offline real
❌ Colas
❌ OCR
❌ Validaciones rígidas
❌ Presupuestos / precios
❌ Diagnósticos avanzados
Backend / Integración (alto nivel)
Usar endpoints simples hacia Odoo:
Buscar cliente por teléfono
Crear cliente
Crear orden de reparación
No optimizar performance aún, solo funcionalidad.
Resultado esperado
Flujo usable en mostrador
Orden creada en < 45 segundos
UX fluida aunque Odoo tarde
Base sólida para optimizar luego
Material adjunto
Preview de interfaces (mockups iPhone)
Diseño UX ya definido
Este prompt define la fuente de verdad
❗ Instrucción final al agente
No agregues features fuera de este alcance.
No sobre-optimices.
Respeta el MVP y el flujo UX descrito.