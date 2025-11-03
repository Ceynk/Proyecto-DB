# Sistema de Gestión (Node.js + Express + MySQL) con Login y 2FA

Este proyecto provee:

- Autenticación con sesiones y roles (Administrador y Empleado).
- 2FA (TOTP) opcional por usuario (recomendado para Administradores).
- Carga de foto al crear Administradores (avatar/perfil).
- UI web (vanilla JS) con vistas por rol:
  - Administrador: CRUD, búsqueda, creación, actualización/eliminación por ID, creación de admins con foto.
  - Empleado: panel con datos asignados y botón de “Marcar asistencia”.

Tabla `usuarios` extendida con columnas:

- `totp_secret` VARCHAR(64) (se crea automáticamente si no existe)
- `foto_url` VARCHAR(255) (se crea automáticamente si no existe)

Al iniciar el servidor se aplica un “bootstrap” que agrega estas columnas si faltan y crea un usuario Administrador por defecto si no existen admins.

Además, se soporta foto para empleados y materiales:

- `empleados.foto_url` VARCHAR(255)
- `materials.foto_url` VARCHAR(255)

Si no existen, el servidor intentará agregarlas al iniciar.

## Requisitos

- Node.js 18+
- MySQL 8.x (o compatible)

## Variables de entorno (.env)

Ejemplo mínimo:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=BuildSmarts
PORT=5175

# Sesiones
SESSION_SECRET=un_secreto_largo_seguro

# Usuario admin por defecto (se crea si no hay ningún administrador)
ADMIN_USER=admin
ADMIN_PASS=admin123

