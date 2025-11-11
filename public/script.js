// ========================================
// Tema (Oscuro/Claro)
// ========================================
const interruptorTema = document.getElementById('interruptorTema');
const iconoClaro = document.getElementById('iconoClaro');
const iconoOscuro = document.getElementById('iconoOscuro');

function iniciarTema() {
  const temaGuardado = localStorage.getItem('theme');
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (temaGuardado === 'light' || (!temaGuardado && !prefiereOscuro)) {
    establecerTema('light');
  } else {
    establecerTema('dark');
  }
}
function establecerTema(tema) {
  if (tema === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (iconoClaro) iconoClaro.style.display = 'none';
    if (iconoOscuro) iconoOscuro.style.display = 'block';
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (iconoClaro) iconoClaro.style.display = 'block';
    if (iconoOscuro) iconoOscuro.style.display = 'none';
    localStorage.setItem('theme', 'dark');
  }
}
function alternarTema() {
  const temaActual = document.documentElement.getAttribute('data-theme');
  establecerTema(temaActual === 'light' ? 'dark' : 'light');
}
if (interruptorTema) interruptorTema.addEventListener('click', alternarTema);
iniciarTema();

// ========================================
// Performance móvil: detectar y aplicar clase
// ========================================
function activarModoRendimientoMovil(){
  const d = document.documentElement;
  // Criterio: ancho <= 768 o dispositivo táctil + memoria menor a 4GB (aprox via navigator.deviceMemory)
  const esMovil = window.innerWidth <= 768 || ('ontouchstart' in window);
  const mem = navigator.deviceMemory || 4;
  if(esMovil && mem <= 4){
    if(!d.classList.contains('perf-mobile')) d.classList.add('perf-mobile');
  }
}
window.addEventListener('resize', activarModoRendimientoMovil, { passive:true });
activarModoRendimientoMovil();

// Reducir listeners scroll costosos (debounce genérico)
let _rafScroll = false;
window.addEventListener('scroll', ()=>{
  if(!document.documentElement.classList.contains('perf-mobile')) return;
  if(_rafScroll) return;
  _rafScroll = true;
  requestAnimationFrame(()=>{ _rafScroll = false; /* se podría añadir lógica liviana aquí */ });
}, { passive:true });

// Utilidad para medir render pesado (debug)
window._perfMark = function(label){ performance.mark(label); };
window._perfMeasure = function(name,start,end){ try { performance.measure(name,start,end); console.log(performance.getEntriesByName(name).pop()); } catch(e){} };

// ========================================
// Estado global y elementos
// ========================================
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
const botonMenuMovil = document.getElementById('btnMenuMovil');
const botonActualizar = document.getElementById('btnRefrescar');

const panelDatos = document.getElementById('panelDatos');
const panelAdmin = document.getElementById('adminPanel');
const navAdmin = document.getElementById('adminNav');
let contenedorEnroll = null;
const btnPanelAdmin = document.getElementById('btnAdminPanel');
const barraLateral = document.getElementById('barraLateral');
let modoActual = 'entidades'; // 'entidades' | 'admin'

// Autenticación
const areaLogin = document.getElementById('areaLogin');
const areaApp = document.getElementById('areaApp');
const formularioLogin = document.getElementById('formularioLogin');
const mensajeLogin = document.getElementById('mensajeLogin');
const btnCerrarSesion = document.getElementById('btnCerrarSesion');

// Login con rostro
const videoRostro = document.getElementById('videoRostro');
const lienzoRostro = document.getElementById('lienzoRostro');
const btnIniciarRostro = document.getElementById('btnIniciarRostro');
const btnLoginRostro = document.getElementById('btnLoginRostro');
const mensajeLoginRostro = document.getElementById('mensajeLoginRostro');
const usuarioLoginRostro = document.getElementById('usuarioLoginRostro');
let flujoRostro = null;
let modelosRostroCargados = false;
let cargandoModeloRostro = false;

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

// ========================================
// Scroll hint para tablas en móvil
// ========================================
function actualizarHintScroll(el){
  if(!el) return;
  // Solo mostrar si overflow horizontal real
  if(el.scrollWidth > el.clientWidth + 16){
    el.classList.add('show-scroll-hint');
  } else {
    el.classList.remove('show-scroll-hint');
  }
}
function refrescarHints(){
  document.querySelectorAll('.table-wrap').forEach(actualizarHintScroll);
}
// Observa inserciones de tablas dinámicas
const observerTablas = new MutationObserver((muts)=>{
  let debeRefrescar = false;
  for(const m of muts){
    if(Array.from(m.addedNodes).some(n=> n.nodeType===1 && (n.classList?.contains('table-wrap') || n.querySelector?.('.table-wrap')))){
      debeRefrescar = true; break;
    }
  }
  if(debeRefrescar) requestAnimationFrame(refrescarHints);
});
observerTablas.observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize', ()=>{ if(window.innerWidth < 768) refrescarHints(); });
// Primer chequeo tras autenticación
document.addEventListener('DOMContentLoaded', ()=>{ if(window.innerWidth < 768) refrescarHints(); });
// Exponer para depuración
window._refreshTableScrollHints = refrescarHints;

