const listaEntidadesEl = document.getElementById('entidades');
const tituloEl = document.getElementById('titulo');
const buscarEl = document.getElementById('buscar');
const contenedorTabla = document.getElementById('tableWrap');
const contenedorFormulario = document.getElementById('formWrap');
const formularioDinamico = document.getElementById('dynForm');
const tituloFormulario = document.getElementById('formTitle');
const mensajeFormulario = document.getElementById('formMsg');
const botonMenuMovil = document.getElementById('mobileMenuBtn');
const botonActualizar = document.getElementById('refreshBtn');
// Panels / admin nav
const dataPanel = document.getElementById('dataPanel');
const adminPanel = document.getElementById('adminPanel');
const adminNav = document.getElementById('adminNav');
const btnAdminPanel = document.getElementById('btnAdminPanel');
const barraLateral = document.getElementById('sidebar');
let currentMode = 'entities'; // 'entities' | 'admin'

// Auth/UI elements
const loginArea = document.getElementById('loginArea');
const appArea = document.getElementById('appArea');
const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
const totpForm = document.getElementById('totpForm');
const totpMsg = document.getElementById('totpMsg');
const logoutBtn = document.getElementById('logoutBtn');

// Empleado-only panel
const empleadoPanel = document.getElementById('empleadoPanel');
const empleadoInfo = document.getElementById('empleadoInfo');
const btnMarcarAsistencia = document.getElementById('btnMarcarAsistencia');
const asistenciaMsg = document.getElementById('asistenciaMsg');

// Update/Delete controls
const updateControls = document.getElementById('updateControls');
const updateIdInput = document.getElementById('updateIdInput');
const btnUpdate = document.getElementById('btnUpdate');
const btnDelete = document.getElementById('btnDelete');
const updateMsg = document.getElementById('updateMsg');
// Admin panel navigation
if (btnAdminPanel) {
  btnAdminPanel.addEventListener('click', () => {
    if (currentUser?.rol !== 'Administrador') return;
    currentMode = 'admin';
    if (dataPanel) dataPanel.style.display = 'none';
    if (adminPanel) adminPanel.style.display = '';
    // Remove active class from entity buttons
    Array.from(listaEntidadesEl.children).forEach((b) => b.classList.remove('active'));
    btnAdminPanel.classList.add('active');
  });
}

// Admin create form
const adminCreateWrap = document.getElementById('adminCreateWrap');
const adminCreateForm = document.getElementById('adminCreateForm');
const adminCreateMsg = document.getElementById('adminCreateMsg');


// en index.html o guarda una clave `API_BASE` en localStorage con la URL del backend en Railway.
const apiBase = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';

let currentUser = null;
async function apiFetch(path, opts = {}) {
  const finalOpts = Object.assign({ credentials: 'include' }, opts);
  const res = await fetch(`${apiBase}${path}`, finalOpts);
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : (body && body.error) || 'Error';
    throw new Error(msg);
  }
  return body;
}

const entidades = [
  'empleado', 'cliente', 'proyecto', 'apartamento', 'piso', 'material',
  'inventario', 'ingreso', 'gasto', 'pago', 'tarea', 'turno', 'factura'
];

let actual = 'empleado';
let ultimoAbortCtrl = null;

if (botonMenuMovil && barraLateral) {
  botonMenuMovil.addEventListener('click', () => {
    barraLateral.classList.toggle('mobile-open');
  });
  
  // Close sidebar when clicking a menu item on mobile
  barraLateral.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && window.innerWidth < 768) {
      barraLateral.classList.remove('mobile-open');
    }
  });
}

// Refresh button
if (botonActualizar) {
  botonActualizar.addEventListener('click', () => {
    cargarDatos();
  });
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}

// Helpers para sanitizar entradas según el tipo deseado
function sanitizarLetrasYEspacios(value) {
  // Permite letras (incluye acentos) y espacios
  return value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
}

function sanitizarDigitos(value) {
  // Solo dígitos (el teléfono no admite letras ni signos)
  return value.replace(/\D/g, '');
}

