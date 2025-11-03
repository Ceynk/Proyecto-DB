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
const formularioEmailCode = document.getElementById('emailCodeForm');
const mensajeEmailCode = document.getElementById('emailCodeMsg');
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

  // Vista especial tipo catálogo para Inventario
  if (entidadActual === 'inventario') {
    renderizarInventarioCatalogo(filas);
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
  } else if (usuarioActual.rol === 'Contador') {
    // Redirigir a página de Contador
    window.location.href = '/contador.html';
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
      if (r.requiresEmail) {
        // Mostrar formulario de código por correo
        mensajeLogin.textContent = 'Enviamos un código a tu correo. Ingrésalo para continuar.';
        if (formularioEmailCode) formularioEmailCode.style.display = '';
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

if (formularioEmailCode) {
  formularioEmailCode.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mensajeEmailCode.textContent = 'Verificando...';
    mensajeEmailCode.style.color = '';
    const code = new FormData(formularioEmailCode).get('code');
    try {
      const r = await solicitarAPI('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
  usuarioActual = r.user;
  formularioEmailCode.reset();
  formularioEmailCode.style.display = 'none';
  formularioLogin.style.display = '';
  actualizarUIParaAutenticacion();
    } catch (e) {
      mensajeEmailCode.style.color = 'salmon';
      mensajeEmailCode.textContent = e.message;
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