// Navegación panel admin
if (btnPanelAdmin) {
  btnPanelAdmin.addEventListener('click', () => {
    if (usuarioActual?.rol !== 'Administrador') return;
    modoActual = 'admin';
    if (panelDatos) panelDatos.style.display = 'none';
    if (panelAdmin) panelAdmin.style.display = '';
    // Remove active class from entity buttons
    Array.from(listaEntidadesEl.children).forEach((b) => b.classList.remove('active'));
    btnPanelAdmin.classList.add('active');
    construirUIEnrollFace();
  });
}
function construirUIEnrollFace() {
  if (!panelAdmin || contenedorEnroll) return;
  contenedorEnroll = document.createElement('div');
  contenedorEnroll.className = 'form-wrap';
  contenedorEnroll.style.marginTop = '2rem';
  contenedorEnroll.innerHTML = `
    <div class="form-header face-enroll-header">
      <h3 class="form-heading">Enrolar Rostro de Usuario</h3>
      <button type="button" id="btnRefreshUsersFace" class="btn-icon" title="Actualizar usuarios">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 3v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="face-enroll-grid">
      <div class="face-enroll-left">
        <div class="form-block">
          <label>Seleccionar Usuario</label>
          <select id="selUsuarioFace"><option value="">--</option></select>
        </div>
        <div class="face-preview-card">
          <img id="faceEnrollPreview" alt="preview" class="face-preview" style="display:none;" />
          <div id="faceEnrollPreviewMsg" class="face-preview-msg"></div>
        </div>
        <div id="faceEnrollMsg" class="form-msg" style="min-height:1.1rem"></div>
      </div>
      <div class="face-enroll-right">
        <video id="faceEnrollVideo" autoplay muted playsinline class="video-face"></video>
        <div class="btn-face-group">
          <button id="btnInitEnrollCam" type="button" class="btn-primary btn-face">Activar Cámara</button>
          <button id="btnCaptureDescriptor" type="button" class="btn-secondary btn-face" disabled>Capturar & Guardar</button>
          <button id="btnCaptureFromPhoto" type="button" class="btn-outline btn-face">Usar Foto Guardada</button>
        </div>
      </div>
    </div>
  `;
  panelAdmin.appendChild(contenedorEnroll);
  inicializarEnrollFace();
}
async function inicializarEnrollFace() {
  const sel = document.getElementById('selUsuarioFace');
  const btnInit = document.getElementById('btnInitEnrollCam');
  const btnCapture = document.getElementById('btnCaptureDescriptor');
  const btnFromPhoto = document.getElementById('btnCaptureFromPhoto');
  const msg = document.getElementById('faceEnrollMsg');
  const video = document.getElementById('faceEnrollVideo');
  const btnRefresh = document.getElementById('btnRefreshUsersFace');
  const imgPreview = document.getElementById('faceEnrollPreview');
  const imgPrevMsg = document.getElementById('faceEnrollPreviewMsg');
  let stream = null;
  let usuariosCache = [];

  async function cargarUsuarios() {
    if (!sel) return;
    sel.innerHTML = '<option value="">--</option>';
    try {
      const usuarios = await solicitarAPI('/api/users');
      usuariosCache = usuarios || [];
      usuariosCache.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.idUsuario;
        opt.textContent = `${u.idUsuario} - ${u.nombre_usuario} (${u.rol})`;
        sel.appendChild(opt);
      });
    } catch (e) {
      msg.style.color = 'salmon'; msg.textContent = 'Error usuarios: ' + e.message;
    }
  }
  await cargarUsuarios();
  if (btnRefresh) btnRefresh.addEventListener('click', cargarUsuarios);

  async function activarCamara() {
    msg.style.color=''; msg.textContent='Activando cámara...';
    try {
      await cargarModelosFace();
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      video.srcObject = stream;
      btnCapture.disabled = false;
      msg.textContent = 'Cámara lista';
    } catch (e) {
      msg.style.color='salmon'; msg.textContent='Error cámara: '+e.message;
    }
  }
  async function capturar() {
    const id = sel.value.trim();
    if (!id) { msg.style.color='salmon'; msg.textContent='Selecciona usuario'; return; }
    msg.style.color=''; msg.textContent='Detectando...';
    try {
      const opciones = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 160 });
      const det = await faceapi.detectSingleFace(video, opciones).withFaceLandmarks().withFaceDescriptor();
      if (!det) { msg.style.color='salmon'; msg.textContent='No se detectó rostro'; return; }
      const descriptor = Array.from(det.descriptor);
      msg.textContent='Guardando descriptor...';
      await solicitarAPI(`/api/users/${id}/face`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ descriptor })
      });
      msg.textContent='Descriptor guardado'; msg.style.color='';
    } catch (e) {
      msg.style.color='salmon'; msg.textContent=e.message;
    }
  }
  async function capturarDesdeFoto() {
    const id = sel.value.trim();
    if (!id) { msg.style.color='salmon'; msg.textContent='Selecciona usuario'; return; }
    const u = usuariosCache.find(x => String(x.idUsuario) === id);
    if (!u || !u.foto_url) { msg.style.color='salmon'; msg.textContent='Ese usuario no tiene foto guardada'; return; }
    const url = resolverRutaImagen(u.foto_url);
    try {
      imgPrevMsg.textContent = 'Cargando foto...'; imgPrevMsg.style.color='';
      await cargarModelosFace();
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const cargada = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('No se pudo cargar la foto')); });
      img.src = url;
      await cargada;
      if (imgPreview) { imgPreview.src = url; imgPreview.style.display = ''; }
      const det = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (!det) { msg.style.color='salmon'; msg.textContent='No se detectó rostro en la foto'; return; }
      const descriptor = Array.from(det.descriptor);
      imgPrevMsg.textContent = 'Rostro detectado en la foto';
      msg.textContent='Guardando descriptor...'; msg.style.color='';
      await solicitarAPI(`/api/users/${id}/face`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ descriptor })
      });
      msg.textContent='Descriptor guardado desde foto'; msg.style.color='';
    } catch (e) {
      msg.style.color='salmon'; msg.textContent = e.message;
    }
  }
  if (btnInit) btnInit.addEventListener('click', activarCamara);
  if (btnCapture) btnCapture.addEventListener('click', capturar);
  if (btnFromPhoto) btnFromPhoto.addEventListener('click', capturarDesdeFoto);
}