function renderizarBarraLateral() {
  listaEntidadesEl.innerHTML = '';
  entidades.forEach((nombre) => {
    const btn = crear('button', nombre === actual ? 'active' : '', nombre.charAt(0).toUpperCase() + nombre.slice(1));
    btn.addEventListener('click', () => {
      actual = nombre;
      currentMode = 'entities';
      renderizarBarraLateral();
      tituloEl.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1);
      buscarEl.value = '';
      cargarDatos();
      construirFormulario();
      cargarOpcionesUpdate();
      if (dataPanel) dataPanel.style.display = '';
      if (adminPanel) adminPanel.style.display = 'none';
      if (btnAdminPanel) btnAdminPanel.classList.remove('active');
    });
    listaEntidadesEl.appendChild(btn);
  });
}

function detectarIdKey(filas) {
  if (!filas || !filas.length) return null;
  const keys = Object.keys(filas[0] || {});
  // Preferir una clave que empiece por 'id'
  const idLike = keys.find((k) => /^id/i.test(k));
  return idLike || keys[0];
}

function renderizarTabla(filas) {
  contenedorTabla.innerHTML = '';
  if (!filas || filas.length === 0) {
    contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos para mostrar</div>';
    return;
  }
  const tabla = crear('table');
  const thead = crear('thead');
  const htr = crear('tr');
  const encabezados = Object.keys(filas[0]);
  encabezados.forEach((h) => htr.appendChild(crear('th', '', h)));
  if (currentUser?.rol === 'Administrador') {
    htr.appendChild(crear('th', '', 'Acciones'));
  }
  thead.appendChild(htr);
  const tbody = crear('tbody');
  const idKey = detectarIdKey(filas);
  filas.forEach((r) => {
    const tr = crear('tr');
    encabezados.forEach((h) => {
      const td = crear('td');
      td.textContent = r[h] == null ? '' : String(r[h]);
      tr.appendChild(td);
    });
    if (currentUser?.rol === 'Administrador') {
      const tdAcc = crear('td');
      const btnSetId = crear('button', '', 'Seleccionar ID');
      btnSetId.addEventListener('click', () => {
        if (idKey) {
          const idVal = String(r[idKey]);
          // Ensure the ID exists in the dropdown
          if (updateIdInput) {
            let opt = Array.from(updateIdInput.options).find(o => o.value === idVal);
            if (!opt) {
              opt = document.createElement('option');
              opt.value = idVal;
              opt.textContent = `ID ${idVal}`;
              updateIdInput.appendChild(opt);
            }
            updateIdInput.value = idVal;
          }
        }
        updateMsg.textContent = `ID seleccionado: ${r[idKey]}`;
      });
      tdAcc.appendChild(btnSetId);
      tr.appendChild(tdAcc);
    }
    tbody.appendChild(tr);
  });
  tabla.appendChild(thead);
  tabla.appendChild(tbody);
  contenedorTabla.appendChild(tabla);
}

async function cargarDatos() {
  if (currentMode !== 'entities') return;
  if (!currentUser || currentUser.rol !== 'Administrador') return; // solo admin lista
  const q = buscarEl.value.trim();
  const url = q ? `/api/list/${actual}?q=${encodeURIComponent(q)}` : `/api/list/${actual}`;
  contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando...</div>';
  try {
    if (ultimoAbortCtrl) ultimoAbortCtrl.abort();
    const ctrl = new AbortController();
    ultimoAbortCtrl = ctrl;
    const datos = await apiFetch(url, { signal: ctrl.signal });
    renderizarTabla(datos);
  } catch (e) {
    if (e.name === 'AbortError') return; // ignore
    contenedorTabla.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--error);">Error: ${e.message}</div>`;
  }
}

buscarEl.addEventListener('input', () => {
  // simple debounce
  if (buscarEl._t) clearTimeout(buscarEl._t);
  buscarEl._t = setTimeout(cargarDatos, 300);
});

// Auth flow
async function checkAuth() {
  try {
    const me = await apiFetch('/api/auth/me');
    currentUser = me.user;
  } catch (_) {
    currentUser = null;
  }
  updateUIForAuth();
}

