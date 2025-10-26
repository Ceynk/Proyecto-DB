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

// Entidades permitidas con columnas, joins (vistas) y campos buscables
// Para tablas más claras se hacen JOINs y alias
const entidades = {
  empleado: {
    from: 'empleados e LEFT JOIN proyectos p ON p.idProyecto = e.idProyecto',
    table: 'empleados',
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
    columns: ['c.idCliente AS idCliente','c.Nombre AS Nombre','c.Telefono AS Telefono','c.Correo AS Correo'],
    search: ['c.Nombre','c.Telefono','c.Correo'],
    orderBy: 'idCliente'
  },
  proyecto: {
    from: 'proyectos p LEFT JOIN clientes c ON c.idCliente = p.idCliente',
    table: 'proyectos',
    columns: ['p.idProyecto AS idProyecto','p.Nombre AS Nombre','c.Nombre AS Cliente'],
    search: ['p.Nombre','c.Nombre'],
    orderBy: 'idProyecto'
  },
  apartamento: {
    from: 'apartamentos a LEFT JOIN proyectos p ON p.idProyecto = a.idProyecto',
    table: 'apartamentos',
    columns: ['a.idApartamento AS idApartamento','a.num_apartamento AS num_apartamento','a.num_piso AS num_piso','a.estado AS estado','p.Nombre AS Proyecto'],
    search: ['a.estado','p.Nombre'],
    orderBy: 'idApartamento'
  },
  piso: {
    from: 'pisos s LEFT JOIN proyectos p ON p.idProyecto = s.idProyecto LEFT JOIN apartamentos a ON a.idApartamento = s.idApartamento',
    table: 'pisos',
    columns: ['s.idPiso AS idPiso','p.Nombre AS Proyecto','s.numero AS numero','a.num_apartamento AS Apartamento'],
    search: ['p.Nombre','s.numero','a.num_apartamento'],
    orderBy: 'idPiso'
  },
  material: {
    from: 'materials m',
    table: 'materials',
    columns: ['m.idMaterial AS idMaterial','m.Nombre AS Nombre','m.costo_unitario AS costo_unitario','m.tipo AS tipo'],
    search: ['m.Nombre','m.tipo'],
    orderBy: 'idMaterial'
  },
  inventario: {
    from: 'inventarios i LEFT JOIN materials m ON m.idMaterial = i.idMaterial LEFT JOIN proyectos p ON p.idProyecto = i.idProyecto',
    table: 'inventarios',
    columns: ['i.idInventario AS idInventario','i.tipo_movimiento AS tipo_movimiento','i.cantidad AS cantidad','i.fecha AS fecha','m.Nombre AS Material','p.Nombre AS Proyecto'],
    search: ['i.tipo_movimiento','m.Nombre','p.Nombre'],
    orderBy: 'idInventario'
  },
  ingreso: {
    from: 'ingresos g LEFT JOIN proyectos p ON p.idProyecto = g.idProyecto',
    table: 'ingresos',
    columns: ['g.idIngreso AS idIngreso','g.fecha AS fecha','g.Valor AS Valor','g.Descripcion AS Descripcion','p.Nombre AS Proyecto'],
    search: ['g.Descripcion','p.Nombre'],
    orderBy: 'idIngreso'
  },
  gasto: {
    from: 'gastos g LEFT JOIN proyectos p ON p.idProyecto = g.idProyecto',
    table: 'gastos',
    columns: ['g.idGasto AS idGasto','g.Valor AS Valor','g.Descripcion AS Descripcion','g.fecha AS fecha','p.Nombre AS Proyecto'],
    search: ['g.Descripcion','p.Nombre'],
    orderBy: 'idGasto'
  },
  factura: {
    from: 'facturas f LEFT JOIN proyectos p ON p.idProyecto = f.idProyecto LEFT JOIN clientes c ON c.idCliente = f.idCliente',
    table: 'facturas',
    columns: ['f.idFactura AS idFactura','f.Fecha AS Fecha','f.Valor_total AS Valor_total','p.Nombre AS Proyecto','c.Nombre AS Cliente'],
    search: ['p.Nombre','c.Nombre'],
    orderBy: 'idFactura'
  },
  pago: {
    from: 'pagos y LEFT JOIN facturas f ON f.idFactura = y.idFactura',
    table: 'pagos',
    columns: ['y.idPago AS idPago','y.Fecha AS Fecha','y.Monto AS Monto','CONCAT("Factura ", f.idFactura) AS Factura'],
    search: ['y.Monto','f.idFactura'],
    orderBy: 'idPago'
  },
  tarea: {
    from: 'tareas t LEFT JOIN proyectos p ON p.idProyecto = t.idProyecto LEFT JOIN empleados e ON e.idEmpleado = t.idEmpleado',
    table: 'tareas',
    columns: ['t.idTarea AS idTarea','t.Descripcion AS Descripcion','t.Estado AS Estado','p.Nombre AS Proyecto','e.Nombre AS Empleado'],
    search: ['t.Descripcion','t.Estado','p.Nombre','e.Nombre'],
    orderBy: 'idTarea'
  },
  turno: {
    from: 'turnos u LEFT JOIN empleados e ON e.idEmpleado = u.idEmpleado',
    table: 'turnos',
    columns: ['u.idTurno AS idTurno','u.Hora_inicio AS Hora_inicio','u.Hora_fin AS Hora_fin','u.Tipo_jornada AS Tipo_jornada','e.Nombre AS Empleado'],
    search: ['u.Tipo_jornada','e.Nombre'],
    orderBy: 'idTurno'
  }
};

// List available entities
app.get('/api/entities', (req, res) => {
  res.json(Object.keys(entidades));
});

// Generic list with optional text search (?q=)
app.get('/api/list/:entity', async (req, res) => {
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
app.post('/api/create/:entity', async (req, res) => {
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
app.get('/api/clientes', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente, Nombre, Telefono, Correo FROM clientes ORDER BY idCliente DESC LIMIT 50');
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List proyectos with cliente name if available
app.get('/api/proyectos', async (req, res) => {
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
app.post('/api/clientes', async (req, res) => {
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
app.get('/api/min/clientes', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idCliente as id, Nombre as nombre FROM clientes ORDER BY idCliente DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/proyectos', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idProyecto as id, Nombre as nombre FROM proyectos ORDER BY idProyecto DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/empleados', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idEmpleado as id, Nombre as nombre FROM empleados ORDER BY idEmpleado DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/materiales', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idMaterial as id, Nombre as nombre FROM materials ORDER BY idMaterial DESC LIMIT 200');
    res.json(filas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/min/facturas', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT idFactura as id, CONCAT("Factura ", idFactura) as nombre FROM facturas ORDER BY idFactura DESC LIMIT 200');
    res.json(filas);
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