// Admin: crear/listar/eliminar
const envoltorioCrearAdmin = document.getElementById('adminCreateWrap');
const formularioCrearAdmin = document.getElementById('adminCreateForm');
const mensajeCrearAdmin = document.getElementById('adminCreateMsg');
const envoltorioUsuariosAdmin = document.getElementById('adminUsersWrap');
const tablaUsuariosAdmin = document.getElementById('adminUsersTable');
const mensajeUsuariosAdmin = document.getElementById('adminUsersMsg');
const btnRefrescarAdmins = document.getElementById('btnRefreshAdmins');

// ========================================
// Helper fetch
// ========================================
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

// ========================================
// Menú de entidades (Admin)
// ========================================
const entidades = [
  'empleado', 'cliente', 'proyecto', 'apartamento', 'piso', 'material', 'tarea', 'turno'
];
let entidadActual = 'empleado';
let ultimoControlAbortar = null;

if (botonMenuMovil && barraLateral) {
  botonMenuMovil.addEventListener('click', () => { barraLateral.classList.toggle('mobile-open'); });
  barraLateral.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && window.innerWidth < 768) barraLateral.classList.remove('mobile-open');
  });
}
if (botonActualizar) botonActualizar.addEventListener('click', () => { cargarDatos(); });

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}
function sanitizarLetrasYEspacios(value) { return value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, ''); }
function sanitizarDigitos(value) { return value.replace(/\D/g, ''); }
function limpiarNombreClave(nombre) { return String(nombre ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
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
  for (const candidato of posibles) if (conjuntoClaves.includes(candidato)) return candidato;
  const mapaMinusculas = {};
  conjuntoClaves.forEach((clave) => { mapaMinusculas[clave.toLowerCase()] = clave; });
  for (const candidato of posibles) {
    const r = mapaMinusculas[candidato.toLowerCase()];
    if (r) return r;
  }
  const mapa = {};
  conjuntoClaves.forEach((clave) => { mapa[limpiarNombreClave(clave)] = clave; });
  for (const candidato of posibles) {
    const claveNormalizada = limpiarNombreClave(candidato);
    if (mapa[claveNormalizada]) return mapa[claveNormalizada];
  }
  return null;
}
function obtenerColumnasDisponibles(filas) {
  const definicion = configuracionTablas[entidadActual] || [];
  const todasLasClaves = new Set();
  filas.forEach((f) => Object.keys(f).forEach((k) => todasLasClaves.add(k)));
  const clavesArray = Array.from(todasLasClaves);

  const columnas = [];
  const clavesUsadas = new Set();
  let claveId = null;

  definicion.forEach((columna) => {
    const claveReal = resolverClaveDisponible(clavesArray, columna.claves);
    if (!claveReal) return;
    columnas.push({
      clave: claveReal,
      titulo: columna.titulo,
      tipo: columna.tipo || inferirTipoColumna(claveReal),
      esId: columna.esId || false
    });
    clavesUsadas.add(claveReal);
    if (!claveId && (columna.esId || /^id/i.test(claveReal))) claveId = claveReal;
  });

  clavesArray.forEach((clave) => {
    if (clavesUsadas.has(clave)) return;
    columnas.push({ clave, titulo: formatearTituloColumna(clave), tipo: inferirTipoColumna(clave) });
    if (!claveId && /^id/i.test(clave)) claveId = clave;
  });

  if (!claveId && columnas.length) claveId = columnas[0].clave;
  return { columnas, claveId };
}
function inferirTipoColumna(nombreClave) {
  const limpio = limpiarNombreClave(nombreClave);
  if (limpio.includes('foto') || limpio.includes('imagen')) return 'imagen';
  return 'texto';
}

// Columnas visibles por entidad (solo las usadas aquí)
const configuracionTablas = {
  empleado: [
    { claves: ['idEmpleado','id_empleado','idempleado','empleado_id','id','ID','Id'], titulo: 'ID Empleado', esId: true },
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
  ]
};

// Render barra lateral
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

// Tabla: render genérico con detección de columnas por entidad
function renderizarTabla(filas) {
  contenedorTabla.innerHTML = '';
  if (!filas || filas.length === 0) {
    contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos para mostrar</div>';
    return;
  }
  // Copia superficial para no mutar la fuente
  const filasNorm = filas.map(r => ({ ...r }));
  const { columnas, claveId } = obtenerColumnasDisponibles(filasNorm);

  // Garantizar que la columna ID esté primero si existe
  let columnasParaRender = columnas.slice();
  if (claveId) {
    const idxId = columnasParaRender.findIndex(c => c.clave === claveId || c.esId === true || /^id/i.test(c.clave));
    if (idxId > 0) {
      const [colId] = columnasParaRender.splice(idxId, 1);
      columnasParaRender.unshift(colId);
    }
  }

  // Orden fijo seguro para empleados (evita desalineaciones)
  if (entidadActual === 'empleado') {
    const preferido = [
      { clave: 'idEmpleado', titulo: 'ID Empleado', esId: true },
      { clave: 'Nombre', titulo: 'Nombre' },
      { clave: 'Telefono', titulo: 'Teléfono' },
      { clave: 'Correo', titulo: 'Correo' },
      { clave: 'Asistencia', titulo: 'Asistencia' },
      { clave: 'Especialidad', titulo: 'Especialidad' },
      { clave: 'foto_url', titulo: 'Foto', tipo: 'imagen' }
    ];
    const mapa = Object.create(null);
    columnasParaRender.forEach(c => { mapa[c.clave.toLowerCase()] = c; });
    columnasParaRender = preferido.map(def => {
      const found = mapa[def.clave.toLowerCase()];
      return found ? { ...found, titulo: def.titulo, tipo: def.tipo || found.tipo, esId: def.esId || found.esId } : def;
    });
  }

  // Acciones: botón seleccionar ID para admins
  const accionesRenderer = usuarioActual?.rol === 'Administrador' ? (registro) => {
    if (!claveId) return [];
    const valorId = registro[claveId] ?? registro.id ?? registro.ID ?? registro.Id;
    if (valorId == null) return [];
    const botonSeleccionar = crear('button', 'btn-table-action', 'Seleccionar');
    botonSeleccionar.addEventListener('click', () => {
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
        setTimeout(() => { if (mensajeActualizacion) mensajeActualizacion.style.color = ''; }, 3000);
      }
    });
    return [botonSeleccionar];
  } : null;

  const tabla = construirTabla({
    columnas: columnasParaRender,
    filas: filasNorm,
    incluirAcciones: !!accionesRenderer,
    renderAcciones: accionesRenderer,
    fijoEmpleado: entidadActual === 'empleado'
  });
  contenedorTabla.appendChild(tabla);
}

