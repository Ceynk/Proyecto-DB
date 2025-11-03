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
// Paneles / navegación admin
const panelDatos = document.getElementById('dataPanel');
const panelAdmin = document.getElementById('adminPanel');
const navAdmin = document.getElementById('adminNav');
const btnPanelAdmin = document.getElementById('btnAdminPanel');
const barraLateral = document.getElementById('sidebar');
let modoActual = 'entidades'; // 'entidades' | 'admin'

// Elementos de Autenticación/UI
const areaLogin = document.getElementById('loginArea');
const areaApp = document.getElementById('appArea');
const formularioLogin = document.getElementById('loginForm');
const mensajeLogin = document.getElementById('loginMsg');
const formularioTotp = document.getElementById('totpForm');
const mensajeTotp = document.getElementById('totpMsg');
const btnCerrarSesion = document.getElementById('logoutBtn');

// ---

// Empleado-only panel
const empleadoPanel = document.getElementById('empleadoPanel');
const empleadoInfo = document.getElementById('empleadoInfo');
const btnMarcarAsistencia = document.getElementById('btnMarcarAsistencia');
const asistenciaMsg = document.getElementById('asistenciaMsg');

// Controles de Actualización/Eliminación
const controlesActualizacion = document.getElementById('updateControls');
const entradaIdActualizacion = document.getElementById('updateIdInput');
const btnActualizar = document.getElementById('btnUpdate');
const btnEliminar = document.getElementById('btnDelete');
const mensajeActualizacion = document.getElementById('updateMsg');

// Controles de subida de foto para empleado/material
let contenedorSubidaFoto = null;
let inputSubidaFoto = null;
let btnSubirFoto = null;
let mensajeFoto = null;
function inicializarControlesFoto() {
  if (!controlesActualizacion || contenedorSubidaFoto) return;
  contenedorSubidaFoto = document.createElement('div');
  contenedorSubidaFoto.style.gridColumn = '1 / -1';
  contenedorSubidaFoto.style.display = 'none';
  contenedorSubidaFoto.style.gap = '.5rem';
  contenedorSubidaFoto.style.alignItems = 'center';

  const label = document.createElement('label');
  label.textContent = 'Imagen (solo Empleado o Material)';
  label.style.display = 'block';
  label.style.marginBottom = '.25rem';

  inputSubidaFoto = document.createElement('input');
  inputSubidaFoto.type = 'file';
  inputSubidaFoto.accept = 'image/*';
  inputSubidaFoto.style.maxWidth = '100%';

  btnSubirFoto = document.createElement('button');
  btnSubirFoto.type = 'button';
  btnSubirFoto.textContent = 'Subir imagen';
  btnSubirFoto.style.marginLeft = '.5rem';

  mensajeFoto = document.createElement('div');
  mensajeFoto.className = 'form-msg';
  mensajeFoto.style.marginTop = '.25rem';

  const fila = document.createElement('div');
  fila.style.display = 'flex';
  fila.style.gap = '.5rem';
  fila.style.flexWrap = 'wrap';
  fila.appendChild(inputSubidaFoto);
  fila.appendChild(btnSubirFoto);

  contenedorSubidaFoto.appendChild(label);
  contenedorSubidaFoto.appendChild(fila);
  contenedorSubidaFoto.appendChild(mensajeFoto);
  controlesActualizacion.appendChild(contenedorSubidaFoto);

  btnSubirFoto.addEventListener('click', subirImagenEntidadActual);
}

function actualizarVisibilidadControlesFoto() {
  if (!contenedorSubidaFoto) return;
  const esEntidadConFoto = entidadActual === 'empleado' || entidadActual === 'material';
  const esAdmin = usuarioActual?.rol === 'Administrador';
  contenedorSubidaFoto.style.display = esEntidadConFoto && esAdmin ? '' : 'none';
  if (!esEntidadConFoto && inputSubidaFoto) inputSubidaFoto.value = '';
  if (mensajeFoto) { mensajeFoto.textContent = ''; mensajeFoto.style.color = ''; }
}

