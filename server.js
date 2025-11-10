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
// Eliminado: autenticación por correo/2FA
import PDFDocument from 'pdfkit';
// Descarga opcional de modelos de face-api para hosting local (corrige nombres reales .bin)
import https from 'https';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  // Detrás de proxy (Railway) para que secure cookies funcionen
  app.set('trust proxy', 1);
}
app.use(cors());
app.options('*', cors());
app.use(express.json());

// Sessions (in-memory store para dev; en producción usar store persistente)
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-please-change',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd, // requiere HTTPS (Railway lo ofrece)
      // Sin maxAge: cookie de sesión (se borra al cerrar el navegador)
    }
  })
);

// Static files
// Ruta directa para servir face-api.min.js aunque falle la copia a /public/vendor
const faceApiMinPath = path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.min.js');
app.get('/vendor/face-api/face-api.min.js', (req, res) => {
  try {
    if (!fs.existsSync(faceApiMinPath)) {
      console.warn('face-api.min.js no encontrado en', faceApiMinPath);
      return res.status(404).type('text/plain').send('face-api.min.js not found');
    }
    res.type('application/javascript');
    fs.createReadStream(faceApiMinPath).pipe(res);
  } catch (e) {
    console.error('Error sirviendo face-api.min.js:', e.message);
    res.status(500).type('text/plain').send('Error interno');
  }
});
// Ruta adicional para servir la versión no minificada como fallback
const faceApiJsPath = path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.js');
app.get('/vendor/face-api/face-api.js', (req, res) => {
  try {
    if (!fs.existsSync(faceApiJsPath)) {
      console.warn('face-api.js no encontrado en', faceApiJsPath);
      return res.status(404).type('text/plain').send('face-api.js not found');
    }
    res.type('application/javascript');
    fs.createReadStream(faceApiJsPath).pipe(res);
  } catch (e) {
    console.error('Error sirviendo face-api.js:', e.message);
    res.status(500).type('text/plain').send('Error interno');
  }
});
app.use(express.static(path.join(__dirname, 'public')));
// Copiar assets de face-api a /public/vendor/face-api para servirlos con el static por si el mapeo directo a node_modules falla en producción
function asegurarFaceApiVendor() {
  try {
    const srcDir = path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'dist');
    const dstDir = path.join(__dirname, 'public', 'vendor', 'face-api');
    if (!fs.existsSync(srcDir)) {
      console.warn('face-api dist no encontrado en node_modules, verifique instalación.');
      return;
    }
    fs.mkdirSync(dstDir, { recursive: true });
    const archivos = ['face-api.min.js', 'face-api.min.js.map', 'face-api.js', 'face-api.js.map'];
    archivos.forEach((f) => {
      const src = path.join(srcDir, f);
      const dst = path.join(dstDir, f);
      try {
        if (fs.existsSync(src)) {
          const necesitaCopiar = !fs.existsSync(dst) || fs.statSync(dst).size === 0;
          if (necesitaCopiar) {
            fs.copyFileSync(src, dst);
            console.log('[face-api] Copiado', f, 'a', dst);
          }
        }
      } catch (e) {
        console.warn('No se pudo copiar', f, e.message);
      }
    });
    // Log listado final
    try {
      const lista = fs.readdirSync(dstDir);
      console.log('[face-api] Archivos en /public/vendor/face-api:', lista);
    } catch (_) {}
  } catch (e) {
    console.warn('Error asegurando vendor face-api:', e.message);
  }
}
asegurarFaceApiVendor();
// Además, intentar servir directamente desde node_modules como fallback
app.use('/vendor/face-api', express.static(path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'dist')));
// Static uploads
const dirSubidas = path.join(__dirname, 'uploads');
if (!fs.existsSync(dirSubidas)) {
  fs.mkdirSync(dirSubidas, { recursive: true });
}
app.use('/uploads', express.static(dirSubidas));

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
  // Descriptor facial para login con rostro
  try {
    const [cf] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'face_descriptor'");
    if (cf.length === 0) {
      await pool.query("ALTER TABLE usuarios ADD COLUMN face_descriptor LONGTEXT NULL");
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar usuarios.face_descriptor:', e.message);
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
  // Stock en materials + triggers de inventario
  try {
    const [cs] = await pool.query("SHOW COLUMNS FROM materials LIKE 'stock'");
    if (cs.length === 0) {
      await pool.query('ALTER TABLE materials ADD COLUMN stock INT NOT NULL DEFAULT 0');
      // Recalcular stock inicial desde inventarios si existe
      try {
        await pool.query(`
          UPDATE materials m
          LEFT JOIN (
            SELECT i.idMaterial,
                   SUM(CASE WHEN LOWER(i.tipo_movimiento) IN ('entrada','ingreso','compra') THEN i.cantidad
                            WHEN LOWER(i.tipo_movimiento) IN ('salida','consumo','uso') THEN -i.cantidad
                            ELSE 0 END) AS stock
            FROM inventarios i
            GROUP BY i.idMaterial
          ) t ON t.idMaterial = m.idMaterial
          SET m.stock = IFNULL(t.stock, 0);
        `);
      } catch (_) {}
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar materials.stock:', e.message);
  }
  // Crear tabla detalles de factura y columna Estado
  try {
    const [col] = await pool.query("SHOW COLUMNS FROM facturas LIKE 'Estado'");
    if (col.length === 0) {
      await pool.query("ALTER TABLE facturas ADD COLUMN Estado ENUM('Borrador','Emitida') DEFAULT 'Borrador'");
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar facturas.Estado:', e.message);
  }
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS factura_detalles (
      idDetalle INT AUTO_INCREMENT PRIMARY KEY,
      idFactura INT NOT NULL,
      idMaterial INT,
      cantidad INT NOT NULL,
      costo_unitario DECIMAL(12,2) NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (idFactura) REFERENCES facturas(idFactura),
      FOREIGN KEY (idMaterial) REFERENCES materials(idMaterial)
    )`);
  } catch (e) {
    console.warn('No se pudo crear tabla factura_detalles:', e.message);
  }
  // Intentar crear triggers para mantener stock
  try {
    await pool.query('DROP TRIGGER IF EXISTS trig_inventarios_ai');
    await pool.query(`CREATE TRIGGER trig_inventarios_ai AFTER INSERT ON inventarios FOR EACH ROW
      BEGIN
        IF NEW.idMaterial IS NOT NULL THEN
          IF LOWER(NEW.tipo_movimiento) IN ('entrada','ingreso','compra') THEN
            UPDATE materials SET stock = stock + NEW.cantidad WHERE idMaterial = NEW.idMaterial;
          ELSEIF LOWER(NEW.tipo_movimiento) IN ('salida','consumo','uso') THEN
            UPDATE materials SET stock = stock - NEW.cantidad WHERE idMaterial = NEW.idMaterial;
          END IF;
        END IF;
      END`);
  } catch (e) {
    console.warn('No se pudo crear trigger trig_inventarios_ai:', e.message);
  }
  try {
    await pool.query('DROP TRIGGER IF EXISTS trig_inventarios_au');
    await pool.query(`CREATE TRIGGER trig_inventarios_au AFTER UPDATE ON inventarios FOR EACH ROW
      BEGIN
        IF OLD.idMaterial IS NOT NULL THEN
          IF LOWER(OLD.tipo_movimiento) IN ('entrada','ingreso','compra') THEN
            UPDATE materials SET stock = stock - OLD.cantidad WHERE idMaterial = OLD.idMaterial;
          ELSEIF LOWER(OLD.tipo_movimiento) IN ('salida','consumo','uso') THEN
            UPDATE materials SET stock = stock + OLD.cantidad WHERE idMaterial = OLD.idMaterial;
          END IF;
        END IF;
        IF NEW.idMaterial IS NOT NULL THEN
          IF LOWER(NEW.tipo_movimiento) IN ('entrada','ingreso','compra') THEN
            UPDATE materials SET stock = stock + NEW.cantidad WHERE idMaterial = NEW.idMaterial;
          ELSEIF LOWER(NEW.tipo_movimiento) IN ('salida','consumo','uso') THEN
            UPDATE materials SET stock = stock - NEW.cantidad WHERE idMaterial = NEW.idMaterial;
          END IF;
        END IF;
      END`);
  } catch (e) {
    console.warn('No se pudo crear trigger trig_inventarios_au:', e.message);
  }
  try {
    await pool.query('DROP TRIGGER IF EXISTS trig_inventarios_ad');
    await pool.query(`CREATE TRIGGER trig_inventarios_ad AFTER DELETE ON inventarios FOR EACH ROW
      BEGIN
        IF OLD.idMaterial IS NOT NULL THEN
          IF LOWER(OLD.tipo_movimiento) IN ('entrada','ingreso','compra') THEN
            UPDATE materials SET stock = stock - OLD.cantidad WHERE idMaterial = OLD.idMaterial;
          ELSEIF LOWER(OLD.tipo_movimiento) IN ('salida','consumo','uso') THEN
            UPDATE materials SET stock = stock + OLD.cantidad WHERE idMaterial = OLD.idMaterial;
          END IF;
        END IF;
      END`);
  } catch (e) {
    console.warn('No se pudo crear trigger trig_inventarios_ad:', e.message);
  }
  // Asegurar enum de rol incluye 'Cliente'
  try {
    const [rolCol] = await pool.query(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'rol'
    `);
    const tipo = rolCol?.[0]?.COLUMN_TYPE || '';
    if (!/Cliente'\)/i.test(tipo) && !/Cliente'[,)]/i.test(tipo)) {
      await pool.query("ALTER TABLE usuarios MODIFY rol ENUM('Administrador','Contador','Empleado','Cliente') NOT NULL");
    }
  } catch (e) {
    console.warn('No se pudo asegurar enum usuarios.rol incluye Cliente:', e.message);
  }
  // Vinculación de usuarios con clientes
  try {
    const [cc] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'idCliente'");
    if (cc.length === 0) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN idCliente INT NULL');
      try {
        await pool.query('ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_clientes FOREIGN KEY (idCliente) REFERENCES clientes(idCliente)');
      } catch (_) { /* puede fallar si ya existe o por motor */ }
    }
  } catch (e) {
    console.warn('No se pudo verificar/agregar usuarios.idCliente:', e.message);
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
  // Exclusivo del rol Contador (el Administrador ya tiene su propio panel y rutas)
  if (rol === 'Contador') return next();
  return res.status(403).json({ error: 'Requiere rol Contador' });
};

