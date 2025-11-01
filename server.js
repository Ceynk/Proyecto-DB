import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

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

// Entidades permitidas con columnas, joins (vistas) y campos buscables
// Para tablas más claras se hacen JOINs y alias
const entidades = {
  empleado: {
    from: 'empleados e LEFT JOIN proyectos p ON p.idProyecto = e.idProyecto',
    table: 'empleados',
    pk: 'idEmpleado',
    columns: [
      'e.idEmpleado AS idEmpleado',
      'e.Nombre AS Nombre',
      'e.Correo AS Correo',
      'e.Telefono AS Telefono',
      'e.Asistencia AS Asistencia',
      'e.Especialidad AS Especialidad',
      'p.Nombre AS Proyecto'
    ],
    search: ['e.Nombre','e.Correo','e.Telefono','e.Especialidad','p.Nombre'],
    orderBy: 'idEmpleado'
  },
  cliente: {
    from: 'clientes c',
    table: 'clientes',
    pk: 'idCliente',
    columns: ['c.idCliente AS idCliente','c.Nombre AS Nombre','c.Telefono AS Telefono','c.Correo AS Correo'],
    search: ['c.Nombre','c.Telefono','c.Correo'],
    orderBy: 'idCliente'
  },
  proyecto: {
    from: 'proyectos p LEFT JOIN clientes c ON c.idCliente = p.idCliente',
    table: 'proyectos',
    pk: 'idProyecto',
    columns: ['p.idProyecto AS idProyecto','p.Nombre AS Nombre','c.Nombre AS Cliente'],
    search: ['p.Nombre','c.Nombre'],
    orderBy: 'idProyecto'
  },
  apartamento: {
    from: 'apartamentos a LEFT JOIN proyectos p ON p.idProyecto = a.idProyecto',
    table: 'apartamentos',
    pk: 'idApartamento',
    columns: ['a.idApartamento AS idApartamento','a.num_apartamento AS num_apartamento','a.num_piso AS num_piso','a.estado AS estado','p.Nombre AS Proyecto'],
    search: ['a.estado','p.Nombre'],
    orderBy: 'idApartamento'
  },
  piso: {
    from: 'pisos s LEFT JOIN proyectos p ON p.idProyecto = s.idProyecto LEFT JOIN apartamentos a ON a.idApartamento = s.idApartamento',
    table: 'pisos',
    pk: 'idPiso',
    columns: ['s.idPiso AS idPiso','p.Nombre AS Proyecto','s.numero AS numero','a.num_apartamento AS Apartamento'],
    search: ['p.Nombre','s.numero','a.num_apartamento'],
    orderBy: 'idPiso'
  },
  material: {
    from: 'materials m',
    table: 'materials',
    pk: 'idMaterial',
    columns: ['m.idMaterial AS idMaterial','m.Nombre AS Nombre','m.costo_unitario AS costo_unitario','m.tipo AS tipo'],
    search: ['m.Nombre','m.tipo'],
    orderBy: 'idMaterial'
  },
  inventario: {
    from: 'inventarios i LEFT JOIN materials m ON m.idMaterial = i.idMaterial LEFT JOIN proyectos p ON p.idProyecto = i.idProyecto',
    table: 'inventarios',
    pk: 'idInventario',
    columns: ['i.idInventario AS idInventario','i.tipo_movimiento AS tipo_movimiento','i.cantidad AS cantidad','i.fecha AS fecha','m.Nombre AS Material','p.Nombre AS Proyecto'],
    search: ['i.tipo_movimiento','m.Nombre','p.Nombre'],
    orderBy: 'idInventario'
  },
  ingreso: {
    from: 'ingresos g LEFT JOIN proyectos p ON p.idProyecto = g.idProyecto',
    table: 'ingresos',
    pk: 'idIngreso',
    columns: ['g.idIngreso AS idIngreso','g.fecha AS fecha','g.Valor AS Valor','g.Descripcion AS Descripcion','p.Nombre AS Proyecto'],
    search: ['g.Descripcion','p.Nombre'],
    orderBy: 'idIngreso'
  },
  gasto: {
    from: 'gastos g LEFT JOIN proyectos p ON p.idProyecto = g.idProyecto',
    table: 'gastos',
    pk: 'idGasto',
    columns: ['g.idGasto AS idGasto','g.Valor AS Valor','g.Descripcion AS Descripcion','g.fecha AS fecha','p.Nombre AS Proyecto'],
    search: ['g.Descripcion','p.Nombre'],
    orderBy: 'idGasto'
  },
  factura: {
    from: 'facturas f LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto LEFT JOIN clientes c ON c.idCliente = f.idCliente',
    table: 'facturas',
    pk: 'idFactura',
    columns: ['f.idFactura AS idFactura','f.Fecha AS Fecha','f.Valor_total AS Valor_total','p.Nombre AS Proyecto','c.Nombre AS Cliente'],
    search: ['p.Nombre','c.Nombre'],
    orderBy: 'idFactura'
  },
  pago: {
    from: 'pagos y LEFT JOIN facturas f ON f.idFactura = y.idFactura',
    table: 'pagos',
    pk: 'idPago',
    columns: ['y.idPago AS idPago','y.Fecha AS Fecha','y.Monto AS Monto','CONCAT("Factura ", f.idFactura) AS Factura'],
    search: ['y.Monto','f.idFactura'],
    orderBy: 'idPago'
  },
  tarea: {
    from: 'tareas t LEFT JOIN proyectos p ON p.idProyecto = t.idProyecto LEFT JOIN empleados e ON e.idEmpleado = t.idEmpleado',
    table: 'tareas',
    pk: 'idTarea',
    columns: ['t.idTarea AS idTarea','t.Descripcion AS Descripcion','t.Estado AS Estado','p.Nombre AS Proyecto','e.Nombre AS Empleado'],
    search: ['t.Descripcion','t.Estado','p.Nombre','e.Nombre'],
    orderBy: 'idTarea'
  },
  turno: {
    from: 'turnos u LEFT JOIN empleados e ON e.idEmpleado = u.idEmpleado',
    table: 'turnos',
    pk: 'idTurno',
    columns: ['u.idTurno AS idTurno','u.Hora_inicio AS Hora_inicio','u.Hora_fin AS Hora_fin','u.Tipo_jornada AS Tipo_jornada','e.Nombre AS Empleado'],
    search: ['u.Tipo_jornada','e.Nombre'],
    orderBy: 'idTurno'
  }
};