async function subirImagenEntidadActual() {
  if (!inputSubidaFoto || !inputSubidaFoto.files || inputSubidaFoto.files.length === 0) {
    if (mensajeFoto) { mensajeFoto.style.color = 'salmon'; mensajeFoto.textContent = 'Selecciona una imagen'; }
    return;
  }
  const id = (entradaIdActualizacion?.value || '').trim();
  if (!id) { if (mensajeFoto) { mensajeFoto.style.color = 'salmon'; mensajeFoto.textContent = 'Selecciona un ID'; } return; }
  const archivo = inputSubidaFoto.files[0];
  const fd = new FormData();
  fd.append('foto', archivo);
  const ruta = entidadActual === 'empleado' ? `/api/empleados/${encodeURIComponent(id)}/foto` : `/api/materiales/${encodeURIComponent(id)}/foto`;
  try {
    if (mensajeFoto) { mensajeFoto.style.color = ''; mensajeFoto.textContent = 'Subiendo...'; }
    const res = await fetch(`${baseAPI}${ruta}`, { method: 'POST', credentials: 'include', body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Error al subir');
    if (mensajeFoto) { mensajeFoto.style.color = ''; mensajeFoto.textContent = 'Imagen actualizada'; }
    inputSubidaFoto.value = '';
    cargarDatos();
  } catch (e) {
    if (mensajeFoto) { mensajeFoto.style.color = 'salmon'; mensajeFoto.textContent = e.message; }
  }
}
// Admin panel navigation
if (btnPanelAdmin) {
  btnPanelAdmin.addEventListener('click', () => {
    if (usuarioActual?.rol !== 'Administrador') return;
    modoActual = 'admin';
    if (panelDatos) panelDatos.style.display = 'none';
    if (panelAdmin) panelAdmin.style.display = '';
    // Remove active class from entity buttons
    Array.from(listaEntidadesEl.children).forEach((b) => b.classList.remove('active'));
    btnPanelAdmin.classList.add('active');
  });
}

// Admin create form
const envoltorioCrearAdmin = document.getElementById('adminCreateWrap');
const formularioCrearAdmin = document.getElementById('adminCreateForm');
const mensajeCrearAdmin = document.getElementById('adminCreateMsg');
// Lista/eliminación de usuarios admin
const envoltorioUsuariosAdmin = document.getElementById('adminUsersWrap');
const tablaUsuariosAdmin = document.getElementById('adminUsersTable');
const mensajeUsuariosAdmin = document.getElementById('adminUsersMsg');
const btnRefrescarAdmins = document.getElementById('btnRefreshAdmins');


// en index.html o guarda una clave `API_BASE` en localStorage con la URL del backend en Railway.
const baseAPI = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';

let usuarioActual = null;
async function solicitarAPI(ruta, opciones = {}) {
  const opcionesFinales = Object.assign({ credentials: 'include' }, opciones);
  const res = await fetch(`${baseAPI}${ruta}`, opcionesFinales);
  const tipoContenido = res.headers.get('content-type') || '';
  const cuerpo = tipoContenido.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof cuerpo === 'string' ? cuerpo : (cuerpo && cuerpo.error) || 'Error';
    throw new Error(msg);
  }
  return cuerpo;
}

const entidades = [
  'empleado', 'cliente', 'proyecto', 'apartamento', 'piso', 'material',
  'inventario', 'ingreso', 'gasto', 'pago', 'tarea', 'turno', 'factura'
];

let entidadActual = 'empleado';
let ultimoControlAbortar = null;

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
    const btn = crear('button', nombre === entidadActual ? 'active' : '', nombre.charAt(0).toUpperCase() + nombre.slice(1));
    btn.addEventListener('click', () => {
      entidadActual = nombre;
      modoActual = 'entidades';
      renderizarBarraLateral();
      tituloEl.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1);
      buscarEl.value = '';
      cargarDatos();
      construirFormulario();
      cargarOpcionesActualizacion();
      if (panelDatos) panelDatos.style.display = '';
      if (panelAdmin) panelAdmin.style.display = 'none';
      if (btnPanelAdmin) btnPanelAdmin.classList.remove('active');
    });
    listaEntidadesEl.appendChild(btn);
  });
}

