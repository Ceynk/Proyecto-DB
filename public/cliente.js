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
  try {
    const me = await api('/api/auth/me');
    usuarioActual = me.user;
    if (!usuarioActual || usuarioActual.rol !== 'Cliente') throw new Error('No autorizado');
    await cargarProyectos();
    await cargarFacturas();
    await cargarPagos();
  } catch (_) {
    window.location.href = '/';
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
    const headers = ['ID','Proyecto','Empleados','Tareas','Facturas','Acciones'];
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
      const headersEmp = ['ID','Foto','Nombre','Especialidad','Asistencia'];
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
      const headersTar = ['ID','Descripción','Estado','Asignado a'];
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
    const headers = ['ID','Fecha','Proyecto','Total','PDF'];
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
  const win = window.open(url, '_blank');
  if (!win) { const a = document.createElement('a'); a.href=url; a.target='_blank'; a.click(); }
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
