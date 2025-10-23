Proyecto de Alejandro Diaz, Karen Cagua y Miguel Montañez

## Despliegue del backend (Node + Express + MySQL) en Railway

Este repositorio contiene un backend en Node/Express (`server.js`) y un frontend estático en `public/`. El frontend principal está en GitHub Pages, y el backend se puede publicar fácilmente en Railway.

### Requisitos

- Cuenta en GitHub (código en un repositorio)
- Cuenta en Railway (https://railway.app)

### Variables de entorno

Para desarrollo local, copia `.env.example` a `.env` y ajusta tus credenciales:

```
PORT=5175
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=tu_base
```

Nota: En Railway, si añades el plugin de MySQL, la plataforma expone automáticamente estas variables: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`. El servidor ya soporta ambos formatos (DB_* y MYSQL*), así que no necesitas renombrarlas.

### Pasos en Railway

1. Sube este repositorio a GitHub si aún no lo has hecho.
2. Entra a Railway y crea un New Project > Deploy from GitHub Repo. Selecciona este repo.
3. Railway detectará Node.js. Asegúrate de que el Start Command sea `npm start` (este repo ya lo define en `package.json`).
4. Agrega una base de datos: New > Database > MySQL. Railway creará el servicio y añadirá las variables `MYSQL*` al servicio del backend si los conectas:
	- Ve al servicio del backend > Variables > Add Variable > Reference > selecciona las variables del servicio MySQL (o usa “Link”/“Add dependency” entre servicios).
5. Despliega. Railway asignará un dominio público y expondrá el puerto que la app imprime (usamos `process.env.PORT`).
6. Verifica salud: abre `https://<tu-dominio>.railway.app/api/health` y debería responder `{ ok: true, db: true }`.

### Conectar desde tu frontend (GitHub Pages)

En tu código del frontend, apunta a la URL pública del backend en Railway, por ejemplo:

```
// Opción A: Define window.API_BASE en tu index.html de GitHub Pages antes de cargar script.js
<script>window.API_BASE = 'https://<tu-dominio>.railway.app';</script>

// Opción B: Guarda la URL una vez desde la consola del navegador en tu página de GitHub Pages
localStorage.setItem('API_BASE', 'https://<tu-dominio>.railway.app')

// Desde el código, script.js ya usará esa base automáticamente
fetch(`/api/clientes`) // internamente se llamará a ${API_BASE}/api/clientes
	.then(r => r.json())
	.then(console.log);
```

Este backend tiene CORS abierto por defecto, por lo que GitHub Pages puede consumir la API sin cambios adicionales.

### Ejecutar localmente

1. Instalar dependencias
2. Crear `.env` a partir de `.env.example`
3. Levantar en modo desarrollo

```
npm install
npm run dev
```

Abre `http://localhost:5175/api/health` para probar. El frontend local está en `public/` y también se sirve desde el mismo puerto si lo necesitas (`/`).

### Esquema SQL

El archivo `esquema.sql` contiene la estructura de tablas. Cárgalo en tu MySQL antes de iniciar la app (local o en Railway). En Railway puedes usar el panel SQL o cualquier cliente apuntando al host, puerto y credenciales que te entrega el plugin de MySQL.

### Notas

- `server.js` ya acepta tanto variables `DB_*` como las `MYSQL*` de Railway.
- Scripts disponibles: `npm start` (producción) y `npm run dev` (watch con nodemon).