// Constructor reutilizable de tablas
function construirTabla({ columnas, filas, incluirAcciones=false, renderAcciones=null, fijoEmpleado=false }) {
  const tabla = document.createElement('table');
  tabla.className = 'data-table';
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  const columnasRender = fijoEmpleado ? [
    { clave: 'idEmpleado', titulo: 'ID Empleado', esId: true },
    { clave: 'Nombre', titulo: 'Nombre' },
    { clave: 'Telefono', titulo: 'Teléfono' },
    { clave: 'Correo', titulo: 'Correo' },
    { clave: 'Asistencia', titulo: 'Asistencia' },
    { clave: 'Especialidad', titulo: 'Especialidad' },
    { clave: 'foto_url', titulo: 'Foto', tipo: 'imagen' }
  ].map(def => {
    const m = columnas.find(c => c.clave.toLowerCase() === def.clave.toLowerCase()) || def;
    return { ...m, titulo: def.titulo, esId: def.esId || m.esId, tipo: def.tipo || m.tipo };
  }) : columnas;

  columnasRender.forEach(col => {
    const th = document.createElement('th'); th.textContent = col.titulo; trHead.appendChild(th);
  });
  if (incluirAcciones) {
    const thAcc = document.createElement('th'); thAcc.textContent = 'Acciones'; trHead.appendChild(thAcc);
  }
  thead.appendChild(trHead); tabla.appendChild(thead);

  const tbody = document.createElement('tbody');
  filas.forEach(registro => {
    const tr = document.createElement('tr');
    columnasRender.forEach(col => {
      const td = document.createElement('td');
      td.setAttribute('data-label', col.titulo);
      let valor = registro[col.clave];
      if (col.tipo === 'imagen') {
        const img = document.createElement('img');
        img.src = resolverRutaImagen(valor);
        img.alt = 'foto';
        img.loading = 'lazy';
        img.style.maxWidth = '64px';
        img.style.maxHeight = '64px';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid var(--border-light)';
        img.onerror = () => { img.src = '/default-user.svg'; };
        td.appendChild(img);
      } else {
        if (col.esId && (valor == null || valor === '')) {
          valor = registro.id || registro.ID || registro.Id || registro.idEmpleado || registro.idProyecto || registro.idCliente || registro.idMaterial || registro.idTarea || registro.idTurno;
        }
        td.textContent = valor == null || valor === '' ? '—' : String(valor);
      }
      tr.appendChild(td);
    });
    if (incluirAcciones && renderAcciones) {
      const tdAcc = document.createElement('td'); tdAcc.setAttribute('data-label', 'Acciones'); tdAcc.className='actions-cell';
      const acciones = renderAcciones(registro) || [];
      acciones.forEach(a => tdAcc.appendChild(a));
      tr.appendChild(tdAcc);
    }
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
  return tabla;
}





async function cargarDatos() {
  if (modoActual !== 'entidades') return;
  if (!usuarioActual || usuarioActual.rol !== 'Administrador') return;
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
    if (e.name === 'AbortError') return;
    contenedorTabla.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--error);">Error: ${e.message}</div>`;
  }
}
buscarEl.addEventListener('input', () => {
  if (buscarEl._t) clearTimeout(buscarEl._t);
  buscarEl._t = setTimeout(cargarDatos, 300);
});

