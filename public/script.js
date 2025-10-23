const entidadesEl = document.getElementById('entidades');
const tituloEl = document.getElementById('titulo');
const buscarEl = document.getElementById('buscar');
const tableWrap = document.getElementById('tableWrap');
const formWrap = document.getElementById('formWrap');
const dynForm = document.getElementById('dynForm');
const formTitle = document.getElementById('formTitle');
const formMsg = document.getElementById('formMsg');

const ENTITIES = [
  'empleado', 'cliente', 'proyecto', 'apartamento', 'material',
  'inventario', 'ingreso', 'gasto', 'pago', 'tarea', 'turno', 'factura'
];

let current = 'empleado';
let lastFetchAbort = null;

function mk(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

function renderSidebar() {
  entidadesEl.innerHTML = '';
  ENTITIES.forEach((name) => {
    const btn = mk('button', name === current ? 'active' : '', name.charAt(0).toUpperCase() + name.slice(1));
    btn.addEventListener('click', () => {
      current = name;
      renderSidebar();
      tituloEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      buscarEl.value = '';
      loadData();
      buildForm();
    });
    entidadesEl.appendChild(btn);
  });
}

function renderTable(rows) {
  tableWrap.innerHTML = '';
  if (!rows || rows.length === 0) {
    tableWrap.textContent = 'Sin datos';
    return;
  }
  const table = mk('table');
  const thead = mk('thead');
  const htr = mk('tr');
  const headers = Object.keys(rows[0]);
  headers.forEach((h) => htr.appendChild(mk('th', '', h)));
  thead.appendChild(htr);
  const tbody = mk('tbody');
  rows.forEach((r) => {
    const tr = mk('tr');
    headers.forEach((h) => {
      const td = mk('td');
      td.textContent = r[h] == null ? '' : String(r[h]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrap.appendChild(table);
}

async function loadData() {
  const q = buscarEl.value.trim();
  const url = q ? `/api/list/${current}?q=${encodeURIComponent(q)}` : `/api/list/${current}`;
  tableWrap.textContent = 'Cargando...';
  try {
    if (lastFetchAbort) lastFetchAbort.abort();
    const ctrl = new AbortController();
    lastFetchAbort = ctrl;
    const res = await fetch(url, { signal: ctrl.signal });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const txt = await res.text();
      throw new Error(`Respuesta no JSON (${res.status}): ${txt.substring(0, 120)}...`);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    renderTable(data);
  } catch (e) {
    if (e.name === 'AbortError') return; // ignore
    tableWrap.textContent = 'Error: ' + e.message;
  }
}

buscarEl.addEventListener('input', () => {
  // simple debounce
  if (buscarEl._t) clearTimeout(buscarEl._t);
  buscarEl._t = setTimeout(loadData, 300);
});

renderSidebar();
loadData();
buildForm();

// Define form fields for each entity (simple, estilo estudiante)
const FORM_FIELDS = {
  cliente: [
    { name: 'Nombre', type: 'text', req: true },
    { name: 'Documento', type: 'text', req: true },
    { name: 'Telefono', type: 'text' },
    { name: 'Correo', type: 'email' }
  ],
  proyecto: [
    { name: 'Nombre', type: 'text', req: true },
    { name: 'idCliente', type: 'select', source: '/api/min/clientes' }
  ],
  apartamento: [
    { name: 'num_apartamento', type: 'number', req: true },
    { name: 'num_piso', type: 'number', req: true },
    { name: 'estado', type: 'select', options: ['Disponible','Ocupado','En mantenimiento'] },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' }
  ],
  piso: [
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' },
    { name: 'numero', type: 'number', req: true },
    { name: 'idApartamento', type: 'number' }
  ],
  material: [
    { name: 'Nombre', type: 'text', req: true },
    { name: 'costo_unitario', type: 'number', step: '0.01', req: true },
    { name: 'tipo', type: 'text' }
  ],
  empleado: [
    { name: 'Nombre', type: 'text', req: true },
    { name: 'Correo', type: 'email' },
    { name: 'Telefono', type: 'text' },
    { name: 'Asistencia', type: 'text' },
    { name: 'Especialidad', type: 'text' },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' }
  ],
  turno: [
    { name: 'Hora_inicio', type: 'time', req: true },
    { name: 'Hora_fin', type: 'time', req: true },
    { name: 'Tipo_jornada', type: 'text' },
    { name: 'idEmpleado', type: 'select', source: '/api/min/empleados' }
  ],
  tarea: [
    { name: 'Descripcion', type: 'text' },
    { name: 'Estado', type: 'text' },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' },
    { name: 'idEmpleado', type: 'select', source: '/api/min/empleados' }
  ],
  inventario: [
    { name: 'tipo_movimiento', type: 'text' },
    { name: 'cantidad', type: 'number', req: true },
    { name: 'fecha', type: 'date', req: true },
    { name: 'idMaterial', type: 'select', source: '/api/min/materiales' },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' }
  ],
  ingreso: [
    { name: 'fecha', type: 'date', req: true },
    { name: 'Valor', type: 'number', step: '0.01', req: true },
    { name: 'Descripcion', type: 'text' },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' }
  ],
  gasto: [
    { name: 'Valor', type: 'number', step: '0.01', req: true },
    { name: 'Descripcion', type: 'text' },
    { name: 'fecha', type: 'date', req: true },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' }
  ],
  factura: [
    { name: 'Fecha', type: 'date', req: true },
    { name: 'Valor_total', type: 'number', step: '0.01', req: true },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' },
    { name: 'idCliente', type: 'select', source: '/api/min/clientes' }
  ],
  pago: [
    { name: 'Fecha', type: 'date', req: true },
    { name: 'Monto', type: 'number', step: '0.01', req: true },
    { name: 'idFactura', type: 'select', source: '/api/min/facturas' }
  ]
};

async function buildForm() {
  formTitle.textContent = current.charAt(0).toUpperCase() + current.slice(1);
  dynForm.innerHTML = '';
  formMsg.textContent = '';
  const fields = FORM_FIELDS[current] || [];
  for (const f of fields) {
    const lab = mk('label', '', f.name);
    dynForm.appendChild(lab);
    if (f.type === 'select') {
      const sel = mk('select');
      sel.name = f.name;
      const optEmpty = mk('option', '', '--');
      optEmpty.value = '';
      sel.appendChild(optEmpty);
      if (f.options) {
        f.options.forEach((v) => {
          const o = mk('option', '', v);
          o.value = v;
          sel.appendChild(o);
        });
      }
      if (f.source) {
        try {
          const r = await fetch(f.source);
          const data = await r.json();
          data.forEach((it) => {
            const o = mk('option', '', `${it.id} - ${it.nombre}`);
            o.value = it.id;
            sel.appendChild(o);
          });
        } catch (e) { /* ignore for simple */ }
      }
      dynForm.appendChild(sel);
    } else {
      const inp = mk('input');
      inp.name = f.name;
      inp.type = f.type || 'text';
      if (f.step) inp.step = f.step;
      if (f.req) inp.required = true;
      dynForm.appendChild(inp);
    }
  }
  const btn = mk('button', '', 'Guardar');
  btn.type = 'submit';
  dynForm.appendChild(btn);
}

dynForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  formMsg.style.color = '#89ff9f';
  formMsg.textContent = 'Guardando...';
  const data = {};
  Array.from(dynForm.elements).forEach((el) => {
    if (!el.name) return;
    if (el.type === 'submit') return;
    if (el.tagName === 'SELECT' || el.type !== 'checkbox') data[el.name] = el.value === '' ? null : el.value;
  });
  try {
    const r = await fetch(`/api/create/${current}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || 'Error al guardar');
    formMsg.textContent = 'Guardado con id ' + body.id;
    dynForm.reset();
    loadData();
  } catch (e) {
    formMsg.style.color = 'salmon';
    formMsg.textContent = 'Error: ' + e.message;
  }
});
