(function(){
  function fmtNumber(n){ try { return new Intl.NumberFormat('es-CO').format(Number(n||0)); } catch { return String(n||0); } }
  function fmtMoney(v){ if(v==null||v==='') return ''; try { return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP'}).format(Number(v)); } catch { return '$'+Number(v).toFixed(2);} }
  function isDateLike(v){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v); }

  function defaultCell(td, value, col){
    if(value==null) { td.textContent=''; return; }
    if(col && (col.type==='money'||/valor|total|monto/i.test(col.header||''))) { td.textContent = fmtMoney(value); return; }
    if(col && (col.type==='number')) { td.textContent = fmtNumber(value); return; }
    if(col && (col.type==='date' || isDateLike(value))) { td.textContent = String(value).slice(0,10); return; }
    td.textContent = String(value);
    try { td.title = String(value); } catch(_){}
  }

  function imageCell(td, src){
    const img = document.createElement('img');
    img.className = 'tbl-img';
    img.alt = 'imagen';
    img.loading = 'lazy';
    img.onerror = function(){ this.src = '/default-user.svg'; };
    img.src = typeof src==='string' && src ? src : '/default-user.svg';
    td.appendChild(img);
  }

  function normalizeColumns(rows, columns){
    if(Array.isArray(columns) && columns.length) return columns.map(c => ({
      key: c.key || c.clave || c.name,
      header: c.header || c.titulo || c.label || c.key || c.clave || '',
      type: c.type || c.tipo || 'text',
      render: c.render || null
    }));
    const first = Array.isArray(rows) && rows[0] ? rows[0] : {};
    return Object.keys(first).map(k => ({ key:k, header:k, type: 'text' }));
  }

  function renderTable(container, columns, rows, options={}){
    const cont = (typeof container==='string') ? document.querySelector(container) : container;
    if(!cont) return;
    cont.innerHTML = '';

    const data = Array.isArray(rows) ? rows : [];
    const cols = normalizeColumns(data, columns);

    if(!data.length){
      const empty = document.createElement('div');
      empty.className = 'table-empty';
      empty.textContent = options.emptyText || 'Sin datos para mostrar';
      cont.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    cols.forEach(c => { const th=document.createElement('th'); th.scope='col'; th.textContent = c.header || ''; trh.appendChild(th); });
    if(options.rowActions && options.rowActions.length){ const th = document.createElement('th'); th.textContent = options.actionsHeader || 'Acciones'; trh.appendChild(th); }
    thead.appendChild(trh);

    const tbody = document.createElement('tbody');
    data.forEach((row)=>{
      const tr = document.createElement('tr');
      cols.forEach((c)=>{
        const td = document.createElement('td');
        if (c && c.header) td.setAttribute('data-label', c.header);
        const value = row[c.key];
        if(typeof c.render === 'function') {
          c.render(td, value, row, c);
        } else if ((c.type||'').toLowerCase()==='image' || /foto|imagen/i.test(c.header||c.key)) {
          imageCell(td, value);
        } else {
          defaultCell(td, value, c);
        }
        tr.appendChild(td);
      });
      if(options.rowActions && options.rowActions.length){
        const td = document.createElement('td'); td.className='actions-cell';
        options.rowActions.forEach((act)=>{
          const btn = document.createElement('button');
          btn.type='button'; btn.className = act.className || 'btn-table-action';
          btn.textContent = act.label || 'Acción';
          btn.addEventListener('click', () => act.onClick && act.onClick(row));
          td.appendChild(btn);
        });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });

    table.appendChild(thead); table.appendChild(tbody);
    cont.appendChild(table);
  }

  window.renderTable = renderTable;
})();