function updateUIForAuth() {
  if (!currentUser) {
    // Show login
    loginArea.style.display = '';
    appArea.style.display = 'none';
    logoutBtn.style.display = 'none';
  } else if (currentUser.rol === 'Administrador') {
    // Show admin app
    loginArea.style.display = 'none';
    appArea.style.display = '';
    logoutBtn.style.display = '';
    empleadoPanel.style.display = 'none';
    contenedorFormulario.style.display = '';
    document.querySelector('.toolbar').style.display = '';
    document.getElementById('formWrap').style.display = '';
    updateControls.style.display = '';
    if (adminNav) adminNav.style.display = '';
    renderizarBarraLateral();
    construirFormulario();
    cargarOpcionesUpdate();
    currentMode = 'entities';
    if (dataPanel) dataPanel.style.display = '';
    if (adminPanel) adminPanel.style.display = 'none';
    cargarDatos();
  } else {
    // Empleado view
    loginArea.style.display = 'none';
    appArea.style.display = '';
    logoutBtn.style.display = '';
    // Hide admin-only sections
    barraLateral.style.display = 'none';
    document.querySelector('.toolbar').style.display = 'none';
    document.getElementById('formWrap').style.display = 'none';
    if (adminNav) adminNav.style.display = 'none';
    if (dataPanel) dataPanel.style.display = '';
    if (adminPanel) adminPanel.style.display = 'none';
    contenedorTabla.innerHTML = '';
    tituloEl.textContent = 'Mi panel';
    empleadoPanel.style.display = '';
    cargarMisDatos();
  }
}

// Map singular entity to plural route for /api/min/*
const pluralMap = {
  empleado: 'empleados',
  cliente: 'clientes',
  proyecto: 'proyectos',
  apartamento: 'apartamentos',
  piso: 'pisos',
  material: 'materiales',
  inventario: 'inventarios',
  ingreso: 'ingresos',
  gasto: 'gastos',
  factura: 'facturas',
  pago: 'pagos',
  tarea: 'tareas',
  turno: 'turnos'
};

function getPlural(name) {
  return pluralMap[name] || `${name}s`;
}

function textForItemOption(item) {
  const id = item.id ?? item.ID ?? item.Id ?? item.idEmpleado ?? item.idCliente ?? item.idProyecto ?? item.idMaterial ?? item.idFactura ?? item.idTurno ?? item.idTarea ?? item.idInventario ?? item.idIngreso ?? item.idGasto ?? item.idPago;
  const candidates = [
    item.nombre, item.Nombre, item.descripcion, item.Descripcion,
    item.Correo, item.Telefono, item.tipo_movimiento,
    item.Fecha, item.fecha, item.numero, item.num_apartamento, item.num_piso
  ];
  const label = candidates.find(v => v != null && v !== '') || '';
  return `${id != null ? id : ''}${label ? ' - ' + label : ''}`.trim();
}

async function cargarOpcionesUpdate() {
  if (!updateIdInput) return;
  // Clear existing options
  updateIdInput.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Selecciona --';
  updateIdInput.appendChild(placeholder);
  // Try min endpoint first
  const plural = getPlural(actual);
  let items = [];
  try {
    items = await apiFetch(`/api/min/${plural}`);
  } catch (_) {
    try {
      items = await apiFetch(`/api/list/${actual}`);
    } catch (_) {
      items = [];
    }
  }
  // Normalize to array of objects with id and nombre-ish
  if (!Array.isArray(items)) items = [];
  items.forEach((it) => {
    const opt = document.createElement('option');
    const id = it.id ?? it.ID ?? it.Id ?? it.idEmpleado ?? it.idCliente ?? it.idProyecto ?? it.idMaterial ?? it.idFactura ?? it.idTurno ?? it.idTarea ?? it.idInventario ?? it.idIngreso ?? it.idGasto ?? it.idPago;
    if (id == null) return;
    opt.value = String(id);
    opt.textContent = textForItemOption(it) || `ID ${id}`;
    updateIdInput.appendChild(opt);
  });
}

async function cargarMisDatos() {
  try {
    const info = await apiFetch('/api/empleado/mis-datos');
    empleadoInfo.innerHTML = `
      <div><strong>Nombre:</strong> ${info.Nombre || ''}</div>
      <div><strong>Correo:</strong> ${info.Correo || ''}</div>
      <div><strong>Teléfono:</strong> ${info.Telefono || ''}</div>
      <div><strong>Proyecto:</strong> ${info.Proyecto || '—'}</div>
      <div><strong>Asistencia:</strong> ${info.Asistencia || '—'}</div>
    `;
  } catch (e) {
    empleadoInfo.innerHTML = `<div style="color:salmon;">Error: ${e.message}</div>`;
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    loginMsg.textContent = 'Ingresando...';
    loginMsg.style.color = '';
    const formData = new FormData(loginForm);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password')
    };
    try {
      const r = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.requires2fa) {
        // Show TOTP form
        loginMsg.textContent = 'Se requiere 2FA. Ingresa el código.';
        totpForm.style.display = '';
        loginForm.style.display = 'none';
      } else {
        currentUser = r.user;
        loginForm.reset();
        updateUIForAuth();
      }
    } catch (e) {
      loginMsg.style.color = 'salmon';
      loginMsg.textContent = e.message;
    }
  });
}

