// ========================================
// Funcionalidad de Tema (Modo Oscuro/Claro)
// ========================================
const themeToggle = document.getElementById('themeToggle');
const iconLight = document.getElementById('iconLight');
const iconDark = document.getElementById('iconDark');

// Cargar tema guardado o usar el del sistema
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
    setTheme('light');
  } else {
    setTheme('dark');
  }
}

function setTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    iconLight.style.display = 'none';
    iconDark.style.display = 'block';
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    iconLight.style.display = 'block';
    iconDark.style.display = 'none';
    localStorage.setItem('theme', 'dark');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'light' ? 'dark' : 'light');
}

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// Inicializar tema al cargar
initTheme();

// ========================================
// Variables de elementos del DOM
// ========================================
// Base de la API y sesión actual para todo el panel principal
const baseAPI = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';
let usuarioActual = null;

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
// (Eliminado) formulario de verificación por email
const btnCerrarSesion = document.getElementById('logoutBtn');

// ---

// Forzar login al abrir una pestaña nueva:
// Usamos sessionStorage (por pestaña). Si es la primera carga de esta pestaña,
// invalidamos cualquier sesión previa en el servidor para que pida login.
(async function initTabSession() {
  try {
    if (!sessionStorage.getItem('TAB_SESSION_INIT')) {
      sessionStorage.setItem('TAB_SESSION_INIT', '1');
      try { await solicitarAPI('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    }
  } catch (_) { /* ignorar */ }
})();

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
  inputSubidaFoto.className = 'file-input';
  inputSubidaFoto.style.maxWidth = '100%';

  btnSubirFoto = document.createElement('button');
  btnSubirFoto.type = 'button';
  btnSubirFoto.className = 'btn-primary';
  btnSubirFoto.innerHTML = `
    <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Subir imagen
  `;
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

const envoltorioCrearAdmin = document.getElementById('adminCreateWrap');
const formularioCrearAdmin = document.getElementById('adminCreateForm');
const mensajeCrearAdmin = document.getElementById('adminCreateMsg');
// Lista/eliminación de usuarios admin
const envoltorioUsuariosAdmin = document.getElementById('adminUsersWrap');
const tablaUsuariosAdmin = document.getElementById('adminUsersTable');
const mensajeUsuariosAdmin = document.getElementById('adminUsersMsg');
const btnRefrescarAdmins = document.getElementById('btnRefreshAdmins');


// en index.html o guarda una clave `API_BASE` en localStorage con la URL del backend en Railway.
// Nota: `baseAPI` y `usuarioActual` ya están declaradas al inicio del archivo.
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

// Menú de entidades para Administrador (excluye módulos del Contador)
const entidades = [
  'empleado', 'cliente', 'proyecto', 'apartamento', 'piso', 'material',
  // Exclusivo del Contador: 'inventario', 'ingreso', 'gasto', 'pago', 'factura'
  'tarea', 'turno'
];

let entidadActual = 'empleado';
let ultimoControlAbortar = null;

if (botonMenuMovil && barraLateral) {
  botonMenuMovil.addEventListener('click', () => {
    barraLateral.classList.toggle('mobile-open');
  });
  
  barraLateral.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && window.innerWidth < 768) {
      barraLateral.classList.remove('mobile-open');
    }
  });
}

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

function sanitizarLetrasYEspacios(value) {
  return value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
}

function sanitizarDigitos(value) {
  return value.replace(/\D/g, '');
}