// ========================================
// Auth/UI
// ========================================
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

// Pluralización mínima para /api/min/*
const mapaPlural = {
  empleado: 'empleados',
  cliente: 'clientes',
  proyecto: 'proyectos',
  apartamento: 'apartamentos',
  piso: 'pisos',
  material: 'materiales',
  tarea: 'tareas',
  turno: 'turnos'
};
function obtenerPlural(nombre) { return mapaPlural[nombre] || `${nombre}s`; }

// Entidades con endpoint /api/min/*
const entidadesConMin = new Set(['empleado','cliente','proyecto','material']);

function textoParaOpcionItem(item) {
  const id = item.id ?? item.ID ?? item.Id ?? item.idEmpleado ?? item.idCliente ?? item.idProyecto ?? item.idMaterial ?? item.idTurno ?? item.idTarea;
  const candidates = [
    item.nombre, item.Nombre, item.descripcion, item.Descripcion,
    item.Correo, item.Telefono, item.Tipo_jornada, item.numero, item.num_apartamento, item.num_piso
  ];
  const label = candidates.find(v => v != null && v !== '') || '';
  return `${id != null ? id : ''}${label ? ' - ' + label : ''}`.trim();
}

async function cargarOpcionesActualizacion() {
  if (!entradaIdActualizacion) return;
  entradaIdActualizacion.innerHTML = '';
  const marcadorPosicion = document.createElement('option');
  marcadorPosicion.value = '';
  marcadorPosicion.textContent = '-- Selecciona --';
  entradaIdActualizacion.appendChild(marcadorPosicion);
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
    const id = it.id ?? it.ID ?? it.Id ?? it.idEmpleado ?? it.idCliente ?? it.idProyecto ?? it.idMaterial ?? it.idTurno ?? it.idTarea;
    if (id == null) return;
    opt.value = String(id);
    opt.textContent = textoParaOpcionItem(it) || `ID ${id}`;
    entradaIdActualizacion.appendChild(opt);
  });
}

