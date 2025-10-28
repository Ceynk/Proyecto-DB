const listaEntidadesEl = document.getElementById('entidades');
const tituloEl = document.getElementById('titulo');
const buscarEl = document.getElementById('buscar');
const contenedorTabla = document.getElementById('tableWrap');
const contenedorFormulario = document.getElementById('formWrap');
const formularioDinamico = document.getElementById('dynForm');
const tituloFormulario = document.getElementById('formTitle');
const mensajeFormulario = document.getElementById('formMsg');
const botonMenuMovil = document.getElementById('mobileMenuBtn');
const barraLateral = document.getElementById('sidebar');
const botonActualizar = document.getElementById('refreshBtn');


// en index.html o guarda una clave `API_BASE` en localStorage con la URL del backend en Railway.
const apiBase = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';

const entidades = [
  'empleado', 'cliente', 'proyecto', 'apartamento', 'material',
  'inventario', 'ingreso', 'gasto', 'pago', 'tarea', 'turno', 'factura'
];

let actual = 'empleado';
let ultimoAbortCtrl = null;

// Mobile menu toggle
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
    const btn = crear('button', nombre === actual ? 'active' : '', nombre.charAt(0).toUpperCase() + nombre.slice(1));
    btn.addEventListener('click', () => {
      actual = nombre;
      renderizarBarraLateral();
      tituloEl.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1);
      buscarEl.value = '';
      cargarDatos();
      construirFormulario();
    });
    listaEntidadesEl.appendChild(btn);
  });
}

function renderizarTabla(filas) {
  contenedorTabla.innerHTML = '';
  if (!filas || filas.length === 0) {
    contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos para mostrar</div>';
    return;
  }
  const tabla = crear('table');
  const thead = crear('thead');
  const htr = crear('tr');
  const encabezados = Object.keys(filas[0]);
  encabezados.forEach((h) => htr.appendChild(crear('th', '', h)));
  thead.appendChild(htr);
  const tbody = crear('tbody');
  filas.forEach((r) => {
    const tr = crear('tr');
    encabezados.forEach((h) => {
      const td = crear('td');
      td.textContent = r[h] == null ? '' : String(r[h]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tabla.appendChild(thead);
  tabla.appendChild(tbody);
  contenedorTabla.appendChild(tabla);
}

async function cargarDatos() {
  const q = buscarEl.value.trim();
  const url = q ? `/api/list/${actual}?q=${encodeURIComponent(q)}` : `/api/list/${actual}`;
  contenedorTabla.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando...</div>';
  try {
    if (ultimoAbortCtrl) ultimoAbortCtrl.abort();
    const ctrl = new AbortController();
    ultimoAbortCtrl = ctrl;
    const resp = await fetch(`${apiBase}${url}`, { signal: ctrl.signal });
    const tipoContenido = resp.headers.get('content-type') || '';
    if (!tipoContenido.includes('application/json')) {
      const txt = await resp.text();
      throw new Error(`Respuesta no JSON (${resp.status}): ${txt.substring(0, 120)}...`);
    }
    const datos = await resp.json();
    if (!resp.ok) throw new Error(datos.error || 'Error');
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

renderizarBarraLateral();
cargarDatos();
construirFormulario();

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
    { name: 'estado', type: 'select', options: ['Activo','Inactivo'] },
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
    { name: 'Asistencia', type: 'select', options: ['Si','No'] },
    { name: 'Especialidad', type: 'select', options: ['Activo','Inactivo'] },
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
    { name: 'Estado', type: 'select', options: ['Activo','Inactivo'] },
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
  tituloFormulario.textContent = actual.charAt(0).toUpperCase() + actual.slice(1);
  formularioDinamico.innerHTML = '';
  mensajeFormulario.textContent = '';
  const campos = camposFormulario[actual] || [];
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
          const resp = await fetch(`${apiBase}${f.source}`);
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
  });
  try {
    const resp = await fetch(`${apiBase}/api/create/${actual}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const cuerpo = await resp.json();
    if (!resp.ok) throw new Error(cuerpo.error || 'Error al guardar');
    mensajeFormulario.textContent = 'Guardado con id ' + cuerpo.id;
    formularioDinamico.reset();
    cargarDatos();
  } catch (e) {
    mensajeFormulario.style.color = 'salmon';
    mensajeFormulario.textContent = 'Error: ' + e.message;
  }
});