function detectarClaveId(filas) {
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
  if (usuarioActual?.rol === 'Administrador') {
    htr.appendChild(crear('th', '', 'Acciones'));
  }
  thead.appendChild(htr);
  const tbody = crear('tbody');
  const claveId = detectarClaveId(filas);
  filas.forEach((r) => {
    const tr = crear('tr');
    encabezados.forEach((h) => {
      const td = crear('td');
      const val = r[h];
      if (val && typeof val === 'string' && /foto/i.test(h)) {
        const img = document.createElement('img');
        img.src = val;
        img.alt = 'img';
        img.style.maxWidth = '64px';
        img.style.maxHeight = '64px';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid var(--border-light)';
        td.appendChild(img);
      } else {
        td.textContent = val == null ? '' : String(val);
      }
      tr.appendChild(td);
    });
  if (usuarioActual?.rol === 'Administrador') {
      const tdAcciones = crear('td');
      const btnSeleccionarId = crear('button', '', 'Seleccionar ID');
      btnSeleccionarId.addEventListener('click', () => {
        if (claveId) {
          const idVal = String(r[claveId]);
          // Ensure the ID exists in the dropdown
          if (entradaIdActualizacion) {
            let opt = Array.from(entradaIdActualizacion.options).find(o => o.value === idVal);
            if (!opt) {
              opt = document.createElement('option');
              opt.value = idVal;
              opt.textContent = `ID ${idVal}`;
              entradaIdActualizacion.appendChild(opt);
            }
            entradaIdActualizacion.value = idVal;
          }
        }
        mensajeActualizacion.textContent = `ID seleccionado: ${r[claveId]}`;
      });
      tdAcciones.appendChild(btnSeleccionarId);
      tr.appendChild(tdAcciones);
    }
    tbody.appendChild(tr);
  });
  tabla.appendChild(thead);
  tabla.appendChild(tbody);
  contenedorTabla.appendChild(tabla);
}

