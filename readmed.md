Diseñar e implementar una aplicación web/PWA móvil-first que permita a usuarios internos iniciar sesión con sus credenciales de Odoo una sola vez por sesión, escanear códigos QR desde la cámara del dispositivo y actualizar el estado de una reparación en Odoo, de forma segura, rápida y auditada.
🧩 Arquitectura obligatoria (NO NEGOCIABLE)
1. Componentes
Frontend (PWA)
Web app móvil-first
Acceso a cámara (QR scanning)
No contiene lógica de negocio ni credenciales persistentes
API Puente (Backend)
Único componente que se comunica con Odoo
Maneja autenticación, tokens, permisos y validaciones
Odoo
Fuente única de usuarios y permisos
Sistema final donde se actualiza el estado de la reparación
⚠️ El frontend NUNCA se comunica directamente con Odoo.
🔐 Autenticación (Regla crítica)
Reglas obligatorias
El usuario introduce usuario y contraseña de Odoo solo una vez por sesión.
Las credenciales:
❌ NO se almacenan en el frontend
❌ NO se guardan en base de datos
❌ NO se reutilizan para operaciones posteriores
El API puente:
Valida credenciales contra Odoo (JSON-RPC)
Verifica que el usuario pertenece a un grupo autorizado
Emite un token propio (JWT) con expiración corta
Todas las acciones posteriores usan solo el JWT, no credenciales de Odoo.
🔑 Manejo de tokens
JWT con:
user_id (Odoo)
username
roles / grupos
exp (expiración)
Tiempo recomendado:
Access token: 15–30 minutos
Refresh token (opcional): rotativo
El token se invalida al expirar o al cerrar sesión.
🛂 Permisos y roles
El API puente debe validar:
Usuario activo en Odoo
Pertenencia a grupo autorizado (ejemplo: repair_scanner_user)
Reglas de transición de estados según rol:
Recepción
Técnico
⚠️ Aunque el write en Odoo se haga con un usuario técnico,
el control de permisos y auditoría se basa en el usuario autenticado.
📦 QR – Reglas estrictas
El QR NO puede contener solo un ID plano
Debe incluir:
Identificador de reparación
Firma (HMAC o similar)
Expiración (opcional pero recomendado)
El API puente debe:
Validar la firma
Rechazar QRs inválidos, vencidos o manipulados
🔄 Flujo funcional obligatorio
Usuario abre la PWA
Login con credenciales de Odoo (una sola vez)
Token JWT emitido
Usuario escanea QR
App muestra confirmación (equipo / estado actual)
Usuario selecciona nuevo estado + nota opcional
API valida token + QR + permisos
API actualiza Odoo
Se registra auditoría (quién, cuándo, qué cambió)
Respuesta clara al usuario
🧾 Auditoría y trazabilidad
Cada cambio de estado debe registrar:
Usuario autenticado (Odoo user)
Fecha y hora
Estado anterior
Estado nuevo
Nota (si existe)
Debe ser visible en Odoo (chatter o modelo de historial).
🚫 Prohibiciones absolutas
❌ No exponer Odoo al frontend
❌ No guardar contraseñas
❌ No autenticar contra Odoo en cada acción
❌ No usar IDs planos sin firma en QR
❌ No omitir validación de permisos
❌ No implementar lógica de negocio en el frontend
📱 UX esperada
Interfaz mínima:
Login
Botón “Escanear”
Confirmación
Resultado
Optimizada para uso con una mano
Pensada para uso repetitivo en mostrador/taller
📌 Resultado esperado
Un sistema:
Seguro
Móvil-first
Fácil de usar
Integrado con Odoo sin duplicar usuarios
Escalable y mantenible
Listo para producción
🧠 Modo de trabajo del agente
NO inventes flujos
NO cambies la arquitectura
Si algo no está definido, pregunta antes de asumir
Prioriza simplicidad, seguridad y claridad
Si quieres, en el próximo paso puedo:
Adaptar este prompt específicamente a Odoo 16 / 17 / 19
Convertir esto en prompt para Codex / Cursor / Devin
Generar una checklist de QA para validar que el agente no se desvió
O bajarlo a versión ultra corta para pegar en un system prompt
Dime cómo lo vas a usar y lo ajusto.