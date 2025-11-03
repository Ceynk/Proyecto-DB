# Sistema de Gestión (Node.js + Express + MySQL) con Login y Código por Correo

Este proyecto provee:

- Autenticación con sesiones y roles (Administrador y Empleado).
- Verificación por correo: tras usuario/contraseña, se envía un código de 6 dígitos al correo del usuario.
- Carga de foto al crear Administradores (avatar/perfil).
- UI web (vanilla JS) con vistas por rol:
  - Administrador: CRUD, búsqueda, creación, actualización/eliminación por ID, creación de admins con foto.
  - Empleado: panel con datos asignados y botón de “Marcar asistencia”.

Tabla `usuarios` extendida con columnas:

- `Correo` VARCHAR(120) (se crea automáticamente si no existe)
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
ADMIN_EMAIL=admin@example.com

# SMTP para envío de códigos por correo
SMTP_HOST=tu_smtp
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_usuario
SMTP_PASS=tu_password
SMTP_FROM=no-reply@tu-dominio.com

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

- Si no hay administradores, se creará uno con `ADMIN_USER`/`ADMIN_PASS` y correo `ADMIN_EMAIL`.
- Se intentará agregar columnas `Correo` y `foto_url` a `usuarios` si no existían.

## Esquema base de datos

El archivo `esquema.sql` contiene las tablas (clientes, proyectos, empleados, usuarios, etc.). La tabla `usuarios` incluye: `idUsuario`, `nombre_usuario`, `contraseña` (hash bcrypt recomendado), `rol` (Administrador/Contador/Empleado), `idEmpleado`, y (si el servidor lo agrega) `totp_secret`, `foto_url`.

## Flujo de autenticación y roles

1. Login por usuario/contraseña: `POST /api/auth/login`
  - Envía un código de 6 dígitos al correo del usuario (o al correo del empleado vinculado).
  - Respuesta: `{ ok: true, requiresEmail: true }`.

2. Verificación de correo: `POST /api/auth/verify-email` con `{ code: '123456' }`
  - Verifica el código y activa la sesión del usuario si es correcto.

3. Estado de sesión: `GET /api/auth/me`
   - Devuelve `{ user: {...} }` o `{ user: null }`.

4. Logout: `POST /api/auth/logout`

Roles:

- Administrador: acceso a rutas de administración (listar entidades, crear, actualizar, eliminar, catálogos mínimos y creación de admins con foto).
- Empleado: acceso a su panel, ver sus datos y marcar asistencia.

## Endpoints principales (detalle)

Autenticación por correo:

- `POST /api/auth/login` → Inicia login. Si requiere 2FA: `{ requires2fa: true }`.
- `POST /api/auth/verify-email` → Verifica código de correo y activa la sesión.
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
  - Campos: `username`, `password`, `correo` (opcional), archivo `foto`.
  - Guarda la imagen bajo `/uploads/` y el `foto_url` en usuarios. Guarda `Correo` cuando se especifica.

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
  - Campos: `username`, `password`, `rol` (por defecto `Empleado`), `idEmpleado` (opcional, valida existencia), `correo` (opcional), archivo `foto` (opcional).
  - Persiste `foto_url` si envías imagen y `Correo` si lo envías.

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

## Notas sobre verificación por correo

- El correo se envía a `usuarios.Correo`. Si ese campo está vacío y el usuario está enlazado a un empleado, se usa `empleados.Correo`.
- El código dura 5 minutos. Se almacena en la sesión del navegador.

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