const requerirCliente = (req, res, next) => {
  const rol = req.session?.user?.rol;
  if (rol === 'Cliente') return next();
  return res.status(403).json({ error: 'Requiere rol Cliente' });
};

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  try {
    const [filas] = await pool.query(
      'SELECT idUsuario, nombre_usuario, contraseña, rol, idEmpleado, idCliente, Correo FROM usuarios WHERE nombre_usuario = ? LIMIT 1',
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
    // Login sencillo: guardar usuario en sesión
    req.session.user = {
      idUsuario: u.idUsuario,
      nombre_usuario: u.nombre_usuario,
      rol: u.rol,
      idEmpleado: u.idEmpleado || null,
      idCliente: u.idCliente || null
    };
    return res.json({ ok: true, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login con rostro: compara descriptor actual con el almacenado para el usuario
app.post('/api/auth/login-face', async (req, res) => {
  try {
    const { username, descriptor } = req.body || {};
    if (!username || !descriptor) return res.status(400).json({ error: 'Faltan username y descriptor' });
    if (!Array.isArray(descriptor) || descriptor.length < 64) return res.status(400).json({ error: 'Descriptor inválido' });

    const [rows] = await pool.query(
      'SELECT idUsuario, nombre_usuario, rol, idEmpleado, idCliente, face_descriptor FROM usuarios WHERE nombre_usuario = ? LIMIT 1',
      [username]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });
    const u = rows[0];
    if (!u.face_descriptor) return res.status(400).json({ error: 'Usuario sin descriptor facial registrado' });

    let stored;
    try { stored = JSON.parse(u.face_descriptor); } catch (_) { stored = null; }
    if (!Array.isArray(stored) || stored.length === 0) {
      return res.status(400).json({ error: 'Descriptor facial almacenado inválido' });
    }
    const n = Math.min(stored.length, descriptor.length, 512);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const a = Number(descriptor[i]);
      const b = Number(stored[i]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return res.status(400).json({ error: 'Descriptor contiene valores inválidos' });
      }
      const d = a - b;
      sum += d * d;
    }
    const distancia = Math.sqrt(sum);
    // Umbral típico para face-api.js (TinyFace + FaceRecognitionNet): 0.45–0.6. Ajustable.
    const THRESHOLD = Number(process.env.FACE_LOGIN_THRESHOLD || 0.5);
    if (distancia > THRESHOLD) {
      return res.status(401).json({ error: 'Rostro no coincide' });
    }
    // Autenticar sesión
    req.session.user = {
      idUsuario: u.idUsuario,
      nombre_usuario: u.nombre_usuario,
      rol: u.rol,
      idEmpleado: u.idEmpleado || null,
      idCliente: u.idCliente || null
    };
    return res.json({ ok: true, user: req.session.user, distancia });
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

// Eliminado: endpoint de verificación por correo/2FA

// List available entities (admin)
app.get('/api/entities', requerirAutenticacion, requerirAdmin, (req, res) => {
  res.json(Object.keys(entidades));
});

// Generic list with optional text search (?q=)
// Entidades exclusivas del contador: no deben estar disponibles en CRUD genérico del admin
const entidadesExclusivasContador = new Set(['ingreso', 'gasto', 'pago', 'factura', 'inventario']);

app.get('/api/list/:entity', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  if (!definicion) return res.status(400).json({ error: 'Entidad no valida' });
  if (entidadesExclusivasContador.has(entidad)) return res.status(403).json({ error: 'Entidad exclusiva del Contador' });
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
  if (entidadesExclusivasContador.has(entidad)) return res.status(403).json({ error: 'Entidad exclusiva del Contador' });
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
  if (entidadesExclusivasContador.has(entidad)) return res.status(403).json({ error: 'Entidad exclusiva del Contador' });
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
  if (entidadesExclusivasContador.has(entidad)) return res.status(403).json({ error: 'Entidad exclusiva del Contador' });
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

// Debug: listar archivos de modelos faciales disponibles (para diagnosticar en producción)
app.get('/api/debug/face-models', (req, res) => {
  try {
    const modelosDir = path.join(__dirname, 'public', 'models');
    const files = fs.readdirSync(modelosDir).map(f => {
      const st = fs.statSync(path.join(modelosDir, f));
      return { name: f, size: st.size };
    });
    res.json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Debug: estado de librería face-api
app.get('/api/debug/face-lib', (req, res) => {
  const distDir = path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'dist');
  const publicVendorDir = path.join(__dirname, 'public', 'vendor', 'face-api');
  function listado(dir) {
    try { return fs.readdirSync(dir).map(f => ({ f, size: fs.statSync(path.join(dir, f)).size })); } catch { return null; }
  }
  res.json({
    distExists: fs.existsSync(distDir),
    publicVendorExists: fs.existsSync(publicVendorDir),
    distFiles: listado(distDir),
    publicVendorFiles: listado(publicVendorDir)
  });
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
    const { username, password, rol = 'Empleado', idEmpleado, idCliente, correo } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });
    const rolValido = ['Administrador','Contador','Empleado','Cliente'];
    if (!rolValido.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    // Validar unicidad de username
    const [existe] = await pool.query('SELECT 1 FROM usuarios WHERE nombre_usuario = ? LIMIT 1', [username]);
    if (existe.length) return res.status(400).json({ error: 'Usuario ya existe' });

    // Si se enlaza a empleado, validar que exista
    let idEmpleadoFinal = null;
    let idClienteFinal = null;
    if (idEmpleado != null && idEmpleado !== '') {
      const [emp] = await pool.query('SELECT idEmpleado FROM empleados WHERE idEmpleado = ? LIMIT 1', [idEmpleado]);
      if (!emp.length) return res.status(400).json({ error: 'Empleado no existe' });
      idEmpleadoFinal = Number(idEmpleado);
    }
    if (idCliente != null && idCliente !== '') {
      const [cli] = await pool.query('SELECT idCliente FROM clientes WHERE idCliente = ? LIMIT 1', [idCliente]);
      if (!cli.length) return res.status(400).json({ error: 'Cliente no existe' });
      idClienteFinal = Number(idCliente);
    }

    const hash = await bcrypt.hash(password, 10);
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    const [r] = await pool.query(
      'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, idCliente, foto_url, Correo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hash, rol, idEmpleadoFinal, idClienteFinal, foto_url, correo || null]
    );
    res.status(201).json({ idUsuario: r.insertId, username, rol, idEmpleado: idEmpleadoFinal, idCliente: idClienteFinal, foto_url, correo: correo || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar/actualizar descriptor facial de un usuario (JSON con 128 floats)
app.post('/api/users/:id/face', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de usuario inválido' });
  try {
    const descriptor = req.body?.descriptor;
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length < 64) {
      return res.status(400).json({ error: 'Descriptor facial inválido' });
    }
    // Validar que todos sean números finitos y limitar a 512 elementos
    const lim = Math.min(descriptor.length, 512);
    const limpio = [];
    for (let i = 0; i < lim; i++) {
      const v = Number(descriptor[i]);
      if (!Number.isFinite(v)) return res.status(400).json({ error: 'Descriptor contiene valores inválidos' });
      limpio.push(v);
    }
    const json = JSON.stringify(limpio);
    const [r] = await pool.query('UPDATE usuarios SET face_descriptor = ? WHERE idUsuario = ?', [json, id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

// ==========================
// Rutas para Cliente
// ==========================

// Resumen de proyectos del cliente autenticado
app.get('/api/cliente/proyectos', requerirAutenticacion, requerirCliente, async (req, res) => {
  const idCliente = req.session?.user?.idCliente;
  if (!idCliente) return res.status(400).json({ error: 'Usuario sin cliente asociado' });
  try {
    const [filas] = await pool.query(`
      SELECT p.idProyecto, p.Nombre AS Proyecto,
             (SELECT COUNT(*) FROM empleados e WHERE e.idProyecto = p.idProyecto) AS Empleados,
             (SELECT COUNT(*) FROM tareas t WHERE t.idProyecto = p.idProyecto) AS Tareas,
             (SELECT COUNT(*) FROM facturas f WHERE f.idProyecto = p.idProyecto AND f.idCliente = ?) AS Facturas
      FROM proyectos p
      WHERE p.idCliente = ?
      ORDER BY p.idProyecto DESC
    `, [idCliente, idCliente]);
    res.json(filas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Empleados de un proyecto (nombre, foto, especialidad, asistencia) y tareas asignadas
app.get('/api/cliente/proyectos/:id/empleados', requerirAutenticacion, requerirCliente, async (req, res) => {
  const idCliente = req.session?.user?.idCliente;
  const idProyecto = Number(req.params.id);
  if (!idProyecto) return res.status(400).json({ error: 'ID de proyecto inválido' });
  try {
    // Validar que el proyecto pertenece al cliente
    const [pp] = await pool.query('SELECT 1 FROM proyectos WHERE idProyecto = ? AND idCliente = ? LIMIT 1', [idProyecto, idCliente]);
    if (!pp.length) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const [empleados] = await pool.query(`
      SELECT e.idEmpleado, e.Nombre, e.Especialidad, e.Asistencia, e.foto_url
      FROM empleados e
      WHERE e.idProyecto = ?
      ORDER BY e.idEmpleado DESC
    `, [idProyecto]);

    const [tareas] = await pool.query(`
      SELECT t.idTarea, t.Descripcion, t.Estado, t.idEmpleado
      FROM tareas t
      WHERE t.idProyecto = ?
      ORDER BY t.idTarea DESC
    `, [idProyecto]);

    res.json({ empleados, tareas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Facturas del cliente
app.get('/api/cliente/facturas', requerirAutenticacion, requerirCliente, async (req, res) => {
  const idCliente = req.session?.user?.idCliente;
  try {
    const [filas] = await pool.query(`
      SELECT f.idFactura, f.Fecha, f.Valor_total, p.Nombre AS Proyecto
      FROM facturas f
      LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto
      WHERE f.idCliente = ?
      ORDER BY f.idFactura DESC
      LIMIT 300
    `, [idCliente]);
    res.json(filas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pagos del cliente (por sus facturas)
app.get('/api/cliente/pagos', requerirAutenticacion, requerirCliente, async (req, res) => {
  const idCliente = req.session?.user?.idCliente;
  try {
    const [filas] = await pool.query(`
      SELECT y.idPago, y.Fecha, y.Monto, y.idFactura
      FROM pagos y
      INNER JOIN facturas f ON f.idFactura = y.idFactura
      WHERE f.idCliente = ?
      ORDER BY y.idPago DESC
      LIMIT 300
    `, [idCliente]);
    res.json(filas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PDF de factura para cliente (si la factura es suya)
app.get('/api/cliente/facturas/:id/pdf', requerirAutenticacion, requerirCliente, async (req, res) => {
  const id = Number(req.params.id);
  const idCliente = req.session?.user?.idCliente;
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [rows] = await pool.query(`
      SELECT f.idFactura, f.Fecha, f.Valor_total,
             c.Nombre AS Cliente, c.Correo AS CorreoCliente, c.Telefono AS TelefonoCliente,
             p.Nombre AS Proyecto
      FROM facturas f
      LEFT JOIN clientes c ON c.idCliente = f.idCliente
      LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto
      WHERE f.idFactura = ? AND f.idCliente = ?
      LIMIT 1
    `, [id, idCliente]);
    if (!rows.length) return res.status(404).json({ error: 'Factura no encontrada' });
    const factura = rows[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura_${id}.pdf"`);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    doc.fontSize(20).text('Factura', { align: 'right' }).moveDown(0.5);
    doc.fontSize(12)
      .text('Empresa: BuildSmarts S.A.')
      .text('NIT: 900.000.000-1')
      .text('Dirección: Calle 1 # 2-3, Ciudad')
      .text('Teléfono: +57 300 000 0000').moveDown();
    doc.fontSize(12)
      .text(`Factura N°: ${factura.idFactura}`)
      .text(`Fecha: ${new Date(factura.Fecha).toISOString().slice(0,10)}`)
      .text(`Proyecto: ${factura.Proyecto || '—'}`).moveDown();
    doc.fontSize(12)
      .text('Cliente:', { underline: true })
      .text(`Nombre: ${factura.Cliente || '—'}`)
      .text(`Correo: ${factura.CorreoCliente || '—'}`)
      .text(`Teléfono: ${factura.TelefonoCliente || '—'}`).moveDown();
    doc.fontSize(12)
      .text('Concepto:', { underline: true })
      .text('Servicios/Materiales facturados').moveDown();
    doc.fontSize(14)
      .text(`Valor Total: $ ${Number(factura.Valor_total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, { align: 'right' })
      .moveDown(2);
    doc.fontSize(10).fillColor('#666').text('Gracias por su confianza.', { align: 'center' });
    doc.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear cliente y usuario (opcional)
app.post('/api/clientes/crear-con-usuario', requerirAutenticacion, requerirAdmin, async (req, res) => {
  const { Nombre, Telefono, Correo, crear_usuario, nombre_usuario, contraseña } = req.body || {};
  if (!Nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cli] = await conn.query('INSERT INTO clientes (Nombre, Telefono, Correo) VALUES (?, ?, ?)', [Nombre, Telefono || null, Correo || null]);
    const idCliente = cli.insertId;
    let idUsuario = null;
    const deberiaCrearUsuario = crear_usuario === true || crear_usuario === 'true' || crear_usuario === '1' || crear_usuario === 1 || crear_usuario === 'on';
    if (deberiaCrearUsuario) {
      if (!nombre_usuario || !contraseña) throw new Error('Para crear usuario se requieren nombre_usuario y contraseña');
      const [ex] = await conn.query('SELECT 1 FROM usuarios WHERE nombre_usuario = ? LIMIT 1', [nombre_usuario]);
      if (ex.length) throw new Error('El nombre de usuario ya existe');
      const hash = await bcrypt.hash(String(contraseña), 10);
      const [u] = await conn.query(
        'INSERT INTO usuarios (nombre_usuario, contraseña, rol, idEmpleado, idCliente, Correo) VALUES (?, ?, "Cliente", NULL, ?, ?)',
        [nombre_usuario, hash, idCliente, Correo || null]
      );
      idUsuario = u.insertId;
    }
    await conn.commit();
    res.status(201).json({ idCliente, idUsuario });
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Ensure unknown /api routes return JSON instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});
// Función para calcular stock usando CASE
function stockCaseExpr(prefix = 'i') {
  return `SUM(CASE 
    WHEN LOWER(${prefix}.tipo_movimiento) IN ('entrada','ingreso','compra') THEN ${prefix}.cantidad
    WHEN LOWER(${prefix}.tipo_movimiento) IN ('salida','consumo','uso') THEN -${prefix}.cantidad
    ELSE 0 END)`;
}

// Resumen general
app.get('/api/inventory/overview', async (req, res) => {
  try {
    // Preferir columna stock si existe; si no, calcular por SUM
    let rows;
    try {
      const [r1] = await pool.query('SELECT COUNT(*) materiales, SUM(CASE WHEN IFNULL(stock,0) > 0 THEN 1 ELSE 0 END) disponibles, SUM(CASE WHEN IFNULL(stock,0) <= 0 THEN 1 ELSE 0 END) agotados FROM materials');
      rows = r1;
    } catch (_) {
      const [r2] = await pool.query(`
        SELECT 
          COUNT(*) AS materiales,
          SUM(CASE WHEN IFNULL(stock, 0) > 0 THEN 1 ELSE 0 END) AS disponibles,
          SUM(CASE WHEN IFNULL(stock, 0) <= 0 THEN 1 ELSE 0 END) AS agotados
        FROM (
          SELECT m.idMaterial,
                 ${stockCaseExpr('i')} AS stock
          FROM materials m
          LEFT JOIN inventarios i ON i.idMaterial = m.idMaterial
          GROUP BY m.idMaterial
        ) t;
      `);
      rows = r2;
    }
    res.json(rows[0] || { materiales: 0, disponibles: 0, agotados: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tarjetas por material (agregado + filtro por nombre)
app.get('/api/inventory/cards', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  try {
    const params = [];
    let where = '';
    if (q) { where = 'WHERE m.Nombre LIKE ?'; params.push(`%${q}%`); }
    // Preferir columna stock si existe
    let rows;
    try {
      const [r] = await pool.query(`
        SELECT m.idMaterial, m.Nombre, m.costo_unitario, m.tipo, m.stock AS stock,
               (SELECT COUNT(*) FROM inventarios i WHERE i.idMaterial = m.idMaterial) AS movimientos,
               m.foto_url
        FROM materials m
        ${where}
        ORDER BY m.idMaterial DESC
        LIMIT 200` , params);
      rows = r;
    } catch (_) {
      const sql = `
        SELECT 
          m.idMaterial,
          m.Nombre,
          m.costo_unitario,
          m.tipo,
          ${stockCaseExpr('i')} AS stock,
          COUNT(i.idInventario) AS movimientos,
          m.foto_url
        FROM materials m
        LEFT JOIN inventarios i ON i.idMaterial = m.idMaterial
        ${where}
        GROUP BY m.idMaterial, m.Nombre, m.costo_unitario, m.tipo
        ORDER BY m.idMaterial DESC
        LIMIT 200
      `;
      const [r2] = await pool.query(sql, params);
      rows = r2;
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Consumo de material por empleado (crea movimiento de Salida y acumula en factura borrador)
app.post('/api/empleado/consumir', requerirAutenticacion, requerirEmpleado, async (req, res) => {
  const idEmp = req.session.user?.idEmpleado;
  if (!idEmp) return res.status(400).json({ error: 'Usuario sin empleado asociado' });
  const { idMaterial, cantidad } = req.body || {};
  if (!idMaterial || !cantidad) return res.status(400).json({ error: 'idMaterial y cantidad requeridos' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Obtener proyecto y cliente del empleado
    const [empRows] = await conn.query('SELECT e.idProyecto, p.idCliente FROM empleados e LEFT JOIN proyectos p ON p.idProyecto = e.idProyecto WHERE e.idEmpleado = ? LIMIT 1', [idEmp]);
    const idProyecto = empRows[0]?.idProyecto || null;
    const idCliente = empRows[0]?.idCliente || null;
    // Insertar salida de inventario
    const fecha = new Date().toISOString().slice(0,10);
    await conn.query('INSERT INTO inventarios (tipo_movimiento, cantidad, fecha, idMaterial, idProyecto) VALUES (\'Salida\', ?, ?, ?, ?)', [Number(cantidad), fecha, idMaterial, idProyecto]);

    // Crear/actualizar factura borrador si hay cliente
    if (idCliente) {
      // Buscar factura borrador activa del proyecto/cliente
      let idFactura = null;
      const [f] = await conn.query('SELECT idFactura FROM facturas WHERE idCliente = ? AND IFNULL(idProyecto, ?) <=> ? AND Estado = \'Borrador\' ORDER BY idFactura DESC LIMIT 1', [idCliente, idProyecto, idProyecto]);
      if (f.length) {
        idFactura = f[0].idFactura;
      } else {
        const [nuevo] = await conn.query('INSERT INTO facturas (Fecha, Valor_total, idProyecto, idCliente, Estado) VALUES (CURDATE(), 0, ?, ?, \'Borrador\')', [idProyecto, idCliente]);
        idFactura = nuevo.insertId;
      }
      // Obtener costo unitario del material
      const [mat] = await conn.query('SELECT costo_unitario FROM materials WHERE idMaterial = ? LIMIT 1', [idMaterial]);
      const cu = Number(mat[0]?.costo_unitario || 0);
      const cant = Number(cantidad);
      const subtotal = cu * cant;
      await conn.query('INSERT INTO factura_detalles (idFactura, idMaterial, cantidad, costo_unitario, subtotal) VALUES (?, ?, ?, ?, ?)', [idFactura, idMaterial, cant, cu, subtotal]);
      await conn.query('UPDATE facturas SET Valor_total = IFNULL(Valor_total,0) + ? WHERE idFactura = ?', [subtotal, idFactura]);
    }

    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Detalle de un material: info + movimientos
app.get('/api/inventory/material/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [infoRows] = await pool.query(
      `SELECT m.idMaterial, m.Nombre, m.costo_unitario, m.tipo,
              ${stockCaseExpr('i')} AS stock,
              COUNT(i.idInventario) AS movimientos
       FROM materials m
       LEFT JOIN inventarios i ON i.idMaterial = m.idMaterial
       WHERE m.idMaterial = ?
       GROUP BY m.idMaterial, m.Nombre, m.costo_unitario, m.tipo`,
      [id]
    );
    const [movRows] = await pool.query(
      `SELECT i.idInventario, i.tipo_movimiento, i.cantidad, i.fecha, p.Nombre AS Proyecto
       FROM inventarios i
       LEFT JOIN proyectos p ON p.idProyecto = i.idProyecto
       WHERE i.idMaterial = ?
       ORDER BY i.fecha DESC, i.idInventario DESC
       LIMIT 500`,
      [id]
    );
    res.json({ material: infoRows[0] || null, movimientos: movRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = Number(process.env.PORT || 8080);
asegurarEsquemaYSemilla().finally(() => {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
});

// Verificación/descarga opcional de modelos face-api (corrige nombres). En Railway ya deben estar incluidos en la imagen.
const archivosModelos = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin'
];
const modelosDir = path.join(__dirname, 'public', 'models');
function asegurarModelosFace() {
  try { if (!fs.existsSync(modelosDir)) fs.mkdirSync(modelosDir, { recursive: true }); } catch (e) { console.warn('No se pudo crear /public/models:', e.message); }
  const baseCDN = 'https://unpkg.com/@vladmandic/face-api@1.7.15/model/';
  archivosModelos.forEach((fname) => {
    const destino = path.join(modelosDir, fname);
    if (fs.existsSync(destino) && fs.statSync(destino).size > 0) return;
    // Intento de descarga sólo si falta; no es crítico en producción.
    const url = baseCDN + fname;
    console.log('Descargando modelo facial faltante:', fname);
    const file = fs.createWriteStream(destino);
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) {
        console.warn('Fallo descarga modelo', fname, 'status', resp.statusCode);
        file.close(); fs.unlink(destino, () => {}); return;
      }
      resp.pipe(file);
      file.on('finish', () => file.close());
    }).on('error', (err) => {
      console.warn('Error descargando', fname, err.message);
      file.close(); fs.unlink(destino, () => {});
    });
  });
}
asegurarModelosFace();
