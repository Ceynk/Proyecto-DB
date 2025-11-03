import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
// Handle CORS preflight for all routes (needed for POST with application/json)
app.options('*', cors());
app.use(express.json());

// Sessions (in-memory store for dev)
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-please-change',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Sin maxAge: cookie de sesión (se borra al cerrar el navegador)
    }
  })
);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
// Static uploads
const dirSubidas = path.join(__dirname, 'uploads');
if (!fs.existsSync(dirSubidas)) {
  fs.mkdirSync(dirSubidas, { recursive: true });
}
app.use('/uploads', express.static(dirSubidas));

// Create a MySQL connection pool
// Support both custom DB_* env vars and Railway defaults (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE)
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DB || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ensure schema (extra columns) and seed admin user
async function asegurarEsquemaYSemilla() {
  try {
    const [c2] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'foto_url'");
    if (c2.length === 0) {
      await pool.query("ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(255) NULL");
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar columna foto_url:', e.message);
  }
  try {
    const [cu] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'Correo'");
    if (cu.length === 0) {
      await pool.query("ALTER TABLE usuarios ADD COLUMN Correo VARCHAR(120) NULL");
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar columna usuarios.Correo:', e.message);
  }
  try {
    const [ce] = await pool.query("SHOW COLUMNS FROM empleados LIKE 'foto_url'");
    if (ce.length === 0) {
      await pool.query("ALTER TABLE empleados ADD COLUMN foto_url VARCHAR(255) NULL");
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar empleados.foto_url:', e.message);
  }
  try {
    const [cm] = await pool.query("SHOW COLUMNS FROM materials LIKE 'foto_url'");
    if (cm.length === 0) {
      await pool.query("ALTER TABLE materials ADD COLUMN foto_url VARCHAR(255) NULL");
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar materials.foto_url:', e.message);
  }
  // Agregar fechas a tareas si faltan
  try {
    const [fi] = await pool.query("SHOW COLUMNS FROM tareas LIKE 'Fecha_inicio'");
    if (fi.length === 0) {
      await pool.query('ALTER TABLE tareas ADD COLUMN Fecha_inicio DATE NULL');
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar tareas.Fecha_inicio:', e.message);
  }
  try {
    const [ff] = await pool.query("SHOW COLUMNS FROM tareas LIKE 'Fecha_fin'");
    if (ff.length === 0) {
      await pool.query('ALTER TABLE tareas ADD COLUMN Fecha_fin DATE NULL');
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar tareas.Fecha_fin:', e.message);
  }
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE rol='Administrador'");
    if (rows[0].n === 0) {
      const username = process.env.ADMIN_USER || 'admin';
      const password = process.env.ADMIN_PASS || 'admin123';
      const correo = process.env.ADMIN_EMAIL || 'admin@example.com';
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, Correo) VALUES (?, ?, 'Administrador', NULL, ?)",
        [username, hash, correo]
      );
      console.log(`Usuario admin creado: ${username} (contraseña en .env o 'admin123', correo ${correo})`);
    }
  } catch (e) {
    console.warn('No se pudo crear admin por defecto:', e.message);
  }
}

// Entidades permitidas con columnas, joins (vistas) y campos buscables
// Para tablas más claras se hacen JOINs y alias
const entidades = {
  empleado: {
    desde: 'empleados e LEFT JOIN proyectos p ON p.idProyecto = e.idProyecto',
    tabla: 'empleados',
    llavePrimaria: 'idEmpleado',
    columnas: [
      'e.idEmpleado AS idEmpleado',
      'e.Nombre AS Nombre',
      'e.Correo AS Correo',
      'e.Telefono AS Telefono',
      'e.Asistencia AS Asistencia',
      'e.Especialidad AS Especialidad',
      'e.foto_url AS foto_url',
      'p.Nombre AS Proyecto'
    ],
    busqueda: ['e.Nombre','e.Correo','e.Telefono','e.Especialidad','p.Nombre'],
    ordenarPor: 'idEmpleado'
  },
  cliente: {
    desde: 'clientes c',
    tabla: 'clientes',
    llavePrimaria: 'idCliente',
    columnas: ['c.idCliente AS idCliente','c.Nombre AS Nombre','c.Telefono AS Telefono','c.Correo AS Correo'],
    busqueda: ['c.Nombre','c.Telefono','c.Correo'],
    ordenarPor: 'idCliente'
  },
  proyecto: {
    desde: 'proyectos p LEFT JOIN clientes c ON c.idCliente = p.idCliente',
    tabla: 'proyectos',
    llavePrimaria: 'idProyecto',
    columnas: ['p.idProyecto AS idProyecto','p.Nombre AS Nombre','c.Nombre AS Cliente'],
    busqueda: ['p.Nombre','c.Nombre'],
    ordenarPor: 'idProyecto'
  },
  apartamento: {
    desde: 'apartamentos a LEFT JOIN proyectos p ON p.idProyecto = a.idProyecto',
    tabla: 'apartamentos',
    llavePrimaria: 'idApartamento',
    columnas: ['a.idApartamento AS idApartamento','a.num_apartamento AS num_apartamento','a.num_piso AS num_piso','a.estado AS estado','p.Nombre AS Proyecto'],
    busqueda: ['a.estado','p.Nombre'],
    ordenarPor: 'idApartamento'
  },
  piso: {
    desde: 'pisos s LEFT JOIN proyectos p ON p.idProyecto = s.idProyecto LEFT JOIN apartamentos a ON a.idApartamento = s.idApartamento',
    tabla: 'pisos',
    llavePrimaria: 'idPiso',
    columnas: ['s.idPiso AS idPiso','p.Nombre AS Proyecto','s.numero AS numero','a.num_apartamento AS Apartamento'],
    busqueda: ['p.Nombre','s.numero','a.num_apartamento'],
    ordenarPor: 'idPiso'
  },
  material: {
    desde: 'materials m',
    tabla: 'materials',
    llavePrimaria: 'idMaterial',
    columnas: ['m.idMaterial AS idMaterial','m.Nombre AS Nombre','m.costo_unitario AS costo_unitario','m.tipo AS tipo','m.foto_url AS foto_url'],
    busqueda: ['m.Nombre','m.tipo'],
    ordenarPor: 'idMaterial'
  },
  inventario: {
    desde: 'inventarios i LEFT JOIN materials m ON m.idMaterial = i.idMaterial LEFT JOIN proyectos p ON p.idProyecto = i.idProyecto',
    tabla: 'inventarios',
    llavePrimaria: 'idInventario',
    columnas: ['i.idInventario AS idInventario','i.tipo_movimiento AS tipo_movimiento','i.cantidad AS cantidad','i.fecha AS fecha','i.idMaterial AS idMaterial','m.Nombre AS Material','p.Nombre AS Proyecto'],
    busqueda: ['i.tipo_movimiento','m.Nombre','p.Nombre'],
    ordenarPor: 'idInventario'
  },
  ingreso: {
    desde: 'ingresos g LEFT JOIN proyectos p ON p.idProyecto = g.idProyecto',
    tabla: 'ingresos',
    llavePrimaria: 'idIngreso',
    columnas: ['g.idIngreso AS idIngreso','g.fecha AS fecha','g.Valor AS Valor','g.Descripcion AS Descripcion','p.Nombre AS Proyecto'],
    busqueda: ['g.Descripcion','p.Nombre'],
    ordenarPor: 'idIngreso'
  },
  gasto: {
    desde: 'gastos g LEFT JOIN proyectos p ON p.idProyecto = g.idProyecto',
    tabla: 'gastos',
    llavePrimaria: 'idGasto',
    columnas: ['g.idGasto AS idGasto','g.Valor AS Valor','g.Descripcion AS Descripcion','g.fecha AS fecha','p.Nombre AS Proyecto'],
    busqueda: ['g.Descripcion','p.Nombre'],
    ordenarPor: 'idGasto'
  },
  factura: {
    desde: 'facturas f LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto LEFT JOIN clientes c ON c.idCliente = f.idCliente',
    tabla: 'facturas',
    llavePrimaria: 'idFactura',
    columnas: ['f.idFactura AS idFactura','f.Fecha AS Fecha','f.Valor_total AS Valor_total','p.Nombre AS Proyecto','c.Nombre AS Cliente'],
    busqueda: ['p.Nombre','c.Nombre'],
    ordenarPor: 'idFactura'
  },
  pago: {
    desde: 'pagos y LEFT JOIN facturas f ON f.idFactura = y.idFactura',
    tabla: 'pagos',
    llavePrimaria: 'idPago',
    columnas: ['y.idPago AS idPago','y.Fecha AS Fecha','y.Monto AS Monto','CONCAT("Factura ", f.idFactura) AS Factura'],
    busqueda: ['y.Monto','f.idFactura'],
    ordenarPor: 'idPago'
  },
  tarea: {
    desde: 'tareas t LEFT JOIN proyectos p ON p.idProyecto = t.idProyecto LEFT JOIN empleados e ON e.idEmpleado = t.idEmpleado',
    tabla: 'tareas',
    llavePrimaria: 'idTarea',
    columnas: ['t.idTarea AS idTarea','t.Descripcion AS Descripcion','t.Estado AS Estado','p.Nombre AS Proyecto','e.Nombre AS Empleado'],
    busqueda: ['t.Descripcion','t.Estado','p.Nombre','e.Nombre'],
    ordenarPor: 'idTarea'
  },
  turno: {
    desde: 'turnos u LEFT JOIN empleados e ON e.idEmpleado = u.idEmpleado',
    tabla: 'turnos',
    llavePrimaria: 'idTurno',
    columnas: ['u.idTurno AS idTurno','u.Hora_inicio AS Hora_inicio','u.Hora_fin AS Hora_fin','u.Tipo_jornada AS Tipo_jornada','e.Nombre AS Empleado'],
    busqueda: ['u.Tipo_jornada','e.Nombre'],
    ordenarPor: 'idTurno'
  }
};

// Multer (uploads)
const almacenamiento = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, dirSubidas);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'foto', ext).replace(/[^a-z0-9_-]/gi, '_');
    const fname = `${Date.now()}_${Math.random().toString(36).slice(2)}_${base}${ext}`;
    cb(null, fname);
  }
});
const tiposPermitidos = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const subida = multer({
  storage: almacenamiento,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '').toLowerCase()) || '';
    if (!tiposPermitidos.has(ext)) {
      return cb(new Error('Tipo de archivo no permitido. Usa JPG, PNG o WEBP.'));
    }
    cb(null, true);
  }
});