function limpiarNombreClave(nombre) {
  return String(nombre ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function formatearTituloColumna(nombre) {
  return String(nombre ?? '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolverClaveDisponible(conjuntoClaves, posibles) {
  // Primero intentar coincidencia exacta (case-sensitive)
  for (const candidato of posibles) {
    if (conjuntoClaves.includes(candidato)) {
      return candidato;
    }
  }
  
  // Luego intentar coincidencia sin considerar mayúsculas/minúsculas
  const mapaMinusculas = {};
  conjuntoClaves.forEach((clave) => {
    mapaMinusculas[clave.toLowerCase()] = clave;
  });
  
  for (const candidato of posibles) {
    const candidatoMin = candidato.toLowerCase();
    if (mapaMinusculas[candidatoMin]) {
      return mapaMinusculas[candidatoMin];
    }
  }
  
  // Finalmente, intentar con normalización completa
  const mapa = {};
  conjuntoClaves.forEach((clave) => {
    mapa[limpiarNombreClave(clave)] = clave;
  });
  
  for (const candidato of posibles) {
    const claveNormalizada = limpiarNombreClave(candidato);
    if (mapa[claveNormalizada]) {
      return mapa[claveNormalizada];
    }
  }
  
  return null;
}

function resolverClaveEnObjeto(objeto, posibles) {
  return resolverClaveDisponible(Object.keys(objeto || {}), posibles);
}

function obtenerColumnasDisponibles(filas) {
  const definicion = configuracionTablas[entidadActual] || [];
  const todasLasClaves = new Set();
  filas.forEach((fila) => {
    Object.keys(fila).forEach((clave) => todasLasClaves.add(clave));
  });

  const clavesArray = Array.from(todasLasClaves);
  
  // Debug: ver qué claves están disponibles en los datos
  console.log(`[${entidadActual}] Claves disponibles en datos:`, clavesArray);

  const columnas = [];
  const clavesUsadas = new Set();
  let claveId = null;

  definicion.forEach((columna) => {
    const claveReal = resolverClaveDisponible(clavesArray, columna.claves);
    if (!claveReal) {
      console.warn(`[${entidadActual}] No se encontró clave para:`, columna.claves, 'en', clavesArray);
      return;
    }
    console.log(`[${entidadActual}] Mapeando ${columna.titulo}:`, columna.claves, '→', claveReal);
    columnas.push({
      clave: claveReal,
      titulo: columna.titulo,
      tipo: columna.tipo || inferirTipoColumna(claveReal),
      esId: columna.esId || false
    });
    clavesUsadas.add(claveReal);
    if (!claveId && (columna.esId || /^id/i.test(claveReal))) {
      claveId = claveReal;
    }
  });

  // Agregar columnas no definidas en la configuración
  clavesArray.forEach((clave) => {
    if (clavesUsadas.has(clave)) return;
    columnas.push({
      clave,
      titulo: formatearTituloColumna(clave),
      tipo: inferirTipoColumna(clave)
    });
    clavesUsadas.add(clave);
    if (!claveId && /^id/i.test(clave)) {
      claveId = clave;
    }
  });

  if (!claveId && columnas.length) {
    claveId = columnas[0].clave;
  }

  console.log(`[${entidadActual}] Columnas finales:`, columnas.map(c => `${c.titulo}(${c.clave})`));
  console.log(`[${entidadActual}] Clave ID:`, claveId);

  return { columnas, claveId };
}

function inferirTipoColumna(nombreClave) {
  const limpio = limpiarNombreClave(nombreClave);
  if (limpio.includes('foto') || limpio.includes('imagen')) {
    return 'imagen';
  }
  return 'texto';
}

const configuracionTablas = {
  empleado: [
    { claves: ['idEmpleado'], titulo: 'ID Empleado', esId: true },
    { claves: ['Nombre'], titulo: 'Nombre' },
    { claves: ['Correo'], titulo: 'Correo' },
    { claves: ['Telefono', 'Teléfono'], titulo: 'Teléfono' },
    { claves: ['Asistencia'], titulo: 'Asistencia' },
    { claves: ['Especialidad'], titulo: 'Especialidad' },
    { claves: ['foto_url', 'Foto', 'Imagen'], titulo: 'Foto', tipo: 'imagen' },
    { claves: ['Proyecto', 'NombreProyecto'], titulo: 'Proyecto' }
  ],
  cliente: [
    { claves: ['idCliente'], titulo: 'ID Cliente', esId: true },
    { claves: ['Nombre'], titulo: 'Nombre' },
    { claves: ['Correo'], titulo: 'Correo' },
    { claves: ['Telefono', 'Teléfono'], titulo: 'Teléfono' }
  ],
  proyecto: [
    { claves: ['idProyecto'], titulo: 'ID Proyecto', esId: true },
    { claves: ['Nombre', 'nombreProyecto'], titulo: 'Nombre' },
    { claves: ['Cliente', 'NombreCliente'], titulo: 'Cliente' }
  ],
  apartamento: [
    { claves: ['idApartamento'], titulo: 'ID Apartamento', esId: true },
    { claves: ['num_apartamento'], titulo: 'Número Apartamento' },
    { claves: ['num_piso'], titulo: 'Número Piso' },
    { claves: ['estado'], titulo: 'Estado' },
    { claves: ['idProyecto', 'Proyecto'], titulo: 'Proyecto' }
  ],
  piso: [
    { claves: ['idPiso'], titulo: 'ID Piso', esId: true },
    { claves: ['numero'], titulo: 'Número' },
    { claves: ['idApartamento', 'Apartamento'], titulo: 'Apartamento' },
    { claves: ['idProyecto', 'Proyecto'], titulo: 'Proyecto' }
  ],
  material: [
    { claves: ['idMaterial'], titulo: 'ID Material', esId: true },
    { claves: ['Nombre'], titulo: 'Nombre' },
    { claves: ['tipo'], titulo: 'Tipo' },
    { claves: ['costo_unitario'], titulo: 'Costo Unitario' },
    { claves: ['stock'], titulo: 'Stock' },
    { claves: ['foto_url', 'Foto', 'Imagen'], titulo: 'Foto', tipo: 'imagen' }
  ],
  inventario: [
    { claves: ['idInventario'], titulo: 'ID Inventario', esId: true },
    { claves: ['tipo_movimiento'], titulo: 'Movimiento' },
    { claves: ['cantidad'], titulo: 'Cantidad' },
    { claves: ['fecha'], titulo: 'Fecha' },
    { claves: ['Material', 'NombreMaterial', 'idMaterial'], titulo: 'Material' },
    { claves: ['Proyecto', 'NombreProyecto', 'idProyecto'], titulo: 'Proyecto' }
  ],
  tarea: [
    { claves: ['idTarea'], titulo: 'ID Tarea', esId: true },
    { claves: ['Descripcion'], titulo: 'Descripción' },
    { claves: ['Estado'], titulo: 'Estado' },
    { claves: ['Fecha_inicio'], titulo: 'Fecha Inicio' },
    { claves: ['Fecha_fin'], titulo: 'Fecha Fin' },
    { claves: ['Proyecto', 'NombreProyecto'], titulo: 'Proyecto' },
    { claves: ['Empleado', 'NombreEmpleado'], titulo: 'Empleado' }
  ],
  turno: [
    { claves: ['idTurno'], titulo: 'ID Turno', esId: true },
    { claves: ['Hora_inicio'], titulo: 'Hora Inicio' },
    { claves: ['Hora_fin'], titulo: 'Hora Fin' },
    { claves: ['Tipo_jornada'], titulo: 'Tipo Jornada' },
    { claves: ['Empleado', 'NombreEmpleado'], titulo: 'Empleado' }
  ],
  ingreso: [
    { claves: ['idIngreso'], titulo: 'ID Ingreso', esId: true },
    { claves: ['fecha'], titulo: 'Fecha' },
    { claves: ['Valor'], titulo: 'Valor' },
    { claves: ['Descripcion'], titulo: 'Descripción' },
    { claves: ['Proyecto', 'NombreProyecto'], titulo: 'Proyecto' }
  ],
  gasto: [
    { claves: ['idGasto'], titulo: 'ID Gasto', esId: true },
    { claves: ['Valor'], titulo: 'Valor' },
    { claves: ['Descripcion'], titulo: 'Descripción' },
    { claves: ['fecha'], titulo: 'Fecha' },
    { claves: ['Proyecto', 'NombreProyecto'], titulo: 'Proyecto' }
  ],
  factura: [
    { claves: ['idFactura'], titulo: 'ID Factura', esId: true },
    { claves: ['Fecha'], titulo: 'Fecha' },
    { claves: ['Valor_total'], titulo: 'Valor Total' },
    { claves: ['Proyecto', 'NombreProyecto'], titulo: 'Proyecto' },
    { claves: ['Cliente', 'NombreCliente'], titulo: 'Cliente' }
  ],
  pago: [
    { claves: ['idPago'], titulo: 'ID Pago', esId: true },
    { claves: ['Fecha'], titulo: 'Fecha' },
    { claves: ['Monto'], titulo: 'Monto' },
    { claves: ['Factura', 'idFactura'], titulo: 'Factura' }
  ]
};

const normalizadoresFilas = {
  // Removido el normalizador de empleado que causaba intercambio incorrecto de valores
};

function renderizarBarraLateral() {
  listaEntidadesEl.innerHTML = '';
  entidades.forEach((nombre) => {
    const btn = crear('button', nombre === entidadActual ? 'active' : '', nombre.charAt(0).toUpperCase() + nombre.slice(1));
    btn.addEventListener('click', () => {
      entidadActual = nombre;
      modoActual = 'entidades';
      renderizarBarraLateral();
      // Título especial para inventario
      if (nombre === 'inventario') {
        tituloEl.textContent = 'Catálogo de Materiales';
      } else {
        tituloEl.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1);
      }
      buscarEl.value = '';
      window.terminoBusquedaInventario = null;
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

function resolverRutaImagen(valor) {
  if (!valor) return '/default-user.svg';
  if (typeof valor !== 'string') return '/default-user.svg';
  const limpio = valor.trim().replace(/\\/g, '/');
  if (limpio.startsWith('http://') || limpio.startsWith('https://')) return limpio;
  if (limpio.startsWith('/')) {
    const base = (baseAPI || '').replace(/\/+$/, '');
    return `${base}${limpio}`;
  }
  if (limpio.startsWith('uploads/')) {
    const base = (baseAPI || '').replace(/\/+$/, '');
    const ruta = limpio.replace(/^\/+/, '');
    return base ? `${base}/${ruta}` : `/${ruta}`;
  }
  return limpio;
}

// Nuevo renderizador genérico usando componente reutilizable renderTable (ui-table.js)
function renderizarTabla(filas) {
  contenedorTabla.innerHTML = '';
  const normalizador = normalizadoresFilas[entidadActual];
  const datos = Array.isArray(filas) ? filas.map(f => normalizador ? normalizador({ ...f }) : { ...f }) : [];
  if (!datos.length) {
    contenedorTabla.innerHTML = '<div class="table-empty">Sin datos para mostrar</div>';
    return;
  }
  const { columnas, claveId } = obtenerColumnasDisponibles(datos);
  const cols = columnas.map(c => ({
    key: c.clave,
    header: c.titulo,
    type: c.tipo === 'imagen' ? 'image' : 'text',
    render: c.tipo === 'imagen' ? (td, value) => {
      const img = document.createElement('img');
      img.className = 'tbl-img';
      img.alt = 'foto';
      img.loading = 'lazy';
      img.onerror = () => { img.src = '/default-user.svg'; };
      img.src = resolverRutaImagen(value);
      td.appendChild(img);
    } : null
  }));
  const acciones = (usuarioActual?.rol === 'Administrador') ? [{
    label: 'Seleccionar',
    onClick: (row) => {
      if (!claveId) return;
      const valorId = row[claveId];
      if (valorId == null) return;
      const textoId = String(valorId);
      if (entradaIdActualizacion) {
        let opcion = Array.from(entradaIdActualizacion.options).find(o => o.value === textoId);
        if (!opcion) {
          opcion = document.createElement('option');
          opcion.value = textoId;
          opcion.textContent = `ID ${textoId}`;
          entradaIdActualizacion.appendChild(opcion);
        }
        entradaIdActualizacion.value = textoId;
      }
      if (mensajeActualizacion) {
        mensajeActualizacion.style.color = 'var(--success)';
        mensajeActualizacion.textContent = `✓ ID ${textoId} seleccionado`;
        setTimeout(() => { if (mensajeActualizacion) mensajeActualizacion.style.color = ''; }, 2500);
      }
    }
  }] : [];
  renderTable(contenedorTabla, cols, datos, { rowActions: acciones, emptyText: 'Sin datos para mostrar' });
}

// Renderizado especial para inventario tipo catálogo
async function renderizarInventarioCatalogo(filas) {
  contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando materiales...</div>';
  
  try {
    // Obtener todos los materiales con sus fotos
    const materiales = await solicitarAPI('/api/list/material');
    
    if (!materiales || materiales.length === 0) {
      contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay materiales disponibles</div>';
      return;
    }

    // Crear un mapa de materiales por ID
    const materialMap = {};
    materiales.forEach(m => {
      materialMap[m.idMaterial] = m;
    });

    // Agrupar inventario por material
    const inventarioPorMaterial = {};
    
    // Primero, agregar todos los materiales existentes
    materiales.forEach(material => {
      inventarioPorMaterial[material.idMaterial] = {
        nombre: material.Nombre || 'Sin nombre',
        idMaterial: material.idMaterial,
        movimientos: [],
        cantidadTotal: 0,
        material: material
      };
    });
    
    // Luego agregar los movimientos de inventario
    filas.forEach(item => {
      const idMaterial = item.idMaterial;
      
      if (idMaterial && inventarioPorMaterial[idMaterial]) {
        inventarioPorMaterial[idMaterial].movimientos.push(item);
        // Calcular cantidad total (entradas - salidas)
        const cantidad = parseInt(item.cantidad) || 0;
        if (item.tipo_movimiento === 'Entrada') {
          inventarioPorMaterial[idMaterial].cantidadTotal += cantidad;
        } else if (item.tipo_movimiento === 'Salida') {
          inventarioPorMaterial[idMaterial].cantidadTotal -= cantidad;
        }
      }
    });

    // Filtrar materiales según término de búsqueda
    const terminoBusqueda = window.terminoBusquedaInventario;
    const materialesFiltrados = Object.values(inventarioPorMaterial).filter(grupo => {
      if (!terminoBusqueda) return true;
      const material = grupo.material;
      return (
        grupo.nombre.toLowerCase().includes(terminoBusqueda) ||
        (material.tipo && material.tipo.toLowerCase().includes(terminoBusqueda)) ||
        (material.costo_unitario && material.costo_unitario.toString().includes(terminoBusqueda))
      );
    });

    if (materialesFiltrados.length === 0) {
      contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No se encontraron materiales con ese criterio</div>';
      return;
    }

    // Crear contenedor principal con header
    const mainContainer = document.createElement('div');
    mainContainer.style.width = '100%';
    
    // Header informativo
    const headerInfo = document.createElement('div');
    headerInfo.className = 'catalogo-header';
    headerInfo.innerHTML = `
      <div class="catalogo-stats">
        <div class="stat-item">
          <span class="stat-number">${materialesFiltrados.length}</span>
          <span class="stat-label">Materiales</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${materialesFiltrados.filter(g => g.cantidadTotal > 0).length}</span>
          <span class="stat-label">Disponibles</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${materialesFiltrados.filter(g => g.cantidadTotal === 0).length}</span>
          <span class="stat-label">Agotados</span>
        </div>
      </div>
    `;
    mainContainer.appendChild(headerInfo);

    // Crear grid de tarjetas
    const catalogoContainer = document.createElement('div');
    catalogoContainer.className = 'catalogo-inventario';

    materialesFiltrados.forEach(grupo => {
      const card = document.createElement('div');
      card.className = 'material-card';
      
      const material = grupo.material;
      const fotoUrl = material.foto_url || '/default-material.svg';
      
      card.innerHTML = `
        <div class="material-card-image">
          <img src="${fotoUrl}" alt="${grupo.nombre}" onerror="this.src='/default-material.svg'">
          <div class="material-badge ${grupo.cantidadTotal > 0 ? 'badge-success' : 'badge-warning'}">
            ${grupo.cantidadTotal > 0 ? 'Disponible' : 'Agotado'}
          </div>
        </div>
        <div class="material-card-content">
          <h3 class="material-card-title">${grupo.nombre}</h3>
          <div class="material-card-info">
            <div class="info-item">
              <span class="info-label">Cantidad:</span>
              <span class="info-value">${grupo.cantidadTotal} unidades</span>
            </div>
            ${material.costo_unitario ? `
            <div class="info-item">
              <span class="info-label">Costo Unitario:</span>
              <span class="info-value">$${parseFloat(material.costo_unitario).toLocaleString('es-CO', {minimumFractionDigits: 2})}</span>
            </div>
            ` : ''}
            ${material.tipo ? `
            <div class="info-item">
              <span class="info-label">Tipo:</span>
              <span class="info-value">${material.tipo}</span>
            </div>
            ` : ''}
            <div class="info-item">
              <span class="info-label">Movimientos:</span>
              <span class="info-value">${grupo.movimientos.length} registros</span>
            </div>
          </div>
          ${usuarioActual?.rol === 'Administrador' ? `
          <div class="material-card-actions">
            <button class="btn-card-action" onclick="seleccionarMaterialInventario('${grupo.idMaterial}')">
              📋 Ver detalles
            </button>
          </div>
          ` : ''}
        </div>
      `;
      
      catalogoContainer.appendChild(card);
    });

    mainContainer.appendChild(catalogoContainer);
    contenedorTabla.innerHTML = '';
    contenedorTabla.appendChild(mainContainer);

  } catch (e) {
    contenedorTabla.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--error);">Error al cargar inventario: ${e.message}</div>`;
  }
}

// Función global para seleccionar material desde las tarjetas
window.seleccionarMaterialInventario = function(idMaterial) {
  if (entradaIdActualizacion) {
    // Buscar el ID de inventario correspondiente
    const select = entradaIdActualizacion;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].textContent.includes(`Material: ${idMaterial}`) || 
          select.options[i].value.includes(idMaterial)) {
        select.selectedIndex = i;
        break;
      }
    }
  }
  // Scroll al formulario
  document.getElementById('formWrap')?.scrollIntoView({ behavior: 'smooth' });
  mensajeActualizacion.textContent = `Material ID ${idMaterial} seleccionado`;
  mensajeActualizacion.style.color = '';
};

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
    
    // Aplicar filtrado local para inventario (búsqueda en catálogo)
    if (entidadActual === 'inventario' && q) {
      window.terminoBusquedaInventario = q.toLowerCase();
    } else {
      window.terminoBusquedaInventario = null;
    }
    
    renderizarTabla(datos);
  } catch (e) {
    if (e.name === 'AbortError') return; // ignore
    contenedorTabla.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--error);">Error: ${e.message}</div>`;
  }
}

