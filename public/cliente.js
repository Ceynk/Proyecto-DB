const baseAPI = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';
let usuarioActual = null;

async function api(ruta, opciones = {}) {
  const res = await fetch(`${baseAPI}${ruta}`, { credentials: 'include', ...opciones });
  const tipo = res.headers.get('content-type') || '';
  const cuerpo = tipo.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof cuerpo === 'string' ? cuerpo : (cuerpo.error || 'Error'));
  return cuerpo;
}

async function verificarSesionCliente() {
  let me;
  try { me = await api('/api/auth/me'); } catch (_) { window.location.href='/'; return; }
  usuarioActual = me.user;
  if (!usuarioActual || usuarioActual.rol !== 'Cliente') { window.location.href='/'; return; }
  prepararSelfEnrollmentCliente(me.hasFaceDescriptor === true);
  cargarInfoCliente(me).catch(()=>{});
  cargarProyectos().catch(()=>{});
  cargarFacturas().catch(()=>{});
  cargarPagos().catch(()=>{});
}

async function cargarInfoCliente(meResp) {
  const cont = document.getElementById('infoCliente');
  if (!cont) return;
  try {
    const me = meResp || await api('/api/auth/me');
    const user = me?.user || {};
    const hasFace = me?.hasFaceDescriptor === true;

    // KPIs: proyectos, facturas, pagos
    const [proyectos, facturas, pagos] = await Promise.all([
      api('/api/cliente/proyectos').catch(()=>[]),
      api('/api/cliente/facturas').catch(()=>[]),
      api('/api/cliente/pagos').catch(()=>[])
    ]);
    const kProy = Array.isArray(proyectos) ? proyectos.length : 0;
    const kFact = Array.isArray(facturas) ? facturas.length : 0;
    const totalFacturado = Array.isArray(facturas) ? facturas.reduce((a,f)=>a+(Number(f.Valor_total)||0),0) : 0;
    const totalPagado = Array.isArray(pagos) ? pagos.reduce((a,p)=>a+(Number(p.Monto)||0),0) : 0;

    const initials = (user.Nombre || user.nombre_usuario || '?').split(' ').map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

    cont.innerHTML = `
      <div class="info-card">
        <div class="info-avatar">${initials || 'U'}</div>
        <div class="info-block">
          <div class="info-fields">
            <div class="info-line"><span class="lbl">Nombre:</span><b>${user.Nombre || '-'}</b></div>
            <div class="info-line"><span class="lbl">Correo:</span><b>${user.Correo || '-'}</b></div>
            <div class="info-line"><span class="lbl">Usuario:</span><b>${user.nombre_usuario || '-'}</b></div>
            <div class="info-line"><span class="lbl">Rol:</span><b>${user.rol || '-'}</b></div>
          </div>
          <div class="kpi-bar">
            <div class="kpi-item"><div class="kpi-num">${kProy}</div><div class="kpi-label">Proyectos</div></div>
            <div class="kpi-item"><div class="kpi-num">${kFact}</div><div class="kpi-label">Facturas</div></div>
            <div class="kpi-item"><div class="kpi-num">$ ${totalFacturado.toLocaleString('es-CO',{minimumFractionDigits:2})}</div><div class="kpi-label">Facturado</div></div>
            <div class="kpi-item"><div class="kpi-num">$ ${totalPagado.toLocaleString('es-CO',{minimumFractionDigits:2})}</div><div class="kpi-label">Pagado</div></div>
            <div class="kpi-item"><div class="kpi-num">${hasFace ? '<span class="info-face-ok">Sí</span>' : '<span class="info-face-no">No</span>'}</div><div class="kpi-label">Rostro</div></div>
          </div>
          <div class="info-hint">Usa el bloque de Reconocimiento Facial para habilitar login facial.</div>
        </div>
      </div>
    `;
  } catch (e) {
    cont.innerHTML = `<div style="color:salmon;">${e.message}</div>`;
  }
}