// ---

// Email/2FA settings
// If EMAIL_2FA_REQUIRED is set to 'true', email verification becomes mandatory.
// When it's 'false' (default), the app will attempt email verification if possible,
// but will allow login to proceed if no email is available or SMTP isn't configured.
const EMAIL_2FA_REQUIRED = String(process.env.EMAIL_2FA_REQUIRED || 'false').toLowerCase() === 'true';
const smtpConfigured = !!process.env.SMTP_HOST; // simple check is enough for our transport

// Email transporter (SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});

// --- Auth helpers ---
const requerirAutenticacion = (req, res, next) => {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'No autenticado' });
};

const requerirAdmin = (req, res, next) => {
  if (req.session?.user?.rol === 'Administrador') return next();
  return res.status(403).json({ error: 'Requiere rol Administrador' });
};

const requerirEmpleado = (req, res, next) => {
  const rol = req.session?.user?.rol;
  if (rol === 'Empleado' || rol === 'Administrador') return next();
  return res.status(403).json({ error: 'Requiere rol Empleado' });
};

const requerirContador = (req, res, next) => {
  const rol = req.session?.user?.rol;
  if (rol === 'Contador' || rol === 'Administrador') return next();
  return res.status(403).json({ error: 'Requiere rol Contador' });
};

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  try {
    const [filas] = await pool.query(
      'SELECT idUsuario, nombre_usuario, contraseña, rol, idEmpleado, Correo FROM usuarios WHERE nombre_usuario = ? LIMIT 1',
      [username]
    );
    if (!filas || filas.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const u = filas[0];
    let ok = false;
    const hash = u.contraseña || '';
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      ok = await bcrypt.compare(password, hash);
    } else {
      ok = password === hash; // fallback para contraseñas en texto plano
    }
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    // Enviar código por correo
    let correoDestino = u.Correo || null;
    if (!correoDestino && u.idEmpleado) {
      const [erows] = await pool.query('SELECT Correo FROM empleados WHERE idEmpleado = ? LIMIT 1', [u.idEmpleado]);
      correoDestino = erows[0]?.Correo || null;
    }

    // Si la verificación por correo no es obligatoria y no hay correo o SMTP,
    // permitir el acceso directo (útil en desarrollo o entornos sin email configurado).
    if (!EMAIL_2FA_REQUIRED && (!correoDestino || !smtpConfigured)) {
      req.session.user = {
        idUsuario: u.idUsuario,
        nombre_usuario: u.nombre_usuario,
        rol: u.rol,
        idEmpleado: u.idEmpleado || null
      };
      return res.json({ ok: true, requiresEmail: false, user: req.session.user });
    }

    if (!correoDestino) return res.status(400).json({ error: 'El usuario no tiene correo registrado' });

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const vence = Date.now() + 5 * 60 * 1000; // 5 minutos
    req.session.pendingEmail = { idUsuario: u.idUsuario, code, vence };

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com',
        to: correoDestino,
        subject: 'Tu código de acceso',
        text: `Tu código es: ${code} (vigente por 5 minutos)`,
        html: `<p>Tu código es: <b>${code}</b></p><p>Vigente por 5 minutos.</p>`
      });
    } catch (e) {
      if (!EMAIL_2FA_REQUIRED) {
        // Permitir acceso si no es obligatorio y el envío falla (p. ej., SMTP no disponible)
        req.session.user = {
          idUsuario: u.idUsuario,
          nombre_usuario: u.nombre_usuario,
          rol: u.rol,
          idEmpleado: u.idEmpleado || null
        };
        return res.json({ ok: true, requiresEmail: false, user: req.session.user });
      }
      return res.status(500).json({ error: 'No se pudo enviar el correo, verifica configuración SMTP' });
    }

    return res.json({ ok: true, requiresEmail: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Session info
app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

// Verificar código enviado por correo
app.post('/api/auth/verify-email', async (req, res) => {
  const { code } = req.body || {};
  const pending = req.session?.pendingEmail;
  if (!pending?.idUsuario) return res.status(400).json({ error: 'No hay verificación pendiente' });
  if (!code) return res.status(400).json({ error: 'Código requerido' });
  if (Date.now() > pending.vence) return res.status(400).json({ error: 'Código expirado' });
  if (String(code).trim() !== String(pending.code)) return res.status(401).json({ error: 'Código incorrecto' });
  try {
    const [filas] = await pool.query('SELECT idUsuario, nombre_usuario, rol, idEmpleado FROM usuarios WHERE idUsuario = ?', [pending.idUsuario]);
    if (!filas.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const u = filas[0];
    req.session.user = { idUsuario: u.idUsuario, nombre_usuario: u.nombre_usuario, rol: u.rol, idEmpleado: u.idEmpleado || null };
    delete req.session.pendingEmail;
    res.json({ ok: true, user: req.session.user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List available entities (admin)
app.get('/api/entities', requerirAutenticacion, requerirAdmin, (req, res) => {
  res.json(Object.keys(entidades));
});

// Generic list with optional text search (?q=)
app.get('/api/list/:entity', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  if (!definicion) return res.status(400).json({ error: 'Entidad no valida' });
  const busqueda = (req.query.q || '').toString().trim();

  try {
    const columnas = definicion.columnas.join(', ');
    const desde = definicion.desde || definicion.tabla;
    let sql = `SELECT ${columnas} FROM ${desde}`;
    const parametros = [];
    if (busqueda && definicion.busqueda && definicion.busqueda.length) {
      const coincidencias = definicion.busqueda.map((c) => `${c} LIKE ?`).join(' OR ');
      sql += ` WHERE ${coincidencias}`;
      definicion.busqueda.forEach(() => parametros.push(`%${busqueda}%`));
    }
    const ordenarPor = definicion.ordenarPor || '1';
    sql += ` ORDER BY ${ordenarPor} DESC LIMIT 100`;
    const [filas2] = await pool.query(sql, parametros);
    res.json(filas2);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mapa de columnas permitidas para crear registros
const columnasCrear = {
  cliente: ['Nombre','Telefono','Correo'],
  proyecto: ['Nombre','idCliente'],
  apartamento: ['num_apartamento','num_piso','estado','idProyecto'],
  piso: ['idProyecto','numero','idApartamento'],
  material: ['Nombre','costo_unitario','tipo'],
  empleado: ['Nombre','Correo','Telefono','Asistencia','Especialidad','idProyecto'],
  turno: ['Hora_inicio','Hora_fin','Tipo_jornada','idEmpleado'],
  tarea: ['Descripcion','Estado','Fecha_inicio','Fecha_fin','idProyecto','idEmpleado'],
  inventario: ['tipo_movimiento','cantidad','fecha','idMaterial','idProyecto'],
  ingreso: ['fecha','Valor','Descripcion','idProyecto'],
  gasto: ['Valor','Descripcion','fecha','idProyecto'],
  factura: ['Fecha','Valor_total','idProyecto','idCliente'],
  pago: ['Fecha','Monto','idFactura']
};

// Generic create
app.post('/api/create/:entity', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  const cols = columnasCrear[entidad];
  if (!definicion || !cols) return res.status(400).json({ error: 'Entidad no valida' });
  try {
    const values = cols.map((c) => (req.body && Object.prototype.hasOwnProperty.call(req.body, c)) ? req.body[c] : null);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${definicion.tabla} (${cols.join(', ')}) VALUES (${placeholders})`;
    const [resultado] = await pool.query(sql, values);
    res.status(201).json({ id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update (admin)
app.put('/api/update/:entity/:id', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  const cols = columnasCrear[entidad];
  const id = req.params.id;
  if (!definicion || !cols) return res.status(400).json({ error: 'Entidad no valida' });
  if (!id) return res.status(400).json({ error: 'ID requerido' });
  try {
    const toUpdate = Object.keys(req.body || {}).filter((k) => cols.includes(k));
    if (toUpdate.length === 0) return res.status(400).json({ error: 'Nada para actualizar' });
    const setClause = toUpdate.map((k) => `${k} = ?`).join(', ');
    const values = toUpdate.map((k) => req.body[k]);
    const sql = `UPDATE ${definicion.tabla} SET ${setClause} WHERE ${definicion.tabla}.${definicion.llavePrimaria} = ?`;
    values.push(id);
    const [resultado] = await pool.query(sql, values);
    res.json({ ok: true, affectedRows: resultado.affectedRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete (admin)
app.delete('/api/delete/:entity/:id', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  const id = req.params.id;
  if (!definicion) return res.status(400).json({ error: 'Entidad no valida' });
  if (!id) return res.status(400).json({ error: 'ID requerido' });
  try {
    // Eliminación segura con limpieza de referencias para empleado
    if (entidad === 'empleado') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // Obtener foto para intentar borrarla luego
        const [info] = await conn.query('SELECT foto_url FROM empleados WHERE idEmpleado = ? LIMIT 1', [id]);
        // Desvincular referencias
        await conn.query('UPDATE tareas SET idEmpleado = NULL WHERE idEmpleado = ?', [id]);
        await conn.query('UPDATE turnos SET idEmpleado = NULL WHERE idEmpleado = ?', [id]);
        await conn.query('UPDATE usuarios SET idEmpleado = NULL WHERE idEmpleado = ?', [id]);
        // Eliminar empleado
        const [del] = await conn.query('DELETE FROM empleados WHERE idEmpleado = ?', [id]);
        await conn.commit();

        // Borrar imagen si aplica
        try {
          const anterior = info[0]?.foto_url;
          if (anterior && anterior.startsWith('/uploads/')) {
            const fpath = resolverRutaArchivo(anterior);
            if (fpath && fs.existsSync(fpath)) fs.unlinkSync(fpath);
          }
        } catch (_) { /* ignorar */ }

        conn.release();
        return res.json({ ok: true, affectedRows: del.affectedRows });
      } catch (e) {
        try { await conn.rollback(); } catch (_) {}
        conn.release();
        return res.status(500).json({ error: e.message });
      }
    }

    // Por defecto: borrado directo
    const sql = `DELETE FROM ${definicion.tabla} WHERE ${definicion.tabla}.${definicion.llavePrimaria} = ?`;
    const [resultado] = await pool.query(sql, [id]);
    res.json({ ok: true, affectedRows: resultado.affectedRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Version/info endpoints
app.get('/api/version', (req, res) => {
  res.json({
    ok: true,
    entities: Object.keys(entidades),
    creatable: Object.keys(columnasCrear)
  });
});

app.get('/api/check/:entity', (req, res) => {
  const e = String(req.params.entity || '').toLowerCase();
  res.json({
    entity: e,
    known: !!entidades[e],
    creatable: !!columnasCrear[e],
    listColumns: entidades[e]?.columnas || [],
    createColumns: columnasCrear[e] || []
  });
});

// Diagnóstico simple para imágenes: verifica si existen columnas foto_url
app.get('/api/diag/images', async (req, res) => {
  const resultado = { usuarios: false, empleados: false, materials: false, detalles: {} };
  try {
    const [u] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'foto_url'");
    resultado.usuarios = u.length > 0;
    resultado.detalles.usuarios = u;
  } catch (e) {
    resultado.detalles.usuarios = { error: e.message };
  }
  try {
    const [e] = await pool.query("SHOW COLUMNS FROM empleados LIKE 'foto_url'");
    resultado.empleados = e.length > 0;
    resultado.detalles.empleados = e;
  } catch (e2) {
    resultado.detalles.empleados = { error: e2.message };
  }
  try {
    const [m] = await pool.query("SHOW COLUMNS FROM materials LIKE 'foto_url'");
    resultado.materials = m.length > 0;
    resultado.detalles.materials = m;
  } catch (e3) {
    resultado.detalles.materials = { error: e3.message };
  }
  res.json(resultado);
});

// Simple health endpoint
app.get('/api/health', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: filas[0].ok === 1 });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// List clientes (very basic)
app.get('/api/clientes', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente, Nombre, Telefono, Correo FROM clientes ORDER BY idCliente DESC LIMIT 50');
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List proyectos with cliente name if available
app.get('/api/proyectos', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query(`
      SELECT p.idProyecto, p.Nombre AS Proyecto, c.Nombre AS Cliente
      FROM proyectos p
      LEFT JOIN clientes c ON c.idCliente = p.idCliente
      ORDER BY p.idProyecto DESC
      LIMIT 50
    `);
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a super simple POST to add a cliente
app.post('/api/clientes', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const { Nombre, Telefono, Correo } = req.body || {};
  if (!Nombre) {
    return res.status(400).json({ error: 'Nombre es obligatorio' });
  }
  try {
    const [resultado] = await pool.query(
      'INSERT INTO clientes (Nombre, Telefono, Correo) VALUES (?, ?, ?)',
      [Nombre, Telefono || null, Correo || null]
    );
    res.status(201).json({ idCliente: resultado.insertId, Nombre, Telefono, Correo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Minimal lists for relations (id and name-ish)
app.get('/api/min/clientes', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente as id, Nombre as nombre FROM clientes ORDER BY idCliente DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/proyectos', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idProyecto as id, Nombre as nombre FROM proyectos ORDER BY idProyecto DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/empleados', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idEmpleado as id, Nombre as nombre FROM empleados ORDER BY idEmpleado DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/materiales', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idMaterial as id, Nombre as nombre FROM materials ORDER BY idMaterial DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/facturas', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idFactura as id, CONCAT("Factura ", idFactura) as nombre FROM facturas ORDER BY idFactura DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear admin con foto (multipart)
app.post('/api/admin/create', requerirAutenticacion, requerirAdmin, subida.single('foto'), async (req, res) => {
  try {
    const { username, password, correo } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });
    const [exist] = await pool.query('SELECT idUsuario FROM usuarios WHERE nombre_usuario = ?', [username]);
    if (exist.length) return res.status(400).json({ error: 'Usuario ya existe' });
    const hash = await bcrypt.hash(password, 10);
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    const [r] = await pool.query(
      'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, foto_url, Correo) VALUES (?, ?, "Administrador", NULL, ?, ?)',
      [username, hash, foto_url, correo || null]
    );
    res.status(201).json({ idUsuario: r.insertId, username, foto_url, correo: correo || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listar administradores
app.get('/api/admin/users', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT idUsuario, nombre_usuario, rol, idEmpleado, foto_url, Correo FROM usuarios WHERE rol = ? ORDER BY idUsuario DESC',
      ['Administrador']
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eliminar administrador con validaciones
app.delete('/api/admin/users/:id', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    if (req.session?.user?.idUsuario === id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }
    const [countAdmins] = await pool.query('SELECT COUNT(*) AS n FROM usuarios WHERE rol = "Administrador"');
    if (countAdmins[0]?.n <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
    }
    const [rows] = await pool.query('SELECT idUsuario, rol, foto_url FROM usuarios WHERE idUsuario = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const u = rows[0];
    if (u.rol !== 'Administrador') return res.status(400).json({ error: 'El usuario no es Administrador' });

    // Intentar borrar la imagen asociada si apunta a /uploads
    if (u.foto_url && u.foto_url.startsWith('/uploads/')) {
      try {
        const fpath = resolverRutaArchivo(u.foto_url);
        if (fpath && fs.existsSync(fpath)) fs.unlinkSync(fpath);
      } catch (_) { /* ignorar */ }
    }

    const [del] = await pool.query('DELETE FROM usuarios WHERE idUsuario = ?', [id]);
    res.json({ ok: true, affectedRows: del.affectedRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================
// Gestión general de usuarios
// ==========================

// Listar todos los usuarios (cualquier rol)
app.get('/api/users', requerirAutenticacion, requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT idUsuario, nombre_usuario, rol, idEmpleado, foto_url, Correo FROM usuarios ORDER BY idUsuario DESC'
    );
    res.json(filas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear usuario (Admin/Contador/Empleado) con foto opcional
app.post('/api/users/create', requerirAutenticacion, requerirAdmin, subida.single('foto'), async (req, res) => {
  try {
    const { username, password, rol = 'Empleado', idEmpleado, correo } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });
    const rolValido = ['Administrador','Contador','Empleado'];
    if (!rolValido.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    // Validar unicidad de username
    const [existe] = await pool.query('SELECT 1 FROM usuarios WHERE nombre_usuario = ? LIMIT 1', [username]);
    if (existe.length) return res.status(400).json({ error: 'Usuario ya existe' });

    // Si se enlaza a empleado, validar que exista
    let idEmpleadoFinal = null;
    if (idEmpleado != null && idEmpleado !== '') {
      const [emp] = await pool.query('SELECT idEmpleado FROM empleados WHERE idEmpleado = ? LIMIT 1', [idEmpleado]);
      if (!emp.length) return res.status(400).json({ error: 'Empleado no existe' });
      idEmpleadoFinal = Number(idEmpleado);
    }

    const hash = await bcrypt.hash(password, 10);
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    const [r] = await pool.query(
      'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, foto_url, Correo) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hash, rol, idEmpleadoFinal, foto_url, correo || null]
    );
    res.status(201).json({ idUsuario: r.insertId, username, rol, idEmpleado: idEmpleadoFinal, foto_url, correo: correo || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// Fotos para Empleados y Materiales
// ==============================

function resolverRutaArchivo(posibleUrl) {
  if (!posibleUrl) return null;
  let fpath = posibleUrl;
  if (fpath.startsWith('/')) fpath = fpath.slice(1);
  if (!path.isAbsolute(fpath)) {
    fpath = path.join(__dirname, fpath);
  }
  return fpath;
}

// Subir/actualizar foto de un empleado
app.post('/api/empleados/:id/foto', requerirAutenticacion, requerirAdmin, subida.single('foto'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de empleado inválido' });
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta archivo de imagen (campo "foto")' });
    const [rows] = await pool.query('SELECT foto_url FROM empleados WHERE idEmpleado = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado' });
    const anterior = rows[0].foto_url;
    const foto_url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE empleados SET foto_url = ? WHERE idEmpleado = ?', [foto_url, id]);

    // Borrar archivo anterior si existía y apunta a uploads
    try {
      if (anterior && anterior.startsWith('/uploads/')) {
        const fpath = resolverRutaArchivo(anterior);
        if (fpath && fs.existsSync(fpath)) fs.unlinkSync(fpath);
      }
    } catch (_) { /* ignorar */ }

    res.json({ ok: true, idEmpleado: id, foto_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Subir/actualizar foto de un material
app.post('/api/materiales/:id/foto', requerirAutenticacion, requerirAdmin, subida.single('foto'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de material inválido' });
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta archivo de imagen (campo "foto")' });
    const [rows] = await pool.query('SELECT foto_url FROM materials WHERE idMaterial = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Material no encontrado' });
    const anterior = rows[0].foto_url;
    const foto_url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE materials SET foto_url = ? WHERE idMaterial = ?', [foto_url, id]);

    // Borrar archivo anterior si existía y apunta a uploads
    try {
      if (anterior && anterior.startsWith('/uploads/')) {
        const fpath = resolverRutaArchivo(anterior);
        if (fpath && fs.existsSync(fpath)) fs.unlinkSync(fpath);
      }
    } catch (_) { /* ignorar */ }

    res.json({ ok: true, idMaterial: id, foto_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---

// Endpoints para empleado
app.get('/api/empleado/mis-datos', requerirAutenticacion, requerirEmpleado, async (req, res) => {
  const idEmp = req.session.user?.idEmpleado;
  if (!idEmp) return res.status(400).json({ error: 'Usuario sin empleado asociado' });
  try {
    const [rows] = await pool.query(
      `SELECT e.idEmpleado, e.Nombre, e.Correo, e.Telefono, e.Asistencia, e.Especialidad, e.foto_url AS foto_url,
              p.idProyecto, p.Nombre AS Proyecto, c.Nombre AS Cliente,
              (SELECT COUNT(*) FROM pisos s WHERE s.idProyecto = p.idProyecto) AS Pisos,
              (SELECT COUNT(*) FROM apartamentos a WHERE a.idProyecto = p.idProyecto) AS Apartamentos
       FROM empleados e
       LEFT JOIN proyectos p ON p.idProyecto = e.idProyecto
       LEFT JOIN clientes c ON c.idCliente = p.idCliente
       WHERE e.idEmpleado = ?`,
      [idEmp]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/empleado/asistencia', requerirAutenticacion, requerirEmpleado, async (req, res) => {
  const idEmp = req.session.user?.idEmpleado;
  if (!idEmp) return res.status(400).json({ error: 'Usuario sin empleado asociado' });
  const estado = (req.body?.estado || 'Presente').toString().slice(0, 20);
  try {
    const [resultado] = await pool.query(
      'UPDATE empleados SET Asistencia = ? WHERE idEmpleado = ?',
      [estado, idEmp]
    );
    res.json({ ok: true, estado, affectedRows: resultado.affectedRows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear empleado y (opcional) su usuario de acceso
app.post('/api/empleados/crear-con-usuario', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const {
    Nombre, Correo, Telefono, Asistencia, Especialidad, idProyecto,
    crear_usuario, nombre_usuario, contraseña, rol_usuario, correo_usuario
  } = req.body || {};

  if (!Nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [emp] = await conn.query(
      'INSERT INTO empleados (Nombre, Correo, Telefono, Asistencia, Especialidad, idProyecto) VALUES (?, ?, ?, ?, ?, ?)',
      [Nombre, Correo || null, Telefono || null, Asistencia || null, Especialidad || null, idProyecto || null]
    );
    const idEmpleado = emp.insertId;

    let idUsuario = null;
    const deberiaCrearUsuario = crear_usuario === true || crear_usuario === 'true' || crear_usuario === 1 || crear_usuario === '1' || crear_usuario === 'on';
    if (deberiaCrearUsuario) {
      if (!nombre_usuario || !contraseña) {
        throw new Error('Para crear usuario, se requieren nombre_usuario y contraseña');
      }
      const rolFinal = ['Empleado','Contador'].includes(rol_usuario) ? rol_usuario : 'Empleado';
      // Validar unicidad de nombre de usuario
      const [ex] = await conn.query('SELECT 1 FROM usuarios WHERE nombre_usuario = ? LIMIT 1', [nombre_usuario]);
      if (ex.length) throw new Error('El nombre de usuario ya existe');
      const hash = await bcrypt.hash(String(contraseña), 10);
      const idEmpleadoVincular = rolFinal === 'Empleado' ? idEmpleado : null;
      const [u] = await conn.query(
        'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, Correo) VALUES (?, ?, ?, ?, ?)',
        [nombre_usuario, hash, rolFinal, idEmpleadoVincular, correo_usuario || Correo || null]
      );
      idUsuario = u.insertId;
    }

    await conn.commit();
    res.status(201).json({ idEmpleado, idUsuario });
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Tareas del empleado autenticado
app.get('/api/empleado/mis-tareas', requerirAutenticacion, requerirEmpleado, async (req, res) => {
  const idEmp = req.session.user?.idEmpleado;
  if (!idEmp) return res.status(400).json({ error: 'Usuario sin empleado asociado' });
  try {
    const [filas] = await pool.query(
      `SELECT t.idTarea, t.Descripcion, t.Estado, p.Nombre AS Proyecto,
              t.Fecha_inicio, t.Fecha_fin,
              (SELECT COUNT(*) FROM pisos s WHERE s.idProyecto = t.idProyecto) AS Pisos,
              (SELECT COUNT(*) FROM apartamentos a WHERE a.idProyecto = t.idProyecto) AS Apartamentos
       FROM tareas t
       LEFT JOIN proyectos p ON p.idProyecto = t.idProyecto
       WHERE t.idEmpleado = ?
       ORDER BY t.idTarea DESC
       LIMIT 100`,
      [idEmp]
    );
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==========================
// Rutas para Contador
// ==========================

// Listado de inventario (con joins) accesible a Contador
app.get('/api/contador/inventario', requerirAutenticacion, requerirContador, async (req, res) => {
  const busqueda = (req.query.q || '').toString().trim();
  try {
    let sql = `SELECT i.idInventario AS idInventario, i.tipo_movimiento AS tipo_movimiento, i.cantidad AS cantidad, i.fecha AS fecha,
                      i.idMaterial AS idMaterial, m.Nombre AS Material, p.Nombre AS Proyecto
               FROM inventarios i
               LEFT JOIN materials m ON m.idMaterial = i.idMaterial
               LEFT JOIN proyectos p ON p.idProyecto = i.idProyecto`;
    const params = [];
    if (busqueda) {
      sql += ` WHERE i.tipo_movimiento LIKE ? OR m.Nombre LIKE ? OR p.Nombre LIKE ?`;
      params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
    }
    sql += ' ORDER BY i.idInventario DESC LIMIT 200';
    const [filas] = await pool.query(sql, params);
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear transacción de inventario (Entrada/Salida)
app.post('/api/contador/inventario', requerirAutenticacion, requerirContador, async (req, res) => {
  const { tipo_movimiento, cantidad, fecha, idMaterial, idProyecto } = req.body || {};
  if (!cantidad || !fecha || !idMaterial) return res.status(400).json({ error: 'cantidad, fecha e idMaterial son requeridos' });
  try {
    const [r] = await pool.query(
      'INSERT INTO inventarios (tipo_movimiento, cantidad, fecha, idMaterial, idProyecto) VALUES (?, ?, ?, ?, ?)',
      [tipo_movimiento || 'Entrada', Number(cantidad), fecha, idMaterial, idProyecto || null]
    );
    res.status(201).json({ idInventario: r.insertId });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear factura (Contador)
app.post('/api/contador/facturas', requerirAutenticacion, requerirContador, async (req, res) => {
  const { Fecha, Valor_total, idProyecto, idCliente } = req.body || {};
  if (!Fecha || !Valor_total || !idCliente) return res.status(400).json({ error: 'Fecha, Valor_total e idCliente son requeridos' });
  try {
    const [r] = await pool.query(
      'INSERT INTO facturas (Fecha, Valor_total, idProyecto, idCliente) VALUES (?, ?, ?, ?)',
      [Fecha, Number(Valor_total), idProyecto || null, idCliente]
    );
    res.status(201).json({ idFactura: r.insertId });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Listar facturas básicas para Contador
app.get('/api/contador/facturas', requerirAutenticacion, requerirContador, async (req, res) => {
  try {
    const [filas] = await pool.query(`
      SELECT f.idFactura, f.Fecha, f.Valor_total, p.Nombre AS Proyecto, c.Nombre AS Cliente
      FROM facturas f
      LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto
      LEFT JOIN clientes c ON c.idCliente = f.idCliente
      ORDER BY f.idFactura DESC
      LIMIT 200
    `);
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Generar PDF de factura
app.get('/api/contador/facturas/:id/pdf', requerirAutenticacion, requerirContador, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [rows] = await pool.query(`
      SELECT f.idFactura, f.Fecha, f.Valor_total,
             c.Nombre AS Cliente, c.Correo AS CorreoCliente, c.Telefono AS TelefonoCliente,
             p.Nombre AS Proyecto
      FROM facturas f
      LEFT JOIN clientes c ON c.idCliente = f.idCliente
      LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto
      WHERE f.idFactura = ?
      LIMIT 1
    `, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Factura no encontrada' });
    const factura = rows[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura_${id}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Encabezado
    doc
      .fontSize(20)
      .text('Factura', { align: 'right' })
      .moveDown(0.5);

    // Datos empresa (simples)
    doc
      .fontSize(12)
      .text('Empresa: BuildSmarts S.A.', { align: 'left' })
      .text('NIT: 900.000.000-1')
      .text('Dirección: Calle 1 # 2-3, Ciudad')
      .text('Teléfono: +57 300 000 0000')
      .moveDown();

    // Datos factura
    doc
      .fontSize(12)
      .text(`Factura N°: ${factura.idFactura}`)
      .text(`Fecha: ${new Date(factura.Fecha).toISOString().slice(0,10)}`)
      .text(`Proyecto: ${factura.Proyecto || '—'}`)
      .moveDown();

    // Datos cliente
    doc
      .fontSize(12)
      .text('Cliente:', { underline: true })
      .text(`Nombre: ${factura.Cliente || '—'}`)
      .text(`Correo: ${factura.CorreoCliente || '—'}`)
      .text(`Teléfono: ${factura.TelefonoCliente || '—'}`)
      .moveDown();

    // Concepto simple (no hay detalle en esquema)
    doc
      .fontSize(12)
      .text('Concepto:', { underline: true })
      .text('Servicios/Materiales facturados (detalle no disponible en el esquema actual)')
      .moveDown();

    // Total
    doc
      .fontSize(14)
      .text(`Valor Total: $ ${Number(factura.Valor_total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, { align: 'right' })
      .moveDown(2);

    doc
      .fontSize(10)
      .fillColor('#666')
      .text('Gracias por su compra.', { align: 'center' });

    doc.end();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Listas mínimas accesibles a Contador
app.get('/api/contador/min/clientes', requerirAutenticacion, requerirContador, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente as id, Nombre as nombre FROM clientes ORDER BY idCliente DESC LIMIT 300');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Resumen de proyectos para Contador
app.get('/api/contador/proyectos-resumen', requerirAutenticacion, requerirContador, async (req, res) => {
  try {
    const [filas] = await pool.query(`
      SELECT p.idProyecto, p.Nombre AS Proyecto, c.Nombre AS Cliente,
             (SELECT COUNT(*) FROM pisos s WHERE s.idProyecto = p.idProyecto) AS Pisos,
             (SELECT COUNT(*) FROM apartamentos a WHERE a.idProyecto = p.idProyecto) AS Apartamentos
      FROM proyectos p
      LEFT JOIN clientes c ON c.idCliente = p.idCliente
      ORDER BY p.idProyecto DESC
      LIMIT 300
    `);
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/contador/min/proyectos', requerirAutenticacion, requerirContador, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idProyecto as id, Nombre as nombre FROM proyectos ORDER BY idProyecto DESC LIMIT 300');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/contador/min/materiales', requerirAutenticacion, requerirContador, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idMaterial as id, Nombre as nombre FROM materials ORDER BY idMaterial DESC LIMIT 300');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Ensure unknown /api routes return JSON instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

const PORT = Number(process.env.PORT || 8080);
asegurarEsquemaYSemilla().finally(() => {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
});
