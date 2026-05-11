// ════════════════════════════════════════════════════
// UTILS.JS — Funções utilitárias globais
// Carregado primeiro: todas as outras dependem deste
// ════════════════════════════════════════════════════

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(n) {
  return String(n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Máscara de moeda (estilo banco) ──
// Digitar "1" → "0,01" | "123" → "1,23"
function applyMoneyMask(el) {
  let digits = el.value.replace(/\D/g, '');
  if (!digits) { el.value = ''; el.dataset.cents = '0'; return; }
  if (digits.length > 12) digits = digits.slice(-12);
  const cents = parseInt(digits, 10);
  el.dataset.cents = String(cents);
  el.value = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(el) {
  if (el && el.dataset && el.dataset.cents !== undefined) return parseInt(el.dataset.cents, 10) / 100;
  return parseFloat(String((el && el.value) || 0).replace(/\./g, '').replace(',', '.')) || 0;
}

function initMoneyInputs(scope) {
  (scope || document).querySelectorAll('.money-input').forEach(el => {
    if (!el.dataset.cents) el.dataset.cents = '0';
    el.removeEventListener('input', el._moneyHandler);
    el._moneyHandler = () => applyMoneyMask(el);
    el.addEventListener('input', el._moneyHandler);
    el.addEventListener('focus', () => { if (!el.value || el.value === '0,00') el.value = ''; });
    el.addEventListener('blur',  () => { if (!el.value) { el.value = '0,00'; el.dataset.cents = '0'; } });
  });
}

// ── Motor de colunas móveis (drag & drop nas tabelas) ──
function applySidebarMenuState(minimized) {
  var sidebar = document.getElementById('appSidebar');
  var btn = document.getElementById('sidebarToggle');
  if (!sidebar || !btn) return;

  sidebar.classList.toggle('minimized', !!minimized);
  btn.textContent = minimized ? '☰' : 'Recolher';
  btn.title = minimized ? 'Abrir menu' : 'Minimizar menu';
  btn.setAttribute('aria-expanded', minimized ? 'false' : 'true');
}

function toggleSidebarMenu() {
  var sidebar = document.getElementById('appSidebar');
  if (!sidebar) return;

  var minimized = !sidebar.classList.contains('minimized');
  try { localStorage.setItem('granafy_sidebar_minimized', minimized ? '1' : '0'); } catch (e) {}
  applySidebarMenuState(minimized);
}

document.addEventListener('DOMContentLoaded', function() {
  var minimized = true;
  try {
    var saved = localStorage.getItem('granafy_sidebar_minimized');
    minimized = saved === null ? true : saved === '1';
  } catch (e) {}
  applySidebarMenuState(minimized);
});

var deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  var btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = '';
});

window.addEventListener('appinstalled', function() {
  deferredInstallPrompt = null;
  var btn = document.getElementById('installAppBtn');
  if (btn) btn.textContent = 'App instalado';
});

async function installGranafyApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }

  alert('Para instalar como atalho, use o menu do navegador e escolha "Instalar app" ou "Adicionar a tela inicial".');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').catch(function(error) {
      console.warn('Service worker nao registrado:', error);
    });
  });
}

var nativeAlert = window.alert ? window.alert.bind(window) : null;

function appDialogEnsure() {
  var existing = document.getElementById('appDialogOverlay');
  if (existing) return existing;

  var overlay = document.createElement('div');
  overlay.id = 'appDialogOverlay';
  overlay.className = 'app-dialog-overlay';
  overlay.innerHTML =
    '<div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">' +
    '<div class="app-dialog-title" id="appDialogTitle">Granafy</div>' +
    '<div class="app-dialog-message" id="appDialogMessage"></div>' +
    '<div class="app-dialog-actions" id="appDialogActions"></div>' +
    '</div>';

  document.body.appendChild(overlay);
  return overlay;
}

function appDialogMessageHtml(message) {
  return esc(message).replace(/\n/g, '<br>');
}

function appAlert(message, title) {
  return new Promise(resolve => {
    if (!document.body) {
      if (nativeAlert) nativeAlert(message);
      resolve();
      return;
    }

    var overlay = appDialogEnsure();
    var titleEl = document.getElementById('appDialogTitle');
    var messageEl = document.getElementById('appDialogMessage');
    var actionsEl = document.getElementById('appDialogActions');

    titleEl.textContent = title || 'Granafy';
    messageEl.innerHTML = appDialogMessageHtml(message || '');
    actionsEl.innerHTML = '<button class="app-dialog-btn primary" type="button">OK</button>';

    var ok = actionsEl.querySelector('button');
    var close = function() {
      overlay.classList.remove('open');
      ok.removeEventListener('click', close);
      resolve();
    };

    ok.addEventListener('click', close);
    overlay.classList.add('open');
    setTimeout(() => ok.focus(), 0);
  });
}