async function cargarProyectos() {
  const cont = document.getElementById('listaProyectos');
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const lista = await api('/api/cliente/proyectos');
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin proyectos</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = [' ','ID','Proyecto','Empleados','Tareas','Facturas','Acciones'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(p => {
      const tr = document.createElement('tr');
      [p.idProyecto, p.Proyecto, p.Empleados||0, p.Tareas||0, p.Facturas||0].forEach((v,i) => { const td=document.createElement('td'); td.setAttribute('data-label', headers[i]); td.textContent=v==null?'':String(v); tr.appendChild(td); });
      const tdAcc = document.createElement('td');
      tdAcc.className = 'actions-cell'; tdAcc.setAttribute('data-label','Acciones');
      const btn = document.createElement('button');
      btn.textContent = 'Ver detalle';
      btn.addEventListener('click', () => verDetalleProyecto(p.idProyecto, p.Proyecto));
      tdAcc.appendChild(btn); tr.appendChild(tdAcc);
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML = ''; cont.appendChild(tabla);
  } catch (e) {
    cont.innerHTML = `<div style="color:salmon; padding:1rem;">${e.message}</div>`;
  }
}

async function verDetalleProyecto(idProyecto, nombre) {
  const panel = document.getElementById('panelProyecto');
  document.getElementById('tituloProyecto').textContent = `Proyecto: ${nombre}`;
  panel.style.display = '';
  const listaEmpleados = document.getElementById('listaEmpleados');
  const listaTareas = document.getElementById('listaTareas');
  listaEmpleados.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  listaTareas.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const data = await api(`/api/cliente/proyectos/${encodeURIComponent(idProyecto)}/empleados`);
    const empleados = data.empleados || [];
    const tareas = data.tareas || [];

    if (!empleados.length) {
      listaEmpleados.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin personal</div>';
    } else {
      const tabla = document.createElement('table');
      tabla.className = 'data-table';
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      const headersEmp = [' ', 'ID','Foto','Nombre','Especialidad','Asistencia'];
      headersEmp.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
      thead.appendChild(trh);
      const tbody = document.createElement('tbody');
      empleados.forEach(e => {
        const tr = document.createElement('tr');
        const tdId = document.createElement('td'); tdId.setAttribute('data-label', headersEmp[0]); tdId.textContent = e.idEmpleado ?? e.id ?? e.ID ?? e.Id ?? '—'; tr.appendChild(tdId);
        const tdFoto = document.createElement('td'); tdFoto.setAttribute('data-label', headersEmp[1]);
        if (e.foto_url) { const img=document.createElement('img'); img.src=e.foto_url; img.alt='foto'; img.style.maxWidth='56px'; img.style.borderRadius='6px'; img.style.border='1px solid var(--border-light)'; tdFoto.appendChild(img); }
        else { tdFoto.textContent='—'; }
        tr.appendChild(tdFoto);
        const tdNom = document.createElement('td'); tdNom.setAttribute('data-label', headersEmp[2]); tdNom.textContent = e.Nombre || ''; tr.appendChild(tdNom);
        const tdEsp = document.createElement('td'); tdEsp.setAttribute('data-label', headersEmp[3]); tdEsp.textContent = e.Especialidad || '—'; tr.appendChild(tdEsp);
        const tdAsis = document.createElement('td'); tdAsis.setAttribute('data-label', headersEmp[4]); tdAsis.textContent = e.Asistencia || '—'; tr.appendChild(tdAsis);
        tbody.appendChild(tr);
      });
      tabla.appendChild(thead); tabla.appendChild(tbody);
      listaEmpleados.innerHTML=''; listaEmpleados.appendChild(tabla);
    }

    if (!tareas.length) {
      listaTareas.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin tareas</div>';
    } else {
      const tabla = document.createElement('table');
      tabla.className = 'data-table';
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      const headersTar = [' ', 'ID','Descripción','Estado','Asignado a'];
      headersTar.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
      thead.appendChild(trh);
      const tbody = document.createElement('tbody');
      const mapEmp = new Map(empleados.map(e => [e.idEmpleado, e.Nombre]));
      tareas.forEach(t => {
        const tr = document.createElement('tr');
        [t.idTarea, t.Descripcion, t.Estado, mapEmp.get(t.idEmpleado) || '—'].forEach((v,i) => { const td=document.createElement('td'); td.setAttribute('data-label', headersTar[i]); td.textContent=v==null?'':String(v); tr.appendChild(td); });
        tbody.appendChild(tr);
      });
      tabla.appendChild(thead); tabla.appendChild(tbody);
      listaTareas.innerHTML=''; listaTareas.appendChild(tabla);
    }
  } catch (e) {
    listaEmpleados.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
    listaTareas.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

async function cargarFacturas() {
  const cont = document.getElementById('listaFacturasCli');
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const lista = await api('/api/cliente/facturas');
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin facturas</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = [' ','ID','Fecha','Proyecto','Total','PDF'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(f => {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.setAttribute('data-label', headers[0]); tdId.textContent = f.idFactura; tr.appendChild(tdId);
      const tdFecha = document.createElement('td'); tdFecha.setAttribute('data-label', headers[1]); tdFecha.textContent = f.Fecha; tr.appendChild(tdFecha);
      const tdProyecto = document.createElement('td'); tdProyecto.setAttribute('data-label', headers[2]); tdProyecto.textContent = f.Proyecto || '—'; tr.appendChild(tdProyecto);
      const tdTotal = document.createElement('td'); tdTotal.setAttribute('data-label', headers[3]); tdTotal.textContent = `$ ${Number(f.Valor_total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`; tr.appendChild(tdTotal);
      const tdPdf = document.createElement('td'); tdPdf.setAttribute('data-label', headers[4]); tdPdf.className='actions-cell';
      const btn = document.createElement('button'); btn.textContent = 'Ver PDF'; btn.addEventListener('click', () => verPDFCliente(f.idFactura));
      tdPdf.appendChild(btn); tr.appendChild(tdPdf);
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML = ''; cont.appendChild(tabla);
  } catch (e) {
    cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

async function verPDFCliente(id) {
  const url = `${baseAPI}/api/cliente/facturas/${encodeURIComponent(id)}/pdf`;
  try {
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) {
      let msg = `Error ${resp.status}`;
      try { const j = await resp.json(); if (j && j.error) msg = j.error; } catch {}
      alert(`No se pudo cargar el PDF: ${msg}`);
      return;
    }
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win) { const a = document.createElement('a'); a.href = blobUrl; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 60_000);
  } catch (e) {
    const win = window.open(url, '_blank');
    if (!win) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
  }
}

async function cargarPagos() {
  const cont = document.getElementById('listaPagosCli');
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const lista = await api('/api/cliente/pagos');
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin pagos</div>'; return; }
    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const headers = ['ID','Fecha','Factura','Monto'];
    headers.forEach(h => { const th=document.createElement('th'); th.textContent=h; th.scope='col'; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(p => {
      const tr = document.createElement('tr');
      [p.idPago, p.Fecha, p.idFactura, `$ ${Number(p.Monto).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`].forEach((v,i) => { const td=document.createElement('td'); td.setAttribute('data-label', headers[i]); td.textContent=String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML = ''; cont.appendChild(tabla);
  } catch (e) {
    cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

const btnSalirCli = document.getElementById('btnSalirCli');
if (btnSalirCli) {
  btnSalirCli.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    window.location.href = '/';
  });
}

verificarSesionCliente();

// ===================== Enrolamiento facial (Cliente) =====================
let modelosCargadosCli = false;
let cargandoModeloCli = false;
let streamCli = null;

async function cargarModelosFaceCli() {
  if (modelosCargadosCli || cargandoModeloCli) return;
  cargandoModeloCli = true;
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
    await Promise.all(reqs.map(u => fetch(u, { method:'HEAD', cache:'no-store' })));
    await faceapi.nets.tinyFaceDetector.loadFromUri(baseLocal);
    try { await faceapi.nets.faceLandmark68Net.loadFromUri(baseLocal); }
    catch { await faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseLocal); }
    await faceapi.nets.faceRecognitionNet.loadFromUri(baseLocal);
    modelosCargadosCli = true;
  } finally {
    cargandoModeloCli = false;
  }
}

function prepararSelfEnrollmentCliente(yaTiene) {
  const btn = document.getElementById('btnEnrollFaceCli');
  const btnInit = document.getElementById('btnInitCamCli');
  const btnCap = document.getElementById('btnCaptureFaceCli');
  const btnCerrar = document.getElementById('btnCerrarFaceCli');
  const area = document.getElementById('faceAreaCli');
  const video = document.getElementById('faceVideoCli');
  const msg = document.getElementById('msgFaceCli');
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
    if (streamCli) { streamCli.getTracks().forEach(t => t.stop()); streamCli = null; }
  });
  btnInit.addEventListener('click', async () => {
    try {
      msg.style.color=''; msg.textContent='Cargando modelos...';
      await cargarModelosFaceCli();
      msg.textContent='Activando cámara...';
      streamCli = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      video.srcObject = streamCli;
      btnCap.disabled = false;
      msg.textContent='Cámara lista';
    } catch (e) {
      msg.style.color='salmon'; msg.textContent=e.message;
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
      const descriptor = Array.from(det.descriptor);
      msg.textContent='Guardando...';
      await api('/api/users/me/face', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ descriptor }) });
      msg.textContent='Rostro registrado. Ya puedes usar login facial.';
    } catch (e) {
      msg.style.color='salmon'; msg.textContent=e.message;
    }
  });
}