async function cargarDatos() {
  if (modoActual !== 'entidades') return;
  if (!usuarioActual || usuarioActual.rol !== 'Administrador') return; // solo admin lista
  const q = buscarEl.value.trim();
  const url = q ? `/api/list/${entidadActual}?q=${encodeURIComponent(q)}` : `/api/list/${entidadActual}`;
  contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando...</div>';
  try {
    if (ultimoControlAbortar) ultimoControlAbortar.abort();
    const ctrl = new AbortController();
    ultimoControlAbortar = ctrl;
    const datos = await solicitarAPI(url, { signal: ctrl.signal });
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
async function verificarAutenticacion() {
  try {
    const me = await solicitarAPI('/api/auth/me');
    usuarioActual = me.user;
  } catch (_) {
    usuarioActual = null;
  }
  actualizarUIParaAutenticacion();
}

function actualizarUIParaAutenticacion() {
  if (!usuarioActual) {
    // Show login
    areaLogin.style.display = '';
    areaApp.style.display = 'none';
    btnCerrarSesion.style.display = 'none';
  // ---
  } else if (usuarioActual.rol === 'Administrador') {
    // Show admin app
    areaLogin.style.display = 'none';
    areaApp.style.display = '';
    btnCerrarSesion.style.display = '';
    empleadoPanel.style.display = 'none';
    contenedorFormulario.style.display = '';
    document.querySelector('.toolbar').style.display = '';
    document.getElementById('formWrap').style.display = '';
    controlesActualizacion.style.display = '';
    if (navAdmin) navAdmin.style.display = '';
    renderizarBarraLateral();
    construirFormulario();
    cargarOpcionesActualizacion();
    modoActual = 'entidades';
    if (panelDatos) panelDatos.style.display = '';
    if (panelAdmin) panelAdmin.style.display = 'none';
    cargarDatos();
    // Pre-cargar admins para tener la lista actualizada si abren el panel
    cargarAdminsSeguro();
    inicializarControlesFoto();
    actualizarVisibilidadControlesFoto();
  } else {
    // Empleado view
    areaLogin.style.display = 'none';
    areaApp.style.display = '';
    btnCerrarSesion.style.display = '';
    // Hide admin-only sections
    barraLateral.style.display = 'none';
    document.querySelector('.toolbar').style.display = 'none';
    document.getElementById('formWrap').style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
    if (panelDatos) panelDatos.style.display = '';
    if (panelAdmin) panelAdmin.style.display = 'none';
    contenedorTabla.innerHTML = '';
    tituloEl.textContent = 'Mi panel';
    empleadoPanel.style.display = '';
    cargarMisDatos();
  }
}

// ---

// Map singular entity to plural route for /api/min/*
const mapaPlural = {
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

function obtenerPlural(nombre) {
  return mapaPlural[nombre] || `${nombre}s`;
}

function textoParaOpcionItem(item) {
  const id = item.id ?? item.ID ?? item.Id ?? item.idEmpleado ?? item.idCliente ?? item.idProyecto ?? item.idMaterial ?? item.idFactura ?? item.idTurno ?? item.idTarea ?? item.idInventario ?? item.idIngreso ?? item.idGasto ?? item.idPago;
  const candidates = [
    item.nombre, item.Nombre, item.descripcion, item.Descripcion,
    item.Correo, item.Telefono, item.tipo_movimiento,
    item.Fecha, item.fecha, item.numero, item.num_apartamento, item.num_piso
  ];
  const label = candidates.find(v => v != null && v !== '') || '';
  return `${id != null ? id : ''}${label ? ' - ' + label : ''}`.trim();
}

async function cargarOpcionesActualizacion() {
  if (!entradaIdActualizacion) return;
  // Clear existing options
  entradaIdActualizacion.innerHTML = '';
  const marcadorPosicion = document.createElement('option');
  marcadorPosicion.value = '';
  marcadorPosicion.textContent = '-- Selecciona --';
  entradaIdActualizacion.appendChild(marcadorPosicion);
  // Try min endpoint first
  const plural = obtenerPlural(entidadActual);
  let elementos = [];
  try {
    elementos = await solicitarAPI(`/api/min/${plural}`);
  } catch (_) {
    try {
      elementos = await solicitarAPI(`/api/list/${entidadActual}`);
    } catch (_) {
      elementos = [];
    }
  }
  // Normalize to array of objects with id and nombre-ish
  if (!Array.isArray(elementos)) elementos = [];
  elementos.forEach((it) => {
    const opt = document.createElement('option');
    const id = it.id ?? it.ID ?? it.Id ?? it.idEmpleado ?? it.idCliente ?? it.idProyecto ?? it.idMaterial ?? it.idFactura ?? it.idTurno ?? it.idTarea ?? it.idInventario ?? it.idIngreso ?? it.idGasto ?? it.idPago;
    if (id == null) return;
    opt.value = String(id);
    opt.textContent = textoParaOpcionItem(it) || `ID ${id}`;
    entradaIdActualizacion.appendChild(opt);
  });
}

async function cargarMisDatos() {
  try {
    const info = await solicitarAPI('/api/empleado/mis-datos');
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

if (formularioLogin) {
  formularioLogin.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mensajeLogin.textContent = 'Ingresando...';
    mensajeLogin.style.color = '';
    const formData = new FormData(formularioLogin);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password')
    };
    try {
      const r = await solicitarAPI('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.requires2fa) {
        // Show TOTP form
        mensajeLogin.textContent = 'Se requiere 2FA. Ingresa el código.';
        formularioTotp.style.display = '';
        formularioLogin.style.display = 'none';
      } else {
        usuarioActual = r.user;
        formularioLogin.reset();
        actualizarUIParaAutenticacion();
      }
    } catch (e) {
      mensajeLogin.style.color = 'salmon';
      mensajeLogin.textContent = e.message;
    }
  });
}

if (formularioTotp) {
  formularioTotp.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mensajeTotp.textContent = 'Verificando...';
    mensajeTotp.style.color = '';
    const token = new FormData(formularioTotp).get('token');
    try {
      const r = await solicitarAPI('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      usuarioActual = r.user;
      formularioTotp.reset();
      formularioTotp.style.display = 'none';
      formularioLogin.style.display = '';
      actualizarUIParaAutenticacion();
    } catch (e) {
      mensajeTotp.style.color = 'salmon';
      mensajeTotp.textContent = e.message;
    }
  });
}

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener('click', async () => {
    try { await solicitarAPI('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    usuarioActual = null;
    // Reset view to defaults
    barraLateral.style.display = '';
    actualizarUIParaAutenticacion();
  });
}

if (btnMarcarAsistencia) {
  btnMarcarAsistencia.addEventListener('click', async () => {
    asistenciaMsg.textContent = 'Marcando...';
    try {
      await solicitarAPI('/api/empleado/asistencia', {
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

verificarAutenticacion();

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
  tituloFormulario.textContent = entidadActual.charAt(0).toUpperCase() + entidadActual.slice(1);
  formularioDinamico.innerHTML = '';
  mensajeFormulario.textContent = '';
  const campos = camposFormulario[entidadActual] || [];
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
          const resp = await fetch(`${baseAPI}${f.source}`);
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
  if (entradaIdActualizacion) entradaIdActualizacion.value = '';
  inicializarControlesFoto();
  actualizarVisibilidadControlesFoto();
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
    const r = await solicitarAPI(`/api/create/${entidadActual}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    mensajeFormulario.textContent = 'Guardado con id ' + r.id;
    formularioDinamico.reset();
    cargarDatos();
    cargarOpcionesActualizacion();
  } catch (e) {
    mensajeFormulario.style.color = 'salmon';
    mensajeFormulario.textContent = 'Error: ' + e.message;
  }
});

// Update by ID using current form fields (admin)
if (btnActualizar) {
  btnActualizar.addEventListener('click', async () => {
    mensajeActualizacion.textContent = '';
    const id = (entradaIdActualizacion.value || '').trim();
    if (!id) { mensajeActualizacion.style.color = 'salmon'; mensajeActualizacion.textContent = 'Ingrese ID'; return; }
    const datos = {};
    Array.from(formularioDinamico.elements).forEach((el) => {
      if (!el.name || el.type === 'submit') return;
      if (el.tagName === 'SELECT' || el.type !== 'checkbox') {
        if (el.value !== '') datos[el.name] = el.value; // solo campos llenos
      }
    });
    if (Object.keys(datos).length === 0) {
      mensajeActualizacion.style.color = 'salmon';
      mensajeActualizacion.textContent = 'Complete al menos un campo para actualizar';
      return;
    }
    try {
      await solicitarAPI(`/api/update/${entidadActual}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      mensajeActualizacion.style.color = '';
      mensajeActualizacion.textContent = 'Actualizado correctamente';
      cargarDatos();
      cargarOpcionesActualizacion();
    } catch (e) {
      mensajeActualizacion.style.color = 'salmon';
      mensajeActualizacion.textContent = e.message;
    }
  });
}

// Delete by ID (admin)
if (btnEliminar) {
  btnEliminar.addEventListener('click', async () => {
    mensajeActualizacion.textContent = '';
    const id = (entradaIdActualizacion.value || '').trim();
    if (!id) { mensajeActualizacion.style.color = 'salmon'; mensajeActualizacion.textContent = 'Ingrese ID'; return; }
    if (!confirm('¿Eliminar registro ' + id + '?')) return;
    try {
      await solicitarAPI(`/api/delete/${entidadActual}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      mensajeActualizacion.style.color = '';
      mensajeActualizacion.textContent = 'Eliminado';
      formularioDinamico.reset();
      entradaIdActualizacion.value = '';
      cargarDatos();
      cargarOpcionesActualizacion();
      actualizarVisibilidadControlesFoto();
    } catch (e) {
      mensajeActualizacion.style.color = 'salmon';
      mensajeActualizacion.textContent = e.message;
    }
  });
}

// Admin create form submit (multipart)
if (formularioCrearAdmin) {
  formularioCrearAdmin.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mensajeCrearAdmin.textContent = 'Creando...';
    mensajeCrearAdmin.style.color = '';
    const fd = new FormData(formularioCrearAdmin);
    try {
      const res = await fetch(`${baseAPI}/api/admin/create`, {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error');
      mensajeCrearAdmin.textContent = `Admin creado (id ${body.idUsuario})`;
      formularioCrearAdmin.reset();
      cargarAdminsSeguro();
    } catch (e) {
      mensajeCrearAdmin.style.color = 'salmon';
      mensajeCrearAdmin.textContent = e.message;
    }
  });
}

// ===== Administradores: listar y eliminar =====
async function cargarAdmins() {
  if (!tablaUsuariosAdmin) return;
  tablaUsuariosAdmin.innerHTML = '<div style="text-align:center; padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const lista = await solicitarAPI('/api/admin/users');
    if (!Array.isArray(lista) || lista.length === 0) {
      tablaUsuariosAdmin.innerHTML = '<div style="text-align:center; padding:1rem; color: var(--text-muted);">No hay administradores</div>';
      return;
    }
    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['ID','Usuario','2FA','Foto','Acciones'].forEach(h => {
      const th = document.createElement('th'); th.textContent = h; trh.appendChild(th);
    });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(u => {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.textContent = u.idUsuario; tr.appendChild(tdId);
      const tdUser = document.createElement('td'); tdUser.textContent = u.nombre_usuario; tr.appendChild(tdUser);
      const td2fa = document.createElement('td'); td2fa.textContent = u.has2fa ? 'Sí' : 'No'; tr.appendChild(td2fa);
      const tdFoto = document.createElement('td');
      if (u.foto_url) {
        const img = document.createElement('img');
        img.src = u.foto_url;
        img.alt = 'foto';
        img.style.maxWidth = '56px';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid var(--border-light)';
        tdFoto.appendChild(img);
      } else {
        tdFoto.textContent = '—';
      }
      tr.appendChild(tdFoto);

      const tdAcc = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.textContent = 'Eliminar';
      btnDel.style.background = '#ef4444';
      btnDel.addEventListener('click', async () => {
        await eliminarAdmin(u.idUsuario);
      });
      tdAcc.appendChild(btnDel);
      tr.appendChild(tdAcc);
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead);
    tabla.appendChild(tbody);
    tablaUsuariosAdmin.innerHTML = '';
    tablaUsuariosAdmin.appendChild(tabla);
  } catch (e) {
    tablaUsuariosAdmin.innerHTML = `<div style="color:salmon; padding:1rem;">Error: ${e.message}</div>`;
  }
}

async function eliminarAdmin(id) {
  mensajeUsuariosAdmin.textContent = '';
  if (!id) return;
  if (!confirm('¿Eliminar administrador ' + id + '?')) return;
  try {
    const res = await solicitarAPI(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    mensajeUsuariosAdmin.style.color = '';
    mensajeUsuariosAdmin.textContent = 'Administrador eliminado';
    await cargarAdmins();
  } catch (e) {
    mensajeUsuariosAdmin.style.color = 'salmon';
    mensajeUsuariosAdmin.textContent = e.message;
  }
}

function cargarAdminsSeguro() {
  if (usuarioActual?.rol === 'Administrador' && envoltorioUsuariosAdmin && tablaUsuariosAdmin) {
    cargarAdmins();
  }
}

if (btnRefrescarAdmins) {
  btnRefrescarAdmins.addEventListener('click', () => cargarAdminsSeguro());
}

// Inicializar controles de foto al cargar
inicializarControlesFoto();
