Frontend con HTML/CSS/JS y backend con Node.js/Express conectado a MySQL.

## Configuración de la base de datos
1. Asegúrate de tener MySQL corriendo y un usuario `root` con la contraseña indicada.
2. Importa el archivo `esquema.sql` para crear la BD y tablas.

## Variables de entorno
El archivo `.env` ya está creado con:
```
DB_HOST=127.0.0.1
DB_PORT=3305
DB_USER=root
DB_PASSWORD=L1973284650
DB_NAME=Proyecto
PORT=5175
```

##ejecutar 
```powershell
# Ir a la carpeta del proyecto
Set-Location "c:\Users\diazl\OneDrive\Desktop\Proyectoo"

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (con reinicio automático)
npm run dev

# (opcional) Ejecutar normal
# npm start
```

Luego abre: http://localhost:5175

## Endpoints
- GET `/api/health`
- GET `/api/clientes`
- POST `/api/clientes` { Nombre, Documento, Telefono?, Correo? }
- GET `/api/proyectos`

## Estructura
- `server.js`: servidor Express + conexión MySQL
- `public/`: HTML/CSS/JS muy básico
- `esquema.sql`: creación de tablas

=======
# Proyecto-DB
Proyecto de Alejandro Diaz, Karen Cagua y Miguel Montañez
>>>>>>> 3d2e47b081e2ce3fb434cc92425bb2a29444c9b3
