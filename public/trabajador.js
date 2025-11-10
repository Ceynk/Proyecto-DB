// Variables en español
const baseAPI = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';
let usuarioActual = null;

async function api(ruta, opciones = {}) {
  const res = await fetch(`${baseAPI}${ruta}`, { credentials: 'include', ...opciones });
  const tipo = res.headers.get('content-type') || '';
  const cuerpo = tipo.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof cuerpo === 'string' ? cuerpo : (cuerpo.error || 'Error'));
  return cuerpo;
}

async function verificarSesion() {
  let me;
  try { me = await api('/api/auth/me'); } catch (_) { window.location.href='/'; return; }
  usuarioActual = me.user;
  if (!usuarioActual || usuarioActual.rol !== 'Empleado') { window.location.href='/'; return; }
  prepararSelfEnrollmentTrab(me.hasFaceDescriptor === true);
  cargarInfo().catch(()=>{});
  cargarTareas().catch(()=>{});
  cargarMaterialesTrabajador().catch(()=>{});
  cargarListaMaterialesSelect().catch(()=>{});
}

async function cargarInfo() {
  const cont = document.getElementById('infoEmpleado');
  if (!cont) return;
  try {
    const info = await api('/api/empleado/mis-datos');
    const initials = (info.Nombre || '?').split(' ').map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
    const asistencia = info.Asistencia || '—';
    cont.innerHTML = `
      <div class="info-card">
        <div class="info-avatar">${initials}</div>
        <div class="info-block">
          <div class="info-fields">
            <div class="info-line"><span class="lbl">Nombre:</span><b>${info.Nombre || '-'}</b></div>
            <div class="info-line"><span class="lbl">Correo:</span><b>${info.Correo || '-'}</b></div>
            <div class="info-line"><span class="lbl">Teléfono:</span><b>${info.Telefono || '-'}</b></div>
            <div class="info-line"><span class="lbl">Proyecto:</span><b>${info.Proyecto || '—'}</b></div>
            <div class="info-line"><span class="lbl">Cliente:</span><b>${info.Cliente || '—'}</b></div>
          </div>
          <div class="kpi-bar">
            <div class="kpi-item"><div class="kpi-num">${info.Pisos ?? 0}</div><div class="kpi-label">Pisos</div></div>
            <div class="kpi-item"><div class="kpi-num">${info.Apartamentos ?? 0}</div><div class="kpi-label">Apartamentos</div></div>
            <div class="kpi-item"><div class="kpi-num">${asistencia}</div><div class="kpi-label">Asistencia</div></div>
          </div>
          <div class="info-hint">Puedes registrar/actualizar tu rostro en la sección de Asistencia.</div>
        </div>
      </div>`;
  } catch (e) {
    cont.innerHTML = `<div style="color:salmon;">${e.message}</div>`;
  }
}

