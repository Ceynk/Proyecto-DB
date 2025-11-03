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
  try {
    const me = await api('/api/auth/me');
    usuarioActual = me.user;
    if (!usuarioActual) throw new Error('No autenticado');
    if (usuarioActual.rol !== 'Empleado' && usuarioActual.rol !== 'Administrador') {
      window.location.href = '/';
      return;
    }
    cargarInfo();
    cargarTareas();
  } catch (_) {
    window.location.href = '/';
  }
}

async function cargarInfo() {
  const cont = document.getElementById('infoEmpleado');
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const info = await api('/api/empleado/mis-datos');
    cont.innerHTML = `
      <div style="padding:.5rem 1rem;">
        <div><strong>Nombre:</strong> ${info.Nombre || ''}</div>
        <div><strong>Correo:</strong> ${info.Correo || ''}</div>
        <div><strong>Teléfono:</strong> ${info.Telefono || ''}</div>
        <div><strong>Proyecto:</strong> ${info.Proyecto || '—'}</div>
        <div><strong>Asistencia:</strong> ${info.Asistencia || '—'}</div>
      </div>`;
  } catch (e) {
    cont.innerHTML = `<div style="color:salmon; padding:1rem;">${e.message}</div>`;
  }
}

async function cargarTareas() {
  const cont = document.getElementById('listaTareas');
  cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Cargando...</div>';
  try {
    const tareas = await api('/api/empleado/mis-tareas');
    if (!tareas.length) {
      cont.innerHTML = '<div style="padding:1rem; color: var(--text-muted);">Sin tareas</div>';
      return;
    }
    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['ID','Descripción','Estado','Proyecto'].forEach(t => { const th = document.createElement('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    tareas.forEach(t => {
      const tr = document.createElement('tr');
      const c = [t.idTarea, t.Descripcion, t.Estado, t.Proyecto||'—'];
      c.forEach(v => { const td = document.createElement('td'); td.textContent = v==null?'':String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabla.appendChild(thead); tabla.appendChild(tbody);
    cont.innerHTML = ''; cont.appendChild(tabla);
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