function appConfirm(message, options) {
  options = options || {};
  return new Promise(resolve => {
    if (!document.body) {
      resolve(window.confirm ? window.confirm(message) : false);
      return;
    }

    var overlay = appDialogEnsure();
    var titleEl = document.getElementById('appDialogTitle');
    var messageEl = document.getElementById('appDialogMessage');
    var actionsEl = document.getElementById('appDialogActions');

    titleEl.textContent = options.title || 'Confirmar';
    messageEl.innerHTML = appDialogMessageHtml(message || '');
    actionsEl.innerHTML =
      '<button class="app-dialog-btn ghost" type="button" data-result="0">' + esc(options.cancelText || 'Cancelar') + '</button>' +
      '<button class="app-dialog-btn primary" type="button" data-result="1">' + esc(options.confirmText || 'Confirmar') + '</button>';

    var buttons = Array.from(actionsEl.querySelectorAll('button'));
    var done = function(value) {
      overlay.classList.remove('open');
      buttons.forEach(btn => btn.removeEventListener('click', onClick));
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    var onClick = function(event) {
      done(event.currentTarget.dataset.result === '1');
    };
    var onKey = function(event) {
      if (event.key === 'Escape') done(false);
    };

    buttons.forEach(btn => btn.addEventListener('click', onClick));
    document.addEventListener('keydown', onKey);
    overlay.classList.add('open');
    setTimeout(() => buttons[1].focus(), 0);
  });
}

window.alert = function(message) {
  appAlert(message);
};

var colOrders = (function() {
  try { return JSON.parse(localStorage.getItem('fb_col_orders')) || {}; } catch { return {}; }
})();

function saveColOrders() {
  localStorage.setItem('fb_col_orders', JSON.stringify(colOrders));
}

function getColOrder(key, defs) {
  const sv = colOrders[key]; if (!sv) return defs;
  const map = Object.fromEntries(defs.map(c => [c.key, c]));
  const ord = sv.filter(k => map[k]).map(k => map[k]);
  defs.forEach(c => { if (!sv.includes(c.key)) ord.push(c); });
  return ord;
}

function buildTable(tKey, cols, rows, rowFn, rowCls) {
  const heads = cols.map(c => {
    const d = c.key === '_del' ? '' : 'draggable="true"';
    const h = c.key === '_del' ? '' : '<span class="drag-handle">⠿</span>';
    return '<th data-key="' + c.key + '" ' + d + '>' + h + c.label + '</th>';
  }).join('');
  const body = rows.map((r, i) => {
    const cls = rowCls ? rowCls(r) : '';
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + rowFn(r, i) + '</tr>';
  }).join('');
  return '<table class="data-table" id="tbl-' + tKey + '"><thead><tr>' + heads + '</tr></thead><tbody>'
    + (body || '<tr><td colspan="' + cols.length + '" style="text-align:center;color:var(--muted);padding:18px">Nenhum registro.</td></tr>')
    + '</tbody></table>';
}

function initDrag(tKey, defs, rerender) {
  const tbl = document.getElementById('tbl-' + tKey); if (!tbl) return;
  let src = null;
  tbl.querySelectorAll('th[draggable]').forEach(th => {
    th.addEventListener('dragstart', e => { src = th.dataset.key; th.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    th.addEventListener('dragend',   () => { th.classList.remove('dragging'); tbl.querySelectorAll('th').forEach(t => t.classList.remove('drag-over')); });
    th.addEventListener('dragover',  e => { e.preventDefault(); tbl.querySelectorAll('th').forEach(t => t.classList.remove('drag-over')); if (th.dataset.key !== src) th.classList.add('drag-over'); });
    th.addEventListener('dragleave', () => th.classList.remove('drag-over'));
    th.addEventListener('drop', e => {
      e.preventDefault(); th.classList.remove('drag-over');
      const dst = th.dataset.key; if (!src || src === dst) return;
      const ks = getColOrder(tKey, defs).map(c => c.key);
      const fi = ks.indexOf(src), ti = ks.indexOf(dst); if (fi < 0 || ti < 0) return;
      ks.splice(fi, 1); ks.splice(ti, 0, src);
      colOrders[tKey] = ks; saveColOrders(); rerender();
    });
  });
}