// --- Auth helpers ---
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'No autenticado' });
};

const requireAdmin = (req, res, next) => {
  if (req.session?.user?.rol === 'Administrador') return next();
  return res.status(403).json({ error: 'Requiere rol Administrador' });
};

const requireEmpleado = (req, res, next) => {
  const rol = req.session?.user?.rol;
  if (rol === 'Empleado' || rol === 'Administrador') return next();
  return res.status(403).json({ error: 'Requiere rol Empleado' });
};

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  try {
    const [rows] = await pool.query(
      'SELECT idUsuario, nombre_usuario, contraseña, rol, idEmpleado FROM usuarios WHERE nombre_usuario = ? LIMIT 1',
      [username]
    );
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const u = rows[0];
    let ok = false;
    const hash = u.contraseña || '';
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      ok = await bcrypt.compare(password, hash);
    } else {
      ok = password === hash; // fallback para contraseñas en texto plano
    }
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    req.session.user = {
      idUsuario: u.idUsuario,
      nombre_usuario: u.nombre_usuario,
      rol: u.rol,
      idEmpleado: u.idEmpleado || null
    };
    res.json({ ok: true, user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

// List available entities (admin)
app.get('/api/entities', requireAuth, requireAdmin, (req, res) => {
  res.json(Object.keys(entidades));
});

// Generic list with optional text search (?q=)
app.get('/api/list/:entity', requireAuth, requireAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  if (!definicion) return res.status(400).json({ error: 'Entidad no valida' });
  const busqueda = (req.query.q || '').toString().trim();

  try {
    const columnas = definicion.columns.join(', ');
    const desde = definicion.from || definicion.table;
    let sql = `SELECT ${columnas} FROM ${desde}`;
    const parametros = [];
    if (busqueda && definicion.search && definicion.search.length) {
      const coincidencias = definicion.search.map((c) => `${c} LIKE ?`).join(' OR ');
      sql += ` WHERE ${coincidencias}`;
      definicion.search.forEach(() => parametros.push(`%${busqueda}%`));
    }
    // order by first id column if present
    const ordenarPor = definicion.orderBy || '1';
    sql += ` ORDER BY ${ordenarPor} DESC LIMIT 100`;
    const [filas] = await pool.query(sql, parametros);
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mapa simple de columnas insertables por entidad (excluye la PK id)
const columnasCrear = {
  cliente: ['Nombre','Telefono','Correo'],
  proyecto: ['Nombre','idCliente'],
  apartamento: ['num_apartamento','num_piso','estado','idProyecto'],
  piso: ['idProyecto','numero','idApartamento'],
  material: ['Nombre','costo_unitario','tipo'],
  empleado: ['Nombre','Correo','Telefono','Asistencia','Especialidad','idProyecto'],
  turno: ['Hora_inicio','Hora_fin','Tipo_jornada','idEmpleado'],
  tarea: ['Descripcion','Estado','idProyecto','idEmpleado'],
  inventario: ['tipo_movimiento','cantidad','fecha','idMaterial','idProyecto'],
  ingreso: ['fecha','Valor','Descripcion','idProyecto'],
  gasto: ['Valor','Descripcion','fecha','idProyecto'],
  factura: ['Fecha','Valor_total','idProyecto','idCliente'],
  pago: ['Fecha','Monto','idFactura']
};

// Generic create
app.post('/api/create/:entity', requireAuth, requireAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  const cols = columnasCrear[entidad];
  if (!definicion || !cols) return res.status(400).json({ error: 'Entidad no valida' });
  try {
    console.log('[CREATE]', entidad, req.body);
    const values = cols.map((c) => (req.body && Object.prototype.hasOwnProperty.call(req.body, c)) ? req.body[c] : null);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${definicion.table} (${cols.join(', ')}) VALUES (${placeholders})`;
    const [resultado] = await pool.query(sql, values);
    res.status(201).json({ id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update (admin)
app.put('/api/update/:entity/:id', requireAuth, requireAdmin, async (req, res) => {
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
    const sql = `UPDATE ${definicion.table} SET ${setClause} WHERE ${definicion.table}.${definicion.pk} = ?`;
    values.push(id);
    const [resultado] = await pool.query(sql, values);
    res.json({ ok: true, affectedRows: resultado.affectedRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete (admin)
app.delete('/api/delete/:entity/:id', requireAuth, requireAdmin, async (req, res) => {
  const entidad = String(req.params.entity || '').toLowerCase();
  const definicion = entidades[entidad];
  const id = req.params.id;
  if (!definicion) return res.status(400).json({ error: 'Entidad no valida' });
  if (!id) return res.status(400).json({ error: 'ID requerido' });
  try {
    const sql = `DELETE FROM ${definicion.table} WHERE ${definicion.table}.${definicion.pk} = ?`;
    const [resultado] = await pool.query(sql, [id]);
    res.json({ ok: true, affectedRows: resultado.affectedRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Version/info endpoints to help debug
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
    listColumns: entidades[e]?.columns || [],
    createColumns: columnasCrear[e] || []
  });
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
app.get('/api/clientes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente, Nombre, Telefono, Correo FROM clientes ORDER BY idCliente DESC LIMIT 50');
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List proyectos with cliente name if available
app.get('/api/proyectos', requireAuth, requireAdmin, async (req, res) => {
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
app.post('/api/clientes', requireAuth, requireAdmin, async (req, res) => {
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
app.get('/api/min/clientes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente as id, Nombre as nombre FROM clientes ORDER BY idCliente DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/proyectos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idProyecto as id, Nombre as nombre FROM proyectos ORDER BY idProyecto DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/empleados', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idEmpleado as id, Nombre as nombre FROM empleados ORDER BY idEmpleado DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/materiales', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idMaterial as id, Nombre as nombre FROM materials ORDER BY idMaterial DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/facturas', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idFactura as id, CONCAT("Factura ", idFactura) as nombre FROM facturas ORDER BY idFactura DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Endpoints para empleado
app.get('/api/empleado/mis-datos', requireAuth, requireEmpleado, async (req, res) => {
  const idEmp = req.session.user?.idEmpleado;
  if (!idEmp) return res.status(400).json({ error: 'Usuario sin empleado asociado' });
  try {
    const [rows] = await pool.query(
      `SELECT e.idEmpleado, e.Nombre, e.Correo, e.Telefono, e.Asistencia, e.Especialidad, p.idProyecto, p.Nombre AS Proyecto
       FROM empleados e
       LEFT JOIN proyectos p ON p.idProyecto = e.idProyecto
       WHERE e.idEmpleado = ?`,
      [idEmp]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/empleado/asistencia', requireAuth, requireEmpleado, async (req, res) => {
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

// Ensure unknown /api routes return JSON instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
