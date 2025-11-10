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
  try {
    const me = await api('/api/auth/me');
    usuarioActual = me.user;
    if (!usuarioActual) throw new Error('No autenticado');
    // Acceso exclusivo del Contador
    if (usuarioActual.rol !== 'Contador') {
      window.location.href = '/';
      return;
    }
  await cargarListasMinimas();
  await cargarResumenProyectos();
    await cargarInventario();
    await cargarFacturas();
    await cargarInventarioCards();
    prepararSelfEnrollmentCont(me.hasFaceDescriptor === true);
  } catch (_) {
    window.location.href = '/';
  }
}

async function cargarResumenProyectos() {
  const cont = document.getElementById('tablaResumenProyectos');
  if (!cont) return;
  cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Cargando...</div>';
  try {
    const lista = await api('/api/contador/proyectos-resumen');
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Sin proyectos</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = ['ID','Proyecto','Cliente','Pisos','Apartamentos'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(p => {
      const tr = document.createElement('tr');
      [p.idProyecto, p.Proyecto, p.Cliente, p.Pisos, p.Apartamentos].forEach((v,i) => { const td=document.createElement('td'); td.setAttribute('data-label', headers[i]); td.textContent = v==null?'':String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML=''; cont.appendChild(tabla);
  } catch (e) { cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`; }
}

async function cargarListasMinimas() {
  const selMaterial = document.getElementById('selMaterial');
  const selProyecto = document.getElementById('selProyecto');
  const selCliente = document.getElementById('selCliente');
  const selProyectoFactura = document.getElementById('selProyectoFactura');
  function llenar(select, datos, incluirVacio = true) {
    select.innerHTML = '';
    if (incluirVacio) { const op = document.createElement('option'); op.value = ''; op.textContent = '--'; select.appendChild(op); }
    datos.forEach(d => { const op = document.createElement('option'); op.value = d.id; op.textContent = `${d.id} - ${d.nombre}`; select.appendChild(op); });
  }
  const [materiales, proyectos, clientes] = await Promise.all([
    api('/api/contador/min/materiales'),
    api('/api/contador/min/proyectos'),
    api('/api/contador/min/clientes')
  ]);
  llenar(selMaterial, materiales, false);
  llenar(selProyecto, proyectos, true);
  llenar(selCliente, clientes, false);
  llenar(selProyectoFactura, proyectos, true);
}

async function cargarInventario() {
  const cont = document.getElementById('tablaInventario');
  cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Cargando...</div>';
  const q = (document.getElementById('buscarInv').value || '').trim();
  try {
    const lista = await api(`/api/contador/inventario${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Sin registros</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = ['ID','Tipo','Cantidad','Fecha','Material','Proyecto'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(r => {
      const tr = document.createElement('tr');
      [r.idInventario, r.tipo_movimiento, r.cantidad, r.fecha, r.Material, r.Proyecto].forEach((v,i) => { const td=document.createElement('td'); td.setAttribute('data-label', headers[i]); td.textContent = v==null?'':String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML=''; cont.appendChild(tabla);
  } catch (e) { cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`; }
}

async function cargarFacturas() {
  const cont = document.getElementById('listaFacturas');
  cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Cargando...</div>';
  try {
    const lista = await api('/api/contador/facturas');
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Sin facturas</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = ['ID','Fecha','Cliente','Proyecto','Total','PDF'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(f => {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.setAttribute('data-label', headers[0]); tdId.textContent = f.idFactura; tr.appendChild(tdId);
      const tdFecha = document.createElement('td'); tdFecha.setAttribute('data-label', headers[1]); tdFecha.textContent = f.Fecha; tr.appendChild(tdFecha);
      const tdCliente = document.createElement('td'); tdCliente.setAttribute('data-label', headers[2]); tdCliente.textContent = f.Cliente || '—'; tr.appendChild(tdCliente);
      const tdProyecto = document.createElement('td'); tdProyecto.setAttribute('data-label', headers[3]); tdProyecto.textContent = f.Proyecto || '—'; tr.appendChild(tdProyecto);
      const tdTotal = document.createElement('td'); tdTotal.setAttribute('data-label', headers[4]); tdTotal.textContent = `$ ${Number(f.Valor_total).toLocaleString('es-CO',{minimumFractionDigits:2})}`; tr.appendChild(tdTotal);
      const tdPdf = document.createElement('td'); tdPdf.setAttribute('data-label', headers[5]); tdPdf.className = 'actions-cell';
      const btn = document.createElement('button'); btn.textContent='Descargar PDF'; btn.addEventListener('click', () => descargarPDF(f.idFactura));
      tdPdf.appendChild(btn); tr.appendChild(tdPdf);
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML=''; cont.appendChild(tabla);
  } catch (e) { cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`; }
}

async function descargarPDF(id) {
  const url = `${baseAPI}/api/contador/facturas/${encodeURIComponent(id)}/pdf`;
  const win = window.open(url, '_blank');
  if (!win) {
    // fallback download
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.click();
  }
}

// Eventos UI
const btnSalir = document.getElementById('btnSalir');
if (btnSalir) {
  btnSalir.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    window.location.href = '/';
  });
}

const buscarInv = document.getElementById('buscarInv');
if (buscarInv) {
  buscarInv.addEventListener('input', () => { if (buscarInv._t) clearTimeout(buscarInv._t); buscarInv._t = setTimeout(cargarInventario, 300); });
}

const formTransaccion = document.getElementById('formTransaccion');
const msgTransaccion = document.getElementById('msgTransaccion');
if (formTransaccion) {
  formTransaccion.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msgTransaccion.textContent = 'Guardando...'; msgTransaccion.style.color = '';
    const fd = new FormData(formTransaccion);
    const datos = Object.fromEntries(fd.entries());
    try {
      await api('/api/contador/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      msgTransaccion.textContent = 'Transacción registrada';
      formTransaccion.reset();
      cargarInventario();
    } catch (e) { msgTransaccion.style.color = 'salmon'; msgTransaccion.textContent = e.message; }
  });
}

const formFactura = document.getElementById('formFactura');
const msgFactura = document.getElementById('msgFactura');
if (formFactura) {
  formFactura.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msgFactura.textContent = 'Creando...'; msgFactura.style.color = '';
    const fd = new FormData(formFactura);
    const datos = Object.fromEntries(fd.entries());
    try {
      const r = await api('/api/contador/facturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      msgFactura.textContent = `Factura creada (ID ${r.idFactura})`;
      formFactura.reset();
      cargarFacturas();
    } catch (e) { msgFactura.style.color = 'salmon'; msgFactura.textContent = e.message; }
  });
}

verificarSesion();

// ====== Inventario Cards (catálogo) ======
async function cargarInventarioCards() {
  const cont = document.getElementById('gridInventario');
  if (!cont) return;
  const q = (document.getElementById('buscarInvCards')?.value || '').trim();
  cont.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">Cargando inventario...</div>';
  try {
    const url = q ? `/api/inventory/cards?q=${encodeURIComponent(q)}` : '/api/inventory/cards';
    const [ovwResp, cardsResp] = await Promise.all([
      fetch(`${baseAPI}/api/inventory/overview`, { credentials: 'include' }).then(r=>r.json()),
      fetch(`${baseAPI}${url}`, { credentials: 'include' }).then(r=>r.json())
    ]);
    const wrap = document.createElement('div');
    // KPI simple
    const resumen = document.createElement('div');
    resumen.className = 'inv-summary';
    resumen.innerHTML = `
      <div class="inv-kpi"><div class="inv-kpi-num">${ovwResp?.materiales || 0}</div><div class="inv-kpi-label">Materiales</div></div>
      <div class="inv-kpi"><div class="inv-kpi-num">${ovwResp?.disponibles || 0}</div><div class="inv-kpi-label">Disponibles</div></div>
      <div class="inv-kpi"><div class="inv-kpi-num">${ovwResp?.agotados || 0}</div><div class="inv-kpi-label">Agotados</div></div>
    `;
    wrap.appendChild(resumen);
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    const cards = Array.isArray(cardsResp)
      ? cardsResp
      : (Array.isArray(cardsResp?.rows) ? cardsResp.rows : []);
    if (!Array.isArray(cards)) {
      throw new Error(typeof cardsResp?.error === 'string' ? cardsResp.error : 'Respuesta inesperada de /api/inventory/cards');
    }
    cards.forEach((it) => {
      const agotado = Number(it.stock || 0) <= 0;
      const card = document.createElement('div');
      card.className = 'inv-card';
      card.innerHTML = `
        <div class="inv-card-img">
          <img src="${it.foto_url || 'https://images.unsplash.com/photo-1556735979-89b03e0b5b51?auto=format&fit=crop&w=900&q=60'}" alt="${it.Nombre}" onerror="this.src='https://images.unsplash.com/photo-1556735979-89b03e0b5b51?auto=format&fit=crop&w=900&q=60'">
          ${agotado ? '<span class="inv-badge inv-badge-warn">Agotado</span>' : '<span class="inv-badge inv-badge-ok">Disponible</span>'}
        </div>
        <div class="inv-card-body">
          <h3 class="inv-card-title">${it.Nombre}</h3>
          <ul class="inv-meta">
            <li><span>Cantidad:</span><b>${Number(it.stock || 0)}</b></li>
            <li><span>Costo Unitario:</span><b>$ ${Number(it.costo_unitario).toLocaleString('es-CO',{minimumFractionDigits:2})}</b></li>
            <li><span>Tipo:</span><b>${it.tipo || '-'}</b></li>
            <li><span>Movimientos:</span><b>${Number(it.movimientos || 0)}</b></li>
          </ul>
        </div>
      `;
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    cont.innerHTML = '';
    cont.appendChild(wrap);
  } catch (e) {
    cont.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--error)">Error: ${e.message}</div>`;
  }
}

const buscarInvCards = document.getElementById('buscarInvCards');
if (buscarInvCards) {
  buscarInvCards.addEventListener('input', () => { if (buscarInvCards._t) clearTimeout(buscarInvCards._t); buscarInvCards._t = setTimeout(cargarInventarioCards, 300); });
}

// ===================== Enrolamiento facial (Contador) =====================
let modelosCargadosCont = false;
let cargandoModeloCont = false;
let streamCont = null;

async function cargarModelosFaceCont() {
  if (modelosCargadosCont || cargandoModeloCont) return;
  cargandoModeloCont = true;
  const baseLocal = '/models';
  try {
    const reqs = [
      `${baseLocal}/tiny_face_detector_model-weights_manifest.json`,
      `${baseLocal}/tiny_face_detector_model.bin`,
      `${baseLocal}/face_landmark_68_model-weights_manifest.json`,
      `${baseLocal}/face_landmark_68_model.bin`,
      `${baseLocal}/face_recognition_model-weights_manifest.json`,
      `${baseLocal}/face_recognition_model.bin`
    ];
    await Promise.all(reqs.map(u => fetch(u, { method: 'HEAD', cache: 'no-store' })));
    await faceapi.nets.tinyFaceDetector.loadFromUri(baseLocal);
    try { await faceapi.nets.faceLandmark68Net.loadFromUri(baseLocal); }
    catch { await faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseLocal); }
    await faceapi.nets.faceRecognitionNet.loadFromUri(baseLocal);
    modelosCargadosCont = true;
  } finally {
    cargandoModeloCont = false;
  }
}

function prepararSelfEnrollmentCont(yaTiene) {
  const btn = document.getElementById('btnEnrollFaceCont');
  const btnInit = document.getElementById('btnInitCamCont');
  const btnCap = document.getElementById('btnCaptureFaceCont');
  const btnCerrar = document.getElementById('btnCerrarFaceCont');
  const area = document.getElementById('faceAreaCont');
  const video = document.getElementById('faceVideoCont');
  const msg = document.getElementById('msgFaceCont');
  if (!btn || !btnInit || !btnCap || !btnCerrar || !area || !video || !msg) return;

  if (yaTiene) btn.textContent = 'Actualizar mi rostro';

  btn.addEventListener('click', () => {
    area.style.display = '';
    btnInit.style.display = '';
    btnCap.style.display = '';
    btnCerrar.style.display = '';
  });
  btnCerrar.addEventListener('click', () => {
    area.style.display = 'none';
    btnInit.style.display = 'none';
    btnCap.style.display = 'none';
    btnCerrar.style.display = 'none';
    msg.textContent = '';
    btnCap.disabled = true;
    if (streamCont) { streamCont.getTracks().forEach(t => t.stop()); streamCont = null; }
  });
  btnInit.addEventListener('click', async () => {
    try {
      msg.style.color = ''; msg.textContent = 'Cargando modelos...';
      await cargarModelosFaceCont();
      msg.textContent = 'Activando cámara...';
      streamCont = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      video.srcObject = streamCont;
      btnCap.disabled = false;
      msg.textContent = 'Cámara lista';
    } catch (e) {
      msg.style.color = 'salmon'; msg.textContent = e.message;
    }
  });
  btnCap.addEventListener('click', async () => {
    try {
      msg.style.color = ''; msg.textContent = 'Detectando...';
      const opts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 160 });
      let det = null;
      try {
        if (faceapi.nets.faceLandmark68Net.params) det = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
        else if (faceapi.nets.faceLandmark68TinyNet.params) det = await faceapi.detectSingleFace(video, opts).withFaceLandmarks(true).withFaceDescriptor();
        else det = await faceapi.detectSingleFace(video, opts).withFaceDescriptor();
      } catch (_) {}
      if (!det) { msg.style.color = 'salmon'; msg.textContent = 'No se detectó rostro'; return; }
      const descriptor = Array.from(det.descriptor);
      msg.textContent = 'Guardando...';
      await api('/api/users/me/face', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descriptor }) });
      msg.textContent = 'Rostro registrado. Ya puedes usar login facial.';
    } catch (e) {
      msg.style.color = 'salmon'; msg.textContent = e.message;
    }
  });
}
