import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
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

// Whitelisted entities with basic column lists and searchable fields
const ENTITIES = {
  empleado: {
    table: 'empleado',
    columns: ['idEmpleado','Nombre','Correo','Telefono','Asistencia','Especialidad','idProyecto'],
    search: ['Nombre','Correo','Telefono','Especialidad']
  },
  cliente: {
    table: 'cliente',
    columns: ['idCliente','Nombre','Documento','Telefono','Correo'],
    search: ['Nombre','Documento','Telefono','Correo']
  },
  proyecto: {
    table: 'proyecto',
    columns: ['idProyecto','Nombre','idCliente'],
    search: ['Nombre']
  },
  apartamento: {
    table: 'apartamento',
    columns: ['idApartamento','num_apartamento','num_piso','estado','idProyecto'],
    search: ['estado']
  },
  piso: {
    table: 'piso',
    columns: ['idPiso','idProyecto','numero','idApartamento'],
    search: ['numero']
  },
  material: {
    table: 'material',
    columns: ['idMaterial','Nombre','costo_unitario','tipo'],
    search: ['Nombre','tipo']
  },
  inventario: {
    table: 'inventario',
    columns: ['idInventario','tipo_movimiento','cantidad','fecha','idMaterial','idProyecto'],
    search: ['tipo_movimiento']
  },
  ingreso: {
    table: 'ingreso',
    columns: ['idIngreso','fecha','Valor','Descripcion','idProyecto'],
    search: ['Descripcion']
  },
  gasto: {
    table: 'gasto',
    columns: ['idGasto','Valor','Descripcion','fecha','idProyecto'],
    search: ['Descripcion']
  },
  factura: {
    table: 'factura',
    columns: ['idFactura','Fecha','Valor_total','idProyecto','idCliente'],
    search: []
  },
  pago: {
    table: 'pago',
    columns: ['idPago','Fecha','Monto','idFactura'],
    search: []
  },
  tarea: {
    table: 'tarea',
    columns: ['idTarea','Descripcion','Estado','idProyecto','idEmpleado'],
    search: ['Descripcion','Estado']
  },
  turno: {
    table: 'turno',
    columns: ['idTurno','Hora_inicio','Hora_fin','Tipo_jornada','idEmpleado'],
    search: ['Tipo_jornada']
  }
};

// List available entities
app.get('/api/entities', (req, res) => {
  res.json(Object.keys(ENTITIES));
});

// Generic list with optional text search (?q=)
app.get('/api/list/:entity', async (req, res) => {
  const entity = String(req.params.entity || '').toLowerCase();
  const info = ENTITIES[entity];
  if (!info) return res.status(400).json({ error: 'Entidad no valida' });
  const q = (req.query.q || '').toString().trim();

  try {
    const cols = info.columns.join(', ');
    let sql = `SELECT ${cols} FROM ${info.table}`;
    const params = [];
    if (q && info.search && info.search.length) {
      const likes = info.search.map((c) => `${c} LIKE ?`).join(' OR ');
      sql += ` WHERE ${likes}`;
      info.search.forEach(() => params.push(`%${q}%`));
    }
    // order by first id column if present
    const idCol = info.columns.find((c) => c.toLowerCase().startsWith('id')) || info.columns[0];
    sql += ` ORDER BY ${idCol} DESC LIMIT 100`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple map of insertable columns per entity (exclude PK id)
const CREATE_COLS = {
  cliente: ['Nombre','Documento','Telefono','Correo'],
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
app.post('/api/create/:entity', async (req, res) => {
  const entity = String(req.params.entity || '').toLowerCase();
  const info = ENTITIES[entity];
  const cols = CREATE_COLS[entity];
  if (!info || !cols) return res.status(400).json({ error: 'Entidad no valida' });
  try {
    console.log('[CREATE]', entity, req.body);
    const values = cols.map((c) => (req.body && Object.prototype.hasOwnProperty.call(req.body, c)) ? req.body[c] : null);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${info.table} (${cols.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.query(sql, values);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Version/info endpoints to help debug
app.get('/api/version', (req, res) => {
  res.json({
    ok: true,
    entities: Object.keys(ENTITIES),
    creatable: Object.keys(CREATE_COLS)
  });
});

app.get('/api/check/:entity', (req, res) => {
  const e = String(req.params.entity || '').toLowerCase();
  res.json({
    entity: e,
    known: !!ENTITIES[e],
    creatable: !!CREATE_COLS[e],
    listColumns: ENTITIES[e]?.columns || [],
    createColumns: CREATE_COLS[e] || []
  });
});

// Simple health endpoint
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List clientes (very basic)
app.get('/api/clientes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT idCliente, Nombre, Documento, Telefono, Correo FROM cliente ORDER BY idCliente DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List proyectos with cliente name if available
app.get('/api/proyectos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.idProyecto, p.Nombre AS Proyecto, c.Nombre AS Cliente
      FROM proyecto p
      LEFT JOIN cliente c ON c.idCliente = p.idCliente
      ORDER BY p.idProyecto DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a super simple POST to add a cliente
app.post('/api/clientes', async (req, res) => {
  const { Nombre, Documento, Telefono, Correo } = req.body || {};
  if (!Nombre || !Documento) {
    return res.status(400).json({ error: 'Nombre y Documento son obligatorios' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO cliente (Nombre, Documento, Telefono, Correo) VALUES (?, ?, ?, ?)',
      [Nombre, Documento, Telefono || null, Correo || null]
    );
    res.status(201).json({ idCliente: result.insertId, Nombre, Documento, Telefono, Correo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Minimal lists for relations (id and name-ish)
app.get('/api/min/clientes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT idCliente as id, Nombre as nombre FROM cliente ORDER BY idCliente DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/min/proyectos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT idProyecto as id, Nombre as nombre FROM proyecto ORDER BY idProyecto DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/min/empleados', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT idEmpleado as id, Nombre as nombre FROM empleado ORDER BY idEmpleado DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/min/materiales', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT idMaterial as id, Nombre as nombre FROM material ORDER BY idMaterial DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/min/facturas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT idFactura as id, CONCAT("Factura ", idFactura) as nombre FROM factura ORDER BY idFactura DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ensure unknown /api routes return JSON instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