if (totpForm) {
  totpForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    totpMsg.textContent = 'Verificando...';
    totpMsg.style.color = '';
    const token = new FormData(totpForm).get('token');
    try {
      const r = await apiFetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      currentUser = r.user;
      totpForm.reset();
      totpForm.style.display = 'none';
      loginForm.style.display = '';
      updateUIForAuth();
    } catch (e) {
      totpMsg.style.color = 'salmon';
      totpMsg.textContent = e.message;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    currentUser = null;
    // Reset view to defaults
    barraLateral.style.display = '';
    updateUIForAuth();
  });
}

if (btnMarcarAsistencia) {
  btnMarcarAsistencia.addEventListener('click', async () => {
    asistenciaMsg.textContent = 'Marcando...';
    try {
      await apiFetch('/api/empleado/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Presente' })
      });
      asistenciaMsg.style.color = '';
      asistenciaMsg.textContent = 'Asistencia marcada';
      cargarMisDatos();
    } catch (e) {
      asistenciaMsg.style.color = 'salmon';
      asistenciaMsg.textContent = e.message;
    }
  });
}

checkAuth();

// Define form fields for each entity 
const camposFormulario = {
  cliente: [
    { name: 'Nombre', type: 'text', req: true, pattern: '[A-Za-zÁÉÍÓÚáéíóúÑñ\\s]+' },
    { name: 'Telefono', type: 'tel' },
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
    { name: 'Nombre', type: 'text', req: true, pattern: '[A-Za-zÁÉÍÓÚáéíóúÑñ\\s]+'},
    { name: 'Correo', type: 'email' },
    { name: 'Telefono', type: 'tel' },
    { name: 'Asistencia', type: 'select', options: ['Presente','Ausente'] },
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

async function construirFormulario() {
  tituloFormulario.textContent = actual.charAt(0).toUpperCase() + actual.slice(1);
  formularioDinamico.innerHTML = '';
  mensajeFormulario.textContent = '';
  const campos = camposFormulario[actual] || [];
  for (const f of campos) {
    const etiqueta = crear('label', '', f.name);
    formularioDinamico.appendChild(etiqueta);
    if (f.type === 'select') {
      const selectEl = crear('select');
      selectEl.name = f.name;
      const opcionVacia = crear('option', '', '--');
      opcionVacia.value = '';
      selectEl.appendChild(opcionVacia);
      if (f.options) {
        f.options.forEach((v) => {
          const op = crear('option', '', v);
          op.value = v;
          selectEl.appendChild(op);
        });
      }
      if (f.source) {
        try {
          const resp = await fetch(`${apiBase}${f.source}`);
          const datos = await resp.json();
          datos.forEach((item) => {
            const op = crear('option', '', `${item.id} - ${item.nombre}`);
            op.value = item.id;
            selectEl.appendChild(op);
          });
        } catch (e) { /* ignorar en simple */ }
      }
      formularioDinamico.appendChild(selectEl);
    } else {
      const inputEl = crear('input');
      inputEl.name = f.name;
      inputEl.type = f.type || 'text';
      if (f.step) inputEl.step = f.step;
      if (f.req) inputEl.required = true;

      // Reglas de validación en vivo según tipo
      const nombreEnMinusculas = (f.name || '').toLowerCase();
      if (inputEl.type === 'email') {
        // Sin sanitización adicional para email
      } else if (inputEl.type === 'tel' || nombreEnMinusculas.includes('telefono')) {
        // Solo dígitos en teléfono, exactamente 10
        inputEl.setAttribute('pattern', '\\d{10}');
        inputEl.setAttribute('inputmode', 'numeric');
        inputEl.setAttribute('maxlength', '10');
        inputEl.setAttribute('minlength', '10');
        if (!inputEl.placeholder) inputEl.placeholder = '10 dígitos';
        inputEl.addEventListener('input', () => {
          let limpio = sanitizarDigitos(inputEl.value);
          if (limpio.length > 10) limpio = limpio.slice(0, 10);
          if (inputEl.value !== limpio) inputEl.value = limpio;
        });
      } else if (inputEl.type === 'text') {
        // Si no hay un patrón específico, aceptar solo letras y espacios
        if (f.pattern) {
          inputEl.setAttribute('pattern', f.pattern);
        } else {
          inputEl.setAttribute('pattern', '[A-Za-zÁÉÍÓÚáéíóúÑñ\\s]+');
        }
        inputEl.addEventListener('input', () => {
          const limpio = sanitizarLetrasYEspacios(inputEl.value);
          if (inputEl.value !== limpio) inputEl.value = limpio;
        });
      }
      formularioDinamico.appendChild(inputEl);
    }
  }
  const boton = crear('button', '', 'Guardar');
  boton.type = 'submit';
  formularioDinamico.appendChild(boton);
  // Reset update ID when changing entity
  if (updateIdInput) updateIdInput.value = '';
}

formularioDinamico.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  mensajeFormulario.style.color = '#89ff9f';
  mensajeFormulario.textContent = 'Guardando...';
  const datos = {};
  Array.from(formularioDinamico.elements).forEach((el) => {
    if (!el.name) return;
    if (el.type === 'submit') return;
    if (el.tagName === 'SELECT' || el.type !== 'checkbox') datos[el.name] = el.value === '' ? null : el.value;
  });
  try {
    const r = await apiFetch(`/api/create/${actual}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    mensajeFormulario.textContent = 'Guardado con id ' + r.id;
    formularioDinamico.reset();
    cargarDatos();
    cargarOpcionesUpdate();
  } catch (e) {
    mensajeFormulario.style.color = 'salmon';
    mensajeFormulario.textContent = 'Error: ' + e.message;
  }
});

// Update by ID using current form fields (admin)
if (btnUpdate) {
  btnUpdate.addEventListener('click', async () => {
    updateMsg.textContent = '';
  const id = (updateIdInput.value || '').trim();
    if (!id) { updateMsg.style.color = 'salmon'; updateMsg.textContent = 'Ingrese ID'; return; }
    const datos = {};
    Array.from(formularioDinamico.elements).forEach((el) => {
      if (!el.name || el.type === 'submit') return;
      if (el.tagName === 'SELECT' || el.type !== 'checkbox') {
        if (el.value !== '') datos[el.name] = el.value; // solo campos llenos
      }
    });
    if (Object.keys(datos).length === 0) {
      updateMsg.style.color = 'salmon';
      updateMsg.textContent = 'Complete al menos un campo para actualizar';
      return;
    }
    try {
      await apiFetch(`/api/update/${actual}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      updateMsg.style.color = '';
      updateMsg.textContent = 'Actualizado correctamente';
      cargarDatos();
      cargarOpcionesUpdate();
    } catch (e) {
      updateMsg.style.color = 'salmon';
      updateMsg.textContent = e.message;
    }
  });
}