// Prefill form al seleccionar ID
if (entradaIdActualizacion) {
  entradaIdActualizacion.addEventListener('change', async () => {
    if (!usuarioActual || usuarioActual.rol !== 'Administrador') return;
    mensajeActualizacion.textContent = '';
    const id = (entradaIdActualizacion.value || '').trim();
    // Limpiar mensajes y no rellenar si no hay ID
    if (!id) {
      mensajeActualizacion.textContent = '';
      return;
    }
    mensajeActualizacion.style.color = '';
    mensajeActualizacion.textContent = 'Cargando datos...';
    try {
      const registro = await solicitarAPI(`/api/get/${entidadActual}/${encodeURIComponent(id)}`);
      // Rellenar campos existentes
      Array.from(formularioDinamico.elements).forEach((el) => {
        if (!el.name) return;
        if (el.type === 'submit') return;
        // No sobreescribir campos especiales de creación de usuario
        if (['crear_usuario','nombre_usuario','contraseña','rol_usuario','correo_usuario'].includes(el.name)) return;
        const valor = registro[el.name];
        if (valor == null || valor === '') return; // dejar vacío para permitir cambios
        if (el.tagName === 'SELECT') {
          // Asegurar que la opción exista
          const existe = Array.from(el.options).some(o => o.value === String(valor));
            if (!existe) {
              const op = document.createElement('option');
              op.value = String(valor);
              op.textContent = `Actual: ${valor}`;
              el.appendChild(op);
            }
          el.value = String(valor);
        } else if (el.type === 'checkbox') {
          el.checked = valor === true || valor === 1 || valor === '1';
        } else {
          el.value = String(valor);
        }
        // Breve highlight visual
        el.classList.add('prefilled');
        setTimeout(() => el.classList.remove('prefilled'), 1800);
      });
      mensajeActualizacion.style.color = '';
      mensajeActualizacion.textContent = 'Datos cargados. Modifica y presiona Actualizar.';
      actualizarVisibilidadControlesFoto();
    } catch (e) {
      mensajeActualizacion.style.color = 'salmon';
      mensajeActualizacion.textContent = e.message;
    }
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

// Face-api: carga simplificada de modelos
async function cargarModelosFace() {
  if (modelosRostroCargados || cargandoModeloRostro) return;
  cargandoModeloRostro = true;
  try {
    if (typeof window.faceapi === 'undefined') throw new Error('Biblioteca face-api no cargada');
    const baseLocal = '/models';
    if (mensajeLoginRostro) mensajeLoginRostro.textContent = 'Cargando modelos...';
    await faceapi.nets.tinyFaceDetector.loadFromUri(baseLocal);
    try {
      await faceapi.nets.faceLandmark68Net.loadFromUri(baseLocal);
    } catch {
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseLocal);
    }
    await faceapi.nets.faceRecognitionNet.loadFromUri(baseLocal);
    modelosRostroCargados = true;
    if (mensajeLoginRostro) mensajeLoginRostro.textContent = 'Modelos listos';
  } catch (e) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color='salmon'; mensajeLoginRostro.textContent = 'Modelos no cargados: ' + e.message; }
    console.error('Error cargando modelos:', e);
  } finally {
    cargandoModeloRostro = false;
  }
}
async function iniciarCamaraFace() {
  if (!navigator.mediaDevices?.getUserMedia) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = 'getUserMedia no soportado'; }
    return;
  }
  try {
    await cargarModelosFace();
    if (mensajeLoginRostro) { mensajeLoginRostro.textContent = 'Activando cámara...'; mensajeLoginRostro.style.color = ''; }
    flujoRostro = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
    if (videoRostro) videoRostro.srcObject = flujoRostro;
    if (btnLoginRostro) btnLoginRostro.disabled = false;
    if (mensajeLoginRostro) mensajeLoginRostro.textContent = 'Cámara lista';
  } catch (e) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = 'Error al activar cámara: ' + e.message; }
  }
}
async function capturarDescriptorFace() {
  if (!modelosRostroCargados) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = 'Modelos no cargados'; }
    return null;
  }
  if (!videoRostro || videoRostro.readyState < 2) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = 'Video no listo'; }
    return null;
  }
  const opciones = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 160 });
  let deteccion = null;
  try {
    if (faceapi.nets.faceLandmark68Net.params) {
      deteccion = await faceapi.detectSingleFace(videoRostro, opciones).withFaceLandmarks().withFaceDescriptor();
    } else if (faceapi.nets.faceLandmark68TinyNet.params) {
      deteccion = await faceapi.detectSingleFace(videoRostro, opciones).withFaceLandmarks(true).withFaceDescriptor();
    } else {
      deteccion = await faceapi.detectSingleFace(videoRostro, opciones).withFaceDescriptor();
    }
  } catch {
    try { deteccion = await faceapi.detectSingleFace(videoRostro, opciones).withFaceDescriptor(); } catch(_) {}
  }
  if (!deteccion) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = 'No se detectó rostro. Reintenta.'; }
    return null;
  }
  if (mensajeLoginRostro) { mensajeLoginRostro.style.color = ''; mensajeLoginRostro.textContent = 'Rostro detectado'; }
  return Array.from(deteccion.descriptor);
}
async function ejecutarLoginFace() {
  const username = (usuarioLoginRostro?.value || '').trim();
  if (!username) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = 'Ingresa el usuario'; }
    return;
  }
  if (mensajeLoginRostro) { mensajeLoginRostro.style.color = ''; mensajeLoginRostro.textContent = 'Capturando rostro...'; }
  try {
    const descriptor = await capturarDescriptorFace();
    if (!descriptor) return;
    if (mensajeLoginRostro) mensajeLoginRostro.textContent = 'Comparando...';
    const r = await solicitarAPI('/api/auth/login-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, descriptor })
    });
    usuarioActual = r.user;
    if (mensajeLoginRostro) mensajeLoginRostro.textContent = 'Login facial exitoso (distancia ' + r.distancia.toFixed(3) + ')';
    actualizarUIParaAutenticacion();
  } catch (e) {
    if (mensajeLoginRostro) { mensajeLoginRostro.style.color = 'salmon'; mensajeLoginRostro.textContent = e.message; }
  }
}
if (btnIniciarRostro) btnIniciarRostro.addEventListener('click', iniciarCamaraFace);
if (btnLoginRostro) btnLoginRostro.addEventListener('click', ejecutarLoginFace);

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener('click', async () => {
    try { await solicitarAPI('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    usuarioActual = null;
    barraLateral.style.display = '';
    actualizarUIParaAutenticacion();
  });
}

// Construcción de formularios (solo entidades visibles)
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
    { name: 'Especialidad', type: 'select', options: [
      'Oficial de acabados',
      'Instalador de drywall y cielorrasos',
      'Pintor',
      'Enchapador',
      'Carpintero',
      'Vidriero',
      'Carpintero metálico o de aluminio',
      'Electricista',
      'Plomero',
      'Estucador',
      'Diseñador interior',
      'Instalador de cielos falsos acústicos'
    ] },
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
      const selectEl = crear('select'); selectEl.name = f.name;
      const opcionVacia = crear('option', '', '--'); opcionVacia.value = ''; selectEl.appendChild(opcionVacia);
      if (f.options) {
        f.options.forEach((v) => { const op = crear('option', '', v); op.value = v; selectEl.appendChild(op); });
      }
      if (f.source) {
        try {
          const resp = await fetch(`${baseAPI}${f.source}`);
          const datos = await resp.json();
          datos.forEach((item) => {
            const op = crear('option', '', `${item.id} - ${item.nombre}`); op.value = item.id; selectEl.appendChild(op);
          });
        } catch (_) {}
      }
      formularioDinamico.appendChild(selectEl);
    } else {
      const inputEl = crear('input'); inputEl.name = f.name; inputEl.type = f.type || 'text';
      if (f.step) inputEl.step = f.step;
      if (f.req) inputEl.required = true;
      const nombreEnMinusculas = (f.name || '').toLowerCase();
      if (inputEl.type === 'tel' || nombreEnMinusculas.includes('telefono')) {
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
        if (f.pattern) inputEl.setAttribute('pattern', f.pattern);
        else inputEl.setAttribute('pattern', '[A-Za-zÁÉÍÓÚáéíóúÑñ\\s]+');
        inputEl.addEventListener('input', () => {
          const limpio = sanitizarLetrasYEspacios(inputEl.value);
          if (inputEl.value !== limpio) inputEl.value = limpio;
        });
      }
      formularioDinamico.appendChild(inputEl);
    }
  }
  const boton = crear('button', '', 'Guardar'); boton.type = 'submit'; formularioDinamico.appendChild(boton);
  // Reset update ID when changing entity
  if (entradaIdActualizacion) entradaIdActualizacion.value = '';
  inicializarControlesFoto();
  actualizarVisibilidadControlesFoto();

  // Bloque adicional: crear cuenta para Empleado
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
    const botonGuardar = Array.from(formularioDinamico.querySelectorAll('button')).find(b => b.type === 'submit');
    if (botonGuardar) formularioDinamico.appendChild(botonGuardar);
  }

  // Bloque adicional: crear cuenta para Cliente (opcional)
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

