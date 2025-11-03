import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

dotenv.config();

// Resolve DB config similarly to server.js
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DB || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

async function main() {
  const [,, argUser, argPass, argEmail] = process.argv;
  const username = (argUser || process.env.ADMIN_USER || 'admin').toString();
  const password = (argPass || process.env.ADMIN_PASS || 'admin123').toString();
  const correo = (argEmail || process.env.ADMIN_EMAIL || 'admin@example.com').toString();

  if (!username || !password) {
    console.error('Faltan credenciales. Uso: node scripts/create-admin.js <usuario> <contraseña> [correo]');
    process.exit(1);
  }

  console.log('Conectando a la base de datos...');
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');

    // ¿Existe el usuario?
    const [existe] = await conn.query('SELECT idUsuario FROM usuarios WHERE nombre_usuario = ? LIMIT 1', [username]);
    const hash = await bcrypt.hash(password, 10);

    if (existe.length) {
      const id = existe[0].idUsuario;
      const [r] = await conn.query(
        'UPDATE usuarios SET contraseña = ?, rol = "Administrador", idEmpleado = NULL, Correo = ? WHERE idUsuario = ?',
        [hash, correo || null, id]
      );
      console.log(`Administrador actualizado: ${username} (id=${id}). Filas afectadas: ${r.affectedRows}`);
    } else {
      const [r] = await conn.query(
        'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, Correo) VALUES (?, ?, "Administrador", NULL, ?)',
        [username, hash, correo || null]
      );
      console.log(`Administrador creado: ${username} (id=${r.insertId})`);
    }
    console.log('Listo. Intenta iniciar sesión con esas credenciales.');
  } catch (e) {
    console.error('Error creando/actualizando administrador:', e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
