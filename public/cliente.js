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
  cont.innerHTML = '<div class="table-empty">Cargando...</div>';
  try {
    const lista = await api('/api/cliente/proyectos');
    if (!lista.length) { cont.innerHTML = '<div class="table-empty">Sin proyectos</div>'; return; }
    renderTable(cont, [
      { key:'idProyecto', header:'ID' },
      { key:'Proyecto', header:'Proyecto' },
      { key:'Empleados', header:'Empleados' },
      { key:'Tareas', header:'Tareas' },
      { key:'Facturas', header:'Facturas' }
    ], lista, {
      rowActions: [{ label:'Ver detalle', onClick: (row) => verDetalleProyecto(row.idProyecto, row.Proyecto) }]
    });
  } catch(e){
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
      listaEmpleados.innerHTML = '<div class="table-empty">Sin personal</div>';
    } else {
      renderTable(listaEmpleados, [
        { key:'idEmpleado', header:'ID' },
        { key:'foto_url', header:'Foto', type:'image' },
        { key:'Nombre', header:'Nombre' },
        { key:'Especialidad', header:'Especialidad' },
        { key:'Asistencia', header:'Asistencia' }
      ], empleados);
    }

    if (!tareas.length) {
      listaTareas.innerHTML = '<div class="table-empty">Sin tareas</div>';
    } else {
      const mapEmp = new Map(empleados.map(e => [e.idEmpleado, e.Nombre]));
      const enriquecidas = tareas.map(t => ({ ...t, Asignado: mapEmp.get(t.idEmpleado) || '—' }));
      renderTable(listaTareas, [
        { key:'idTarea', header:'ID' },
        { key:'Descripcion', header:'Descripción' },
        { key:'Estado', header:'Estado' },
        { key:'Asignado', header:'Asignado a' }
      ], enriquecidas);
    }
  } catch (e) {
    listaEmpleados.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
    listaTareas.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

async function cargarFacturas() {
  const cont = document.getElementById('listaFacturasCli');
  cont.innerHTML = '<div class="table-empty">Cargando...</div>';
  try {
    const lista = await api('/api/cliente/facturas');
    if (!lista.length) { cont.innerHTML = '<div class="table-empty">Sin facturas</div>'; return; }
    renderTable(cont, [
      { key:'idFactura', header:'ID' },
      { key:'Fecha', header:'Fecha', type:'date' },
      { key:'Proyecto', header:'Proyecto' },
      { key:'Valor_total', header:'Total', type:'money' }
    ], lista, {
      rowActions: [{ label:'Ver PDF', onClick: (row) => verPDFCliente(row.idFactura) }]
    });
  } catch(e){ cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`; }
}

async function verPDFCliente(id) {
  const url = `${baseAPI}/api/cliente/facturas/${encodeURIComponent(id)}/pdf`;
  const win = window.open(url, '_blank');
  if (!win) { const a = document.createElement('a'); a.href=url; a.target='_blank'; a.click(); }
}

async function cargarPagos() {
  const cont = document.getElementById('listaPagosCli');
  cont.innerHTML = '<div class="table-empty">Cargando...</div>';
  try {
    const lista = await api('/api/cliente/pagos');
    if (!lista.length) { cont.innerHTML = '<div class="table-empty">Sin pagos</div>'; return; }
    const enriquecidos = lista.map(p => ({ ...p, Monto: p.Monto }));
    renderTable(cont, [
      { key:'idPago', header:'ID' },
      { key:'Fecha', header:'Fecha', type:'date' },
      { key:'idFactura', header:'Factura' },
      { key:'Monto', header:'Monto', type:'money' }
    ], enriquecidos);
  } catch(e){ cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`; }
}

const btnSalirCli = document.getElementById('btnSalirCli');
if (btnSalirCli) {
  btnSalirCli.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    window.location.href = '/';
  });
}

verificarSesionCliente();