// Submit create
formularioDinamico.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  mensajeFormulario.style.color = '#89ff9f';
  mensajeFormulario.textContent = 'Guardando...';
  const datos = {};
  Array.from(formularioDinamico.elements).forEach((el) => {
    if (!el.name) return;
    if (el.type === 'submit') return;
    if (el.tagName === 'SELECT' || el.type !== 'checkbox') datos[el.name] = el.value === '' ? null : el.value;
    if (el.type === 'checkbox') datos[el.name] = el.checked ? '1' : '0';
  });
  try {
    let r;
    if (entidadActual === 'empleado' && (datos.crear_usuario === '1' || datos.crear_usuario === 1 || datos.crear_usuario === true)) {
      const payload = {
        Nombre: datos.Nombre || null,
        Correo: datos.Correo || null,
        Telefono: datos.Telefono || null,
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

// Update por ID
if (btnActualizar) {
  btnActualizar.addEventListener('click', async () => {
    mensajeActualizacion.textContent = '';
    const id = (entradaIdActualizacion.value || '').trim();
    if (!id) { mensajeActualizacion.style.color = 'salmon'; mensajeActualizacion.textContent = 'Ingrese ID'; return; }
    const datos = {};
    Array.from(formularioDinamico.elements).forEach((el) => {
      if (!el.name || el.type === 'submit') return;
      if (el.tagName === 'SELECT' || el.type !== 'checkbox') {
        if (el.value !== '') datos[el.name] = el.value;
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

// Delete por ID
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

// Admin: crear con foto (multipart)
if (formularioCrearAdmin) {
  formularioCrearAdmin.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mensajeCrearAdmin.textContent = 'Creando...';
    mensajeCrearAdmin.style.color = '';
    const fd = new FormData(formularioCrearAdmin);
    try {
      const res = await fetch(`${baseAPI}/api/admin/create`, { method: 'POST', credentials: 'include', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error');
      mensajeCrearAdmin.textContent = `Admin creado (id ${body.idUsuario})`;
      formularioCrearAdmin.reset();
      cargarAdminsSeguro();
      if (body.idUsuario && body.foto_url) {
        intentarAutoDescriptor(body.idUsuario, body.foto_url).catch(e => console.warn('Auto descriptor falló:', e.message));
      }
    } catch (e) {
      mensajeCrearAdmin.style.color = 'salmon';
      mensajeCrearAdmin.textContent = e.message;
    }
  });
}
//a
// Listar/eliminar administradores
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
    [' ','Usuario','Correo','Foto','Acciones'].forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(u => {
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td'); tdUser.textContent = u.nombre_usuario; tr.appendChild(tdUser);
      const tdCorreo = document.createElement('td'); tdCorreo.textContent = u.Correo || '—'; tr.appendChild(tdCorreo);

      const tdFoto = document.createElement('td');
      if (u.foto_url) {
        const img = document.createElement('img');
        img.src = u.foto_url;
        img.alt = 'foto';
        img.loading = 'lazy';
        img.style.maxWidth = '56px';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid var(--border-light)';
        tdFoto.appendChild(img);
      } else { tdFoto.textContent = '—'; }
      tr.appendChild(tdFoto);
      const tdAcc = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.textContent = 'Eliminar';
      btnDel.style.background = '#ef4444';
      btnDel.addEventListener('click', async () => { await eliminarAdmin(u.idUsuario); });
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
    await solicitarAPI(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
if (btnRefrescarAdmins) btnRefrescarAdmins.addEventListener('click', () => cargarAdminsSeguro());

// Inicial
inicializarControlesFoto();
verificarAutenticacion();

// ==========================
// Auto descriptor (post-subida de foto)
// ==========================
async function intentarAutoDescriptor(idUsuario, fotoUrl) {
  try {
    await cargarModelosFace();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loadP = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('No se pudo cargar la foto')); });
    img.src = resolverRutaImagen(fotoUrl);
    await loadP;
    const det = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (!det) throw new Error('No se detectó rostro en la foto subida');
    const descriptor = Array.from(det.descriptor);
    await solicitarAPI(`/api/users/${idUsuario}/face`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descriptor })
    });
    console.log('Descriptor generado automáticamente para usuario', idUsuario);
  } catch (e) {
    console.warn('Intento auto descriptor falló:', e.message);
    throw e;
  }
}
