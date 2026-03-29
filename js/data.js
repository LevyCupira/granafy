// ════════════════════════════════════════════════════
// DATA.JS — Estado global e persistência (localStorage)
// ════════════════════════════════════════════════════

var data = {};
var activeClient = null;
var activeTab = 'cartao';

function loadData() {
  try { data = JSON.parse(localStorage.getItem('fb_data')) || { clients: {} }; }
  catch { data = { clients: {} }; }
}

function saveData() {
  localStorage.setItem('fb_data', JSON.stringify(data));
}

// ── Motor de abas móveis ──
var TAB_DEFS = [
  { key: 'cartao',   label: '💳 Cartão de Crédito' },
  { key: 'dividas',  label: '📋 Empréstimo e Renegociação' },
  { key: 'extrato',  label: '🏦 Conta Corrente' },
  { key: 'resumo',   label: '📊 Receita & Despesas' },
  { key: 'dre',      label: '📑 DRE' },
  { key: 'graficos', label: '📈 Gráficos' }
];

function getTabOrder() {
  try {
    const sv = JSON.parse(localStorage.getItem('fb_tab_order')); if (!sv) return TAB_DEFS;
    const map = Object.fromEntries(TAB_DEFS.map(t => [t.key, t]));
    const ord = sv.filter(k => map[k]).map(k => map[k]);
    TAB_DEFS.forEach(t => { if (!sv.includes(t.key)) ord.push(t); });
    return ord;
  } catch { return TAB_DEFS; }
}

function renderTabs() {
  const box = document.getElementById('tabsContainer'); box.innerHTML = '';
  let src = null;
  getTabOrder().forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (tab.key === activeTab ? ' active' : '');
    btn.textContent = tab.label; btn.draggable = true; btn.dataset.tabKey = tab.key;
    btn.addEventListener('click', () => switchTab(tab.key));
    btn.addEventListener('dragstart', e => { src = tab.key; btn.classList.add('tab-dragging'); e.dataTransfer.effectAllowed = 'move'; });
    btn.addEventListener('dragend',   () => { btn.classList.remove('tab-dragging'); box.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-drag-over')); });
    btn.addEventListener('dragover',  e => { e.preventDefault(); box.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-drag-over')); if (tab.key !== src) btn.classList.add('tab-drag-over'); });
    btn.addEventListener('dragleave', () => btn.classList.remove('tab-drag-over'));
    btn.addEventListener('drop', e => {
      e.preventDefault(); btn.classList.remove('tab-drag-over');
      if (!src || src === tab.key) return;
      const ord = getTabOrder().map(t => t.key);
      const fi = ord.indexOf(src), ti = ord.indexOf(tab.key); if (fi < 0 || ti < 0) return;
      ord.splice(fi, 1); ord.splice(ti, 0, src);
      localStorage.setItem('fb_tab_order', JSON.stringify(ord)); renderTabs();
    });
    box.appendChild(btn);
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#tabsContainer .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tabKey === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderTab(tab);
}

function renderTab(tab) {
  if (!activeClient) return;
  if (tab === 'cartao')   renderCartao();
  if (tab === 'dividas')  renderDividas();
  if (tab === 'extrato')  renderExtrato();
  if (tab === 'resumo')   renderResumo();
  if (tab === 'dre')      renderDRE();
  if (tab === 'graficos') renderGraficos();
}

// ── Inicialização ──
(function init() {
  const savedTheme = localStorage.getItem('fb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  loadData();
  renderTabs();
  renderClientList();
  const saved = localStorage.getItem('fb_activeClient');
  if (saved && data.clients[saved]) selectClient(saved);
  document.addEventListener('click', e => {
    const wrap = document.getElementById('clientDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('clientDropdownMenu').classList.remove('open');
      document.getElementById('clientDropdownToggle').classList.remove('open');
    }
  });
  document.getElementById('newClientName').addEventListener('keydown', e => { if (e.key === 'Enter') addClient(); });
})();