buscarEl.addEventListener('input', () => {
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
  } else if (usuarioActual.rol === 'Contador') {
    // Redirigir a página de Contador
    window.location.href = '/contador.html';
  } else if (usuarioActual.rol === 'Cliente') {
    // Redirigir a portal de Cliente
    window.location.href = '/cliente.html';
  } else {
    // Redirigir a página de Trabajador
    window.location.href = '/trabajador.html';
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

// No todos los recursos tienen endpoint /api/min/* en el backend.
// Para evitar 404 innecesarios en la consola, solo usaremos /api/min
// para las entidades que sabemos que están soportadas.
const entidadesConMin = new Set([
  'empleado',
  'cliente',
  'proyecto',
  'material',
  'factura' // usado para seleccionar pagos
  // Nota: apartamentos, pisos, tareas, turnos generalmente no tienen /min
]);

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
  // Limpiar opciones existentes
  entradaIdActualizacion.innerHTML = '';
  const marcadorPosicion = document.createElement('option');
  marcadorPosicion.value = '';
  marcadorPosicion.textContent = '-- Selecciona --';
  entradaIdActualizacion.appendChild(marcadorPosicion);
  // Obtener plural y cargar elementos (preferir /api/min si existe)
  const plural = obtenerPlural(entidadActual);
  let elementos = [];
  try {
    if (entidadesConMin.has(entidadActual)) {
      elementos = await solicitarAPI(`/api/min/${plural}`);
    } else {
      elementos = await solicitarAPI(`/api/list/${entidadActual}`);
    }
  } catch (_) {
    try { elementos = await solicitarAPI(`/api/list/${entidadActual}`); } catch (_) { elementos = []; }
  }
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

// Manejo del formulario de login (restaurado)
if (formularioLogin) {
  formularioLogin.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (mensajeLogin) { mensajeLogin.textContent = 'Ingresando...'; mensajeLogin.style.color = ''; }
    const fd = new FormData(formularioLogin);
    const payload = { username: fd.get('username'), password: fd.get('password') };
    try {
      const r = await solicitarAPI('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      usuarioActual = r.user;
      formularioLogin.reset();
      actualizarUIParaAutenticacion();
    } catch (e) {
      if (mensajeLogin) { mensajeLogin.style.color = 'salmon'; mensajeLogin.textContent = e.message; }
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

// ====== Inventario (dashboard) ======

function formateaMoneda(valor) {
  if (valor == null || isNaN(Number(valor))) return '$0';
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(valor));
  } catch {
    return '$' + Number(valor).toFixed(2);
  }
}

function formateaNumero(n) {
  try { return new Intl.NumberFormat('es-CO').format(Number(n || 0)); } catch { return String(n || 0); }
}

async function cargarInventario() {
  const q = buscarEl.value.trim();
  contenedorTabla.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">Cargando inventario...</div>';
  try {
    const [ovwResp, cardsResp] = await Promise.all([
      fetch(`${baseAPI}/api/inventory/overview`, { credentials: 'include' }),
      fetch(`${baseAPI}/api/inventory/cards${q ? `?q=${encodeURIComponent(q)}` : ''}`, { credentials: 'include' })
    ]);
    const overview = await ovwResp.json();
    const cards = await cardsResp.json();
    renderInventario(overview, cards);
  } catch (e) {
    contenedorTabla.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--error)">Error: ${e.message}</div>`;
  }
}

function renderInventario(overview, items) {
  const wrap = document.createElement('div');
  wrap.className = 'inv-wrap';

  // Resumen superior
  const resumen = document.createElement('div');
  resumen.className = 'inv-summary';
  resumen.innerHTML = `
    <div class="inv-kpi"><div class="inv-kpi-num">${formateaNumero(overview?.materiales || 0)}</div><div class="inv-kpi-label">Materiales</div></div>
    <div class="inv-kpi"><div class="inv-kpi-num">${formateaNumero(overview?.disponibles || 0)}</div><div class="inv-kpi-label">Disponibles</div></div>
    <div class="inv-kpi"><div class="inv-kpi-num">${formateaNumero(overview?.agotados || 0)}</div><div class="inv-kpi-label">Agotados</div></div>
  `;
  wrap.appendChild(resumen);

  // Grid de tarjetas
  const grid = document.createElement('div');
  grid.className = 'inv-grid';
  (items || []).forEach((it) => {
    const agotado = Number(it.stock || 0) <= 0;
    const card = document.createElement('div');
    card.className = 'inv-card';
    card.innerHTML = `
      <div class="inv-card-img">
        <img src="https://images.unsplash.com/photo-1556735979-89b03e0b5b51?auto=format&fit=crop&w=900&q=60" alt="${it.Nombre}">
        ${agotado ? '<span class="inv-badge inv-badge-warn">Agotado</span>' : '<span class="inv-badge inv-badge-ok">Disponible</span>'}
      </div>
      <div class="inv-card-body">
        <h3 class="inv-card-title">${it.Nombre}</h3>
        <ul class="inv-meta">
          <li><span>Cantidad:</span><b>${formateaNumero(it.stock || 0)} unidades</b></li>
          <li><span>Costo Unitario:</span><b>${formateaMoneda(it.costo_unitario)}</b></li>
          <li><span>Tipo:</span><b>${it.tipo || '-'}</b></li>
          <li><span>Movimientos:</span><b>${formateaNumero(it.movimientos)} registros</b></li>
        </ul>
        <button class="inv-btn-detalles" data-id="${it.idMaterial}">Ver detalles</button>
      </div>
    `;
    grid.appendChild(card);
  });
  wrap.appendChild(grid);

  // Sección de detalle
  const detail = document.createElement('div');
  detail.className = 'inv-detail';
  detail.id = 'invDetail';
  wrap.appendChild(detail);

  contenedorTabla.innerHTML = '';
  contenedorTabla.appendChild(wrap);

  // Delegación para botón "Ver detalles"
  contenedorTabla.querySelectorAll('.inv-btn-detalles').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await cargarDetalleMaterial(id);
      // scroll al detalle
      document.getElementById('invDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

async function cargarDetalleMaterial(id) {
  const cont = document.getElementById('invDetail');
  if (!cont) return;
  cont.innerHTML = '<div class="inv-detail-loading">Cargando detalle...</div>';
  try {
  const resp = await fetch(`${baseAPI}/api/inventory/material/${id}`, { credentials: 'include' });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error');
    const m = data.material || {};
    const movs = data.movimientos || [];
    let html = `
      <div class="inv-detail-head">
        <div>
          <h3>${m.Nombre || 'Material'}</h3>
          <div class="inv-detail-sub">Stock actual: <b>${formateaNumero(m.stock || 0)}</b> — Costo unitario: <b>${formateaMoneda(m.costo_unitario)}</b> — Tipo: <b>${m.tipo || '-'}</b></div>
        </div>
        <button class="inv-btn-cerrar" id="cerrarDetalle">Cerrar</button>
      </div>
    `;
    if (!movs.length) {
      html += '<div class="inv-detail-empty">No hay movimientos para este material.</div>';
    } else {
      html += '<div class="table-wrap">';
      html += '<table><thead><tr><th>ID</th><th>Movimiento</th><th>Cantidad</th><th>Fecha</th><th>Proyecto</th></tr></thead><tbody>';
      movs.forEach((r) => {
        html += `<tr><td>${r.idInventario}</td><td>${r.tipo_movimiento}</td><td>${formateaNumero(r.cantidad)}</td><td>${r.fecha || ''}</td><td>${r.Proyecto || ''}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    cont.innerHTML = html;
    const cerrar = document.getElementById('cerrarDetalle');
    if (cerrar) cerrar.addEventListener('click', () => { cont.innerHTML = ''; });
  } catch (e) {
    cont.innerHTML = `<div class="inv-detail-error">Error: ${e.message}</div>`;
  }
}

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
    { name: 'Fecha_inicio', type: 'date' },
    { name: 'Fecha_fin', type: 'date' },
    { name: 'idProyecto', type: 'select', source: '/api/min/proyectos' },
    { name: 'idEmpleado', type: 'select', source: '/api/min/empleados' }
  ],
  inventario: [
    { name: 'tipo_movimiento', type: 'select', options: ['Entrada','Salida'] },
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
        } catch (e) {  }
      }
      formularioDinamico.appendChild(selectEl);
    } else {
      const inputEl = crear('input');
      inputEl.name = f.name;
      inputEl.type = f.type || 'text';
      if (f.step) inputEl.step = f.step;
      if (f.req) inputEl.required = true;

      const nombreEnMinusculas = (f.name || '').toLowerCase();
      if (inputEl.type === 'email') {
      } else if (inputEl.type === 'tel' || nombreEnMinusculas.includes('telefono')) {
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

  // Bloque adicional para Empleado: crear cuenta de acceso
  if (entidadActual === 'empleado') {
    const bloque = document.createElement('div');
    bloque.style.gridColumn = '1 / -1';
    bloque.innerHTML = `
      <div class="form-header" style="margin-top:1rem;">
        <h3 class="form-heading">Cuenta de acceso</h3>
      </div>
      <div class="dyn-form" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-lg);">
        <div style="grid-column: 1 / -1; display:flex; align-items:center; gap:.5rem;">
          <input id="chkCrearUsuario" type="checkbox" name="crear_usuario" />
          <label for="chkCrearUsuario" style="margin:0;">Crear usuario para este empleado</label>
        </div>
        <div>
          <label>Usuario</label>
          <input name="nombre_usuario" type="text" pattern="[A-Za-z0-9_.-]{3,30}" placeholder="usuario.ejemplo" disabled />
        </div>
        <div>
          <label>Contraseña</label>
          <input name="contraseña" type="password" minlength="6" placeholder="mínimo 6 caracteres" disabled />
        </div>
        <div>
          <label>Rol</label>
          <select name="rol_usuario" disabled>
            <option value="Empleado">Empleado</option>
            <option value="Contador">Contador</option>
          </select>
        </div>
        <div>
          <label>Correo (usuario)</label>
          <input name="correo_usuario" type="email" placeholder="correo@dominio.com" disabled />
        </div>
      </div>
    `;
    formularioDinamico.appendChild(bloque);

    const chk = bloque.querySelector('#chkCrearUsuario');
    const dependientes = ['nombre_usuario','contraseña','rol_usuario','correo_usuario'].map(n => bloque.querySelector(`[name="${n}"]`));
    const actualizar = () => { dependientes.forEach(el => { el.disabled = !chk.checked; }); };
    chk.addEventListener('change', actualizar);
    actualizar();
    // Mover el botón Guardar al final del bloque extendido
    const botonGuardar = Array.from(formularioDinamico.querySelectorAll('button')).find(b => b.type === 'submit');
    if (botonGuardar) formularioDinamico.appendChild(botonGuardar);
  }

  // Bloque adicional para Cliente: crear cuenta de acceso
  if (entidadActual === 'cliente') {
    const bloque = document.createElement('div');
    bloque.style.gridColumn = '1 / -1';
    bloque.innerHTML = `
      <div class="form-header" style="margin-top:1rem;">
        <h3 class="form-heading">Cuenta de acceso (opcional)</h3>
      </div>
      <div class="dyn-form" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-lg);">
        <div style="grid-column: 1 / -1; display:flex; align-items:center; gap:.5rem;">
          <input id="chkCrearUsuarioCli" type="checkbox" name="crear_usuario" />
          <label for="chkCrearUsuarioCli" style="margin:0;">Crear usuario para este cliente</label>
        </div>
        <div>
          <label>Usuario</label>
          <input name="nombre_usuario" type="text" pattern="[A-Za-z0-9_.-]{3,30}" placeholder="cliente.ejemplo" disabled />
        </div>
        <div>
          <label>Contraseña</label>
          <input name="contraseña" type="password" minlength="6" placeholder="mínimo 6 caracteres" disabled />
        </div>
      </div>
    `;
    formularioDinamico.appendChild(bloque);
    const chk = bloque.querySelector('#chkCrearUsuarioCli');
    const dependientes = ['nombre_usuario','contraseña'].map(n => bloque.querySelector(`[name="${n}"]`));
    const actualizar = () => { dependientes.forEach(el => { el.disabled = !chk.checked; }); };
    chk.addEventListener('change', actualizar);
    actualizar();
    const botonGuardar = Array.from(formularioDinamico.querySelectorAll('button')).find(b => b.type === 'submit');
    if (botonGuardar) formularioDinamico.appendChild(botonGuardar);
  }
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
    if (el.type === 'checkbox') {
      datos[el.name] = el.checked ? '1' : '0';
    }
  });
  try {
    let r;
    if (entidadActual === 'empleado' && (datos.crear_usuario === '1' || datos.crear_usuario === 1 || datos.crear_usuario === true)) {
      // Mapear datos para endpoint especial
      const payload = {
        Nombre: datos.Nombre || null,
        Correo: datos.Correo || null,
        Telefono: datos.Telefono || null,
        Asistencia: datos.Asistencia || null,
        Especialidad: datos.Especialidad || null,
        idProyecto: datos.idProyecto || null,
        crear_usuario: true,
        nombre_usuario: datos.nombre_usuario,
        contraseña: datos.contraseña,
        rol_usuario: datos.rol_usuario || 'Empleado',
        correo_usuario: datos.correo_usuario || null
      };
      r = await solicitarAPI('/api/empleados/crear-con-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      mensajeFormulario.textContent = `Empleado creado (id ${r.idEmpleado})` + (r.idUsuario ? ` y usuario (id ${r.idUsuario})` : '');
    } else if (entidadActual === 'cliente' && (datos.crear_usuario === '1' || datos.crear_usuario === 1 || datos.crear_usuario === true)) {
      const payload = {
        Nombre: datos.Nombre || null,
        Telefono: datos.Telefono || null,
        Correo: datos.Correo || null,
        crear_usuario: true,
        nombre_usuario: datos.nombre_usuario,
        contraseña: datos.contraseña
      };
      r = await solicitarAPI('/api/clientes/crear-con-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      mensajeFormulario.textContent = `Cliente creado (id ${r.idCliente})` + (r.idUsuario ? ` y usuario (id ${r.idUsuario})` : '');
    } else {
      r = await solicitarAPI(`/api/create/${entidadActual}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      mensajeFormulario.textContent = 'Guardado con id ' + r.id;
    }
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
    ['ID','Usuario','Correo','Foto','Acciones'].forEach(h => {
      const th = document.createElement('th'); th.textContent = h; trh.appendChild(th);
    });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(u => {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.textContent = u.idUsuario; tr.appendChild(tdId);
  const tdUser = document.createElement('td'); tdUser.textContent = u.nombre_usuario; tr.appendChild(tdUser);
  const tdCorreo = document.createElement('td'); tdCorreo.textContent = u.Correo || '—'; tr.appendChild(tdCorreo);
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