// Delete by ID (admin)
if (btnDelete) {
  btnDelete.addEventListener('click', async () => {
    updateMsg.textContent = '';
  const id = (updateIdInput.value || '').trim();
    if (!id) { updateMsg.style.color = 'salmon'; updateMsg.textContent = 'Ingrese ID'; return; }
    if (!confirm('¿Eliminar registro ' + id + '?')) return;
    try {
      await apiFetch(`/api/delete/${actual}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      updateMsg.style.color = '';
      updateMsg.textContent = 'Eliminado';
      formularioDinamico.reset();
      updateIdInput.value = '';
      cargarDatos();
      cargarOpcionesUpdate();
    } catch (e) {
      updateMsg.style.color = 'salmon';
      updateMsg.textContent = e.message;
    }
  });
}

// Admin create form submit (multipart)
if (adminCreateForm) {
  adminCreateForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    adminCreateMsg.textContent = 'Creando...';
    adminCreateMsg.style.color = '';
    const fd = new FormData(adminCreateForm);
    try {
      const res = await fetch(`${apiBase}/api/admin/create`, {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error');
      adminCreateMsg.textContent = `Admin creado (id ${body.idUsuario})`;
      adminCreateForm.reset();
    } catch (e) {
      adminCreateMsg.style.color = 'salmon';
      adminCreateMsg.textContent = e.message;
    }
  });
}