```

Notas:

- Ajusta `PORT` y credenciales de base de datos según tu entorno.

## Instalación y ejecución

1) Instalar dependencias y levantar el servidor en dev:

```
npm install
npm run dev
```

2) Abre la app en el navegador: http://localhost:${PORT}/ (por defecto 5175)

En el primer arranque:

- Si no hay administradores, se creará uno con `ADMIN_USER`/`ADMIN_PASS`.
- Se intentará agregar columnas `totp_secret` y `foto_url` a `usuarios` si no existían.

## Esquema base de datos

El archivo `esquema.sql` contiene las tablas (clientes, proyectos, empleados, usuarios, etc.). La tabla `usuarios` incluye: `idUsuario`, `nombre_usuario`, `contraseña` (hash bcrypt recomendado), `rol` (Administrador/Contador/Empleado), `idEmpleado`, y (si el servidor lo agrega) `totp_secret`, `foto_url`.

## Flujo de autenticación y roles

1. Login por usuario/contraseña: `POST /api/auth/login`
   - Si el usuario tiene `totp_secret`, la respuesta será `{ ok: true, requires2fa: true }` y NO habrá sesión aún (queda en `pending2fa`).
   - Si no tiene 2FA configurado, la sesión queda activa y el cuerpo responde `{ ok: true, user, requires2fa: false }`.

2. Verificación 2FA: `POST /api/2fa/verify` con `{ token: '123456' }`
   - Verifica el código TOTP con `totp_secret` y activa la sesión del usuario si es correcto.

3. Estado de sesión: `GET /api/auth/me`
   - Devuelve `{ user: {...} }` o `{ user: null }`.

4. Logout: `POST /api/auth/logout`

Roles:

- Administrador: acceso a rutas de administración (listar entidades, crear, actualizar, eliminar, catálogos mínimos y creación de admins con foto).
- Empleado: acceso a su panel, ver sus datos y marcar asistencia.

## Endpoints principales (detalle)

Autenticación y 2FA:

- `POST /api/auth/login` → Inicia login. Si requiere 2FA: `{ requires2fa: true }`.
- `POST /api/2fa/verify` → Verifica TOTP y activa la sesión.
- `GET /api/2fa/setup` (autenticado) → Genera o devuelve el `secret`, `otpauth` y `qr` (data-url) para configurar 2FA en apps como Google Authenticator.
- `GET /api/auth/me` → Usuario de sesión activo o `null`.
- `POST /api/auth/logout` → Cierra sesión.

Administración (solo Administrador):

- `GET /api/entities` → Lista de entidades disponibles.
- `GET /api/list/:entity` → Lista registros, acepta `?q=`.
- `POST /api/create/:entity` → Crea registro (campos controlados por whitelist).
- `PUT /api/update/:entity/:id` → Actualiza por ID (solo campos permitidos para la entidad).
- `DELETE /api/delete/:entity/:id` → Elimina por ID.
- `GET /api/min/*` → Listas mínimas para selects (clientes/proyectos/empleados/materiales/facturas).
- `POST /api/admin/create` (multipart) → Crear administrador con foto.
  - Campos: `username`, `password`, `enable2fa` (true/false), archivo `foto`.
  - Guarda la imagen bajo `/uploads/` y el `foto_url` en usuarios. Si `enable2fa=true`, genera `totp_secret` automáticamente.

Imágenes para Empleados y Materiales (solo Administrador):

- `POST /api/empleados/:id/foto` (multipart) → Sube/actualiza la imagen del empleado.
  - Campo: archivo `foto` (JPG/PNG/WEBP hasta 5 MB).
  - Guarda el archivo en `/uploads` y persiste la ruta en `empleados.foto_url`.
  - Elimina el archivo anterior si existía.
- `POST /api/materiales/:id/foto` (multipart) → Sube/actualiza la imagen del material.
  - Campo: archivo `foto` (JPG/PNG/WEBP hasta 5 MB).
  - Guarda el archivo en `/uploads` y persiste la ruta en `materials.foto_url`.
  - Elimina el archivo anterior si existía.

Usuarios (cualquier rol)

- `GET /api/users` (admin) → Lista todos los usuarios con su rol y si tienen 2FA.
- `POST /api/users/create` (multipart, admin) → Crear usuario de rol `Administrador` | `Contador` | `Empleado`.
  - Campos: `username`, `password`, `rol` (por defecto `Empleado`), `idEmpleado` (opcional, valida existencia), `enable2fa` (true/false), archivo `foto` (opcional).
  - Persiste `foto_url` si envías imagen y (opcional) `totp_secret` cuando habilitas 2FA.

Empleado:

- `GET /api/empleado/mis-datos` → Datos del empleado logueado y su proyecto.
- `POST /api/empleado/asistencia` → Marca asistencia (actualiza `empleados.Asistencia`).

El proyecto no incluye autenticación facial.

## Interfaz web (public/)

- Login: usuario/contraseña. Si requiere 2FA, aparece un formulario de código de 6 dígitos.
- Vista Administrador:
  - Menú de entidades, búsqueda, tabla con acciones, formulario de creación.
  - Controles “Actualizar por ID” y “Eliminar por ID”.
  - Sección “Crear Administrador” con foto (sube a `/uploads`).
  - Para entidades Empleado y Material, en la sección de “Actualizar/Eliminar” verás un control extra para subir la imagen del registro seleccionado.
- Vista Empleado:
  - Panel “Mi panel” con datos básicos y botón “Marcar asistencia”.

## Cómo habilitar 2FA para un usuario

1. Ingresa con el usuario (sin 2FA) y visita `GET /api/2fa/setup` desde el navegador (o usa la UI si la incorporas). Devuelve `qr` como data URL.
2. Escanea el QR con tu app de autenticación (Google Authenticator, Authy, etc.).
3. A partir de entonces, cada login pedirá el código 2FA.

Para el admin creado con `POST /api/admin/create?enable2fa=true`, el secreto se genera automáticamente y puedes obtener el QR con `GET /api/2fa/setup` tras iniciar sesión.

## Notas sobre imágenes

- Las fotos subidas en la creación de usuarios/administradores se guardan físicamente en `./uploads` y su ruta relativa queda en la columna `usuarios.foto_url`.
- El servidor expone `/uploads` como estático, por lo que `foto_url` es accesible desde el navegador (según permisos de tu despliegue).

## Desarrollo y estructura

- `server.js`: servidor Express, sesiones, rutas, 2FA, uploads y API facial.
- `public/`: frontend (HTML/CSS/JS).
- `esquema.sql`: esquema base de las tablas.

## Notas de producción

- Usa un store de sesiones persistente (Redis) en lugar del store en memoria.
- Encripta SIEMPRE las contraseñas con bcrypt.
- Forzar HTTPS (cookies `secure` y `sameSite=strict`), CORS restringido y rate limiting.
- Backup de base de datos y logs de auditoría para acciones críticas (update/delete).

## Licencia

MIT