async function cargarTareas() {
  const cont = document.getElementById('listaTareas');
  cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Cargando...</div>';
  try {
    const tareas = await api('/api/empleado/mis-tareas');
    if (!tareas.length) { cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Sin tareas</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = ['ID','Descripción','Estado','Proyecto','Pisos','Apartamentos','Fecha inicio','Fecha fin'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    tareas.forEach(t => {
      const tr = document.createElement('tr');
      [t.idTarea, t.Descripcion, t.Estado, t.Proyecto || '—', t.Pisos ?? 0, t.Apartamentos ?? 0, t.Fecha_inicio ? String(t.Fecha_inicio).slice(0,10) : '—', t.Fecha_fin ? String(t.Fecha_fin).slice(0,10) : '—']
        .forEach((v,i) => { const td=document.createElement('td'); td.setAttribute('data-label', headers[i]); td.textContent = v==null?'':String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML=''; cont.appendChild(tabla);
  } catch (e) {
    cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

// Eventos
const btnSalir = document.getElementById('btnSalir');
if (btnSalir) {
  btnSalir.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    window.location.href = '/';
  });
}

const btnAsistencia = document.getElementById('btnAsistencia');
const msgAsistencia = document.getElementById('msgAsistencia');
if (btnAsistencia) {
  btnAsistencia.addEventListener('click', async () => {
    msgAsistencia.textContent = 'Marcando...'; msgAsistencia.style.color = '';
    try {
      await api('/api/empleado/asistencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'Presente' }) });
      msgAsistencia.textContent = 'Asistencia marcada';
      cargarInfo();
    } catch (e) {
      msgAsistencia.style.color = 'salmon'; msgAsistencia.textContent = e.message;
    }
  });
}

const btnRefrescar = document.getElementById('btnRefrescar');
if (btnRefrescar) {
  btnRefrescar.addEventListener('click', () => { cargarInfo(); cargarTareas(); });
}

verificarSesion();

// ===================== Inventario para Trabajador =====================
async function cargarMaterialesTrabajador() {
  const cont = document.getElementById('catalogoMaterialesTrab');
  if (!cont) return;
  const q = (document.getElementById('buscarInvTrab')?.value || '').trim();
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const url = q ? `/api/inventory/cards?q=${encodeURIComponent(q)}` : '/api/inventory/cards';
    const lista = await api(url);
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin materiales</div>'; return; }
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(220px,1fr))';
    grid.style.gap = '1rem';
    lista.forEach(m => {
      const card = document.createElement('div');
      card.style.background = 'var(--bg-secondary)';
      card.style.border = '1px solid var(--border-light)';
      card.style.borderRadius = '8px';
      card.style.padding = '.75rem';
      card.innerHTML = `
        <div style="height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:6px;margin-bottom:.5rem;background:#111">
          <img src="${m.foto_url || '/default-material.svg'}" alt="${m.Nombre}" style="max-width:100%;max-height:100%;object-fit:cover" onerror="this.src='/default-material.svg'" />
        </div>
        <div style="font-weight:600;margin-bottom:.25rem">${m.Nombre}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">Tipo: ${m.tipo || '—'}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">Stock: ${m.stock ?? 0}</div>
      `;
      grid.appendChild(card);
    });
    cont.innerHTML = ''; cont.appendChild(grid);
  } catch (e) {
    cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

const buscarInvTrab = document.getElementById('buscarInvTrab');
if (buscarInvTrab) {
  buscarInvTrab.addEventListener('input', () => { if (buscarInvTrab._t) clearTimeout(buscarInvTrab._t); buscarInvTrab._t = setTimeout(cargarMaterialesTrabajador, 300); });
}

async function cargarListaMaterialesSelect() {
  const sel = document.getElementById('selMaterialTrab');
  if (!sel) return;
  sel.innerHTML = '';
  try {
    const lista = await api('/api/inventory/cards');
    lista.forEach(m => {
      const op = document.createElement('option');
      op.value = m.idMaterial; op.textContent = `${m.idMaterial} - ${m.Nombre} (stock ${m.stock ?? 0})`;
      sel.appendChild(op);
    });
  } catch (e) {
    const op = document.createElement('option'); op.value=''; op.textContent='Error'; sel.appendChild(op);
  }
}

const formConsumir = document.getElementById('formConsumirMaterial');
const msgConsumir = document.getElementById('msgConsumirMaterial');
if (formConsumir) {
  formConsumir.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msgConsumir.textContent = 'Procesando...'; msgConsumir.style.color='';
    const fd = new FormData(formConsumir);
    const datos = Object.fromEntries(fd.entries());
    try {
      await api('/api/empleado/consumir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      msgConsumir.textContent = 'Consumo registrado';
      formConsumir.reset();
      await cargarMaterialesTrabajador();
      await cargarListaMaterialesSelect();
    } catch (e) {
      msgConsumir.style.color = 'salmon'; msgConsumir.textContent = e.message;
    }
  });
}

// ===================== Enrolamiento facial (Trabajador) =====================
let modelosCargadosTrab = false;
let cargandoModeloTrab = false;
let streamTrab = null;

async function cargarModelosFaceTrab() {
  if (modelosCargadosTrab || cargandoModeloTrab) return;
  cargandoModeloTrab = true;
  const baseLocal = '/models';
  try {
    // Verificar archivos básicos
    const reqs = [
      `${baseLocal}/tiny_face_detector_model-weights_manifest.json`,
      `${baseLocal}/tiny_face_detector_model.bin`,
      `${baseLocal}/face_landmark_68_model-weights_manifest.json`,
      `${baseLocal}/face_landmark_68_model.bin`,
      `${baseLocal}/face_recognition_model-weights_manifest.json`,
      `${baseLocal}/face_recognition_model.bin`
    ];
    await Promise.all(reqs.map(u => fetch(u, { method:'HEAD', cache:'no-store' })));
    await faceapi.nets.tinyFaceDetector.loadFromUri(baseLocal);
    try { await faceapi.nets.faceLandmark68Net.loadFromUri(baseLocal); }
    catch { await faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseLocal); }
    await faceapi.nets.faceRecognitionNet.loadFromUri(baseLocal);
    modelosCargadosTrab = true;
  } finally {
    cargandoModeloTrab = false;
  }
}

function prepararSelfEnrollmentTrab(yaTiene) {
  const btn = document.getElementById('btnEnrollFaceTrab');
  const area = document.getElementById('faceEnrollAreaTrab');
  const video = document.getElementById('faceVideoTrab');
  const btnInit = document.getElementById('btnInitCamTrab');
  const btnCap = document.getElementById('btnCaptureFaceTrab');
  const btnCerrar = document.getElementById('btnCerrarFaceTrab');
  const msg = document.getElementById('msgFaceTrab');
  if (!btn || !area || !video || !btnInit || !btnCap || !btnCerrar || !msg) return;

  btn.style.display = '';
  if (yaTiene) btn.textContent = 'Actualizar mi rostro';

  btn.addEventListener('click', () => {
    area.style.display = '';
  });
  btnCerrar.addEventListener('click', async () => {
    area.style.display = 'none';
    msg.textContent = '';
    btnCap.disabled = true;
    if (streamTrab) {
      streamTrab.getTracks().forEach(t => t.stop());
      streamTrab = null;
    }
  });
  btnInit.addEventListener('click', async () => {
    try {
      msg.style.color = ''; msg.textContent = 'Cargando modelos...';
      await cargarModelosFaceTrab();
      msg.textContent = 'Activando cámara...';
      streamTrab = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      video.srcObject = streamTrab;
      btnCap.disabled = false;
      msg.textContent = 'Cámara lista';
    } catch (e) {
      msg.style.color = 'salmon'; msg.textContent = e.message;
    }
  });
  btnCap.addEventListener('click', async () => {
    try {
      msg.style.color=''; msg.textContent='Detectando...';
      const opts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 160 });
      let det = null;
      try {
        if (faceapi.nets.faceLandmark68Net.params) det = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
        else if (faceapi.nets.faceLandmark68TinyNet.params) det = await faceapi.detectSingleFace(video, opts).withFaceLandmarks(true).withFaceDescriptor();
        else det = await faceapi.detectSingleFace(video, opts).withFaceDescriptor();
      } catch (_) {}
      if (!det) { msg.style.color='salmon'; msg.textContent='No se detectó rostro'; return; }
      msg.textContent='Guardando...';
      const descriptor = Array.from(det.descriptor);
      await api('/api/users/me/face', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ descriptor }) });
      msg.textContent='Rostro registrado. Ya puedes usar login facial.';
    } catch (e) {
      msg.style.color='salmon'; msg.textContent=e.message;
    }
  });
}
