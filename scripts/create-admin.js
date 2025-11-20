import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

dotenv.config();

const poolBD = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DB || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

async function ejecutar() {
  const [,, argUsuario, argContrasena, argCorreo] = process.argv;
  const nombreUsuario = (argUsuario || process.env.ADMIN_USER || 'admin').toString();
  const contrasena = (argContrasena || process.env.ADMIN_PASS || 'admin123').toString();
  const correoAdmin = (argCorreo || process.env.ADMIN_EMAIL || 'admin@example.com').toString();

  if (!nombreUsuario || !contrasena) {
    console.error('Faltan credenciales. Uso: node scripts/create-admin.js <usuario> <contrasena> [correo]');
    process.exit(1);
  }

  console.log('Conectando a la base de datos...');
  const conexion = await poolBD.getConnection();
  try {
    await conexion.query('SELECT 1');

    const [registroExistente] = await conexion.query('SELECT idUsuario FROM usuarios WHERE nombre_usuario = ? LIMIT 1', [nombreUsuario]);
    const hashContrasena = await bcrypt.hash(contrasena, 10);

    if (registroExistente.length) {
      const idAdmin = registroExistente[0].idUsuario;
      const [resultadoActualizacion] = await conexion.query(
        'UPDATE usuarios SET contraseña = ?, rol = "Administrador", idEmpleado = NULL, Correo = ? WHERE idUsuario = ?',
        [hashContrasena, correoAdmin || null, idAdmin]
      );
      console.log(`Administrador actualizado: ${nombreUsuario} (id=${idAdmin}). Filas afectadas: ${resultadoActualizacion.affectedRows}`);
    } else {
      const [resultadoInsercion] = await conexion.query(
        'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, Correo) VALUES (?, ?, "Administrador", NULL, ?)',
        [nombreUsuario, hashContrasena, correoAdmin || null]
      );
      console.log(`Administrador creado: ${nombreUsuario} (id=${resultadoInsercion.insertId})`);
    }
    console.log('Operación completada. Intenta iniciar sesión con esas credenciales.');
  } catch (error) {
    console.error('Error al crear/actualizar el administrador:', error.message);
    process.exitCode = 1;
  } finally {
    conexion.release();
    await poolBD.end();
  }
}

ejecutar();
