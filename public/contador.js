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
    if (usuarioActual.rol !== 'Contador' && usuarioActual.rol !== 'Administrador') {
      window.location.href = '/';
      return;
    }
    await cargarListasMinimas();
    await cargarInventario();
    await cargarFacturas();
  } catch (_) {
    window.location.href = '/';
  }
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
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  const q = (document.getElementById('buscarInv').value || '').trim();
  try {
    const lista = await api(`/api/contador/inventario${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin registros</div>'; return; }
    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['ID','Tipo','Cantidad','Fecha','Material','Proyecto'].forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(i => {
      const tr = document.createElement('tr');
      [i.idInventario, i.tipo_movimiento, i.cantidad, i.fecha, i.Material, i.Proyecto || '—'].forEach(v => { const td = document.createElement('td'); td.textContent = v==null?'':String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML=''; cont.appendChild(tabla);
  } catch (e) {
    cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
}

async function cargarFacturas() {
  const cont = document.getElementById('listaFacturas');
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const lista = await api('/api/contador/facturas');
    if (!lista.length) { cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin facturas</div>'; return; }
    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['ID','Fecha','Cliente','Proyecto','Total','PDF'].forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    lista.forEach(f => {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.textContent = f.idFactura; tr.appendChild(tdId);
      const tdFecha = document.createElement('td'); tdFecha.textContent = f.Fecha; tr.appendChild(tdFecha);
      const tdCliente = document.createElement('td'); tdCliente.textContent = f.Cliente || '—'; tr.appendChild(tdCliente);
      const tdProyecto = document.createElement('td'); tdProyecto.textContent = f.Proyecto || '—'; tr.appendChild(tdProyecto);
      const tdTotal = document.createElement('td'); tdTotal.textContent = `$ ${Number(f.Valor_total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`; tr.appendChild(tdTotal);
      const tdPdf = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'Descargar PDF';
      btn.addEventListener('click', () => descargarPDF(f.idFactura));
      tdPdf.appendChild(btn); tr.appendChild(tdPdf);
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML=''; cont.appendChild(tabla);
  } catch (e) {
    cont.innerHTML = `<div style=\"color:salmon; padding:1rem;\">${e.message}</div>`;
  }
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
