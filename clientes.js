// ════════════════════════════════════════════════════
// CLIENTES.JS — CRUD de clientes e dropdown
// ════════════════════════════════════════════════════

var _ccFiltro  = new Set();
var _dvHistOpen = new Set();

function addClient() {
  const inp = document.getElementById('newClientName'), name = inp.value.trim();
  if (!name) return alert('Digite o nome do cliente.');
  const id = uid();
  data.clients[id] = { name, cartoes: [], cartao: [], dividas: [], extrato: [], contas: [] };
  saveData(); inp.value = ''; renderClientList(); selectClient(id);
}

function renderClientList() {
  const menu = document.getElementById('clientDropdownMenu');
  const entries = Object.entries(data.clients);
  menu.innerHTML = entries.length === 0
    ? '<div class="client-dropdown-empty">Nenhum cliente cadastrado.</div>'
    : entries.map(([id, c]) =>
        '<div class="client-dropdown-item ' + (id === activeClient ? 'active' : '') + '" style="justify-content:space-between">'
        + '<button style="background:none;border:none;color:inherit;font-family:inherit;font-size:inherit;font-weight:inherit;cursor:pointer;display:flex;align-items:center;gap:7px;flex:1;text-align:left;padding:0" onclick="selectClient(\'' + id + '\')">'
        + '<div class="avatar">' + initials(c.name) + '</div>' + esc(c.name)
        + '</button>'
        + '<button style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.75rem;flex-shrink:0" '
        + 'onmouseover="this.style.color=\'var(--danger)\';this.style.background=\'rgba(255,107,107,.12)\'" '
        + 'onmouseout="this.style.color=\'var(--muted)\';this.style.background=\'none\'" '
        + 'onclick="deleteClient(\'' + id + '\')" title="Excluir cliente">🗑</button>'
        + '</div>'
      ).join('');

  const av = document.getElementById('toggleAvatar'), lbl = document.getElementById('toggleLabel');
  if (activeClient && data.clients[activeClient]) {
    lbl.textContent = data.clients[activeClient].name;
    av.textContent  = initials(data.clients[activeClient].name);
    av.style.display = 'flex';
  } else {
    lbl.textContent = 'Selecionar cliente…';
    av.style.display = 'none';
  }
}

function deleteClient(id) {
  const c = data.clients[id]; if (!c) return;
  if (!confirm('Excluir o cliente "' + c.name + '" e todos os seus dados?\n\nEsta ação não pode ser desfeita.')) return;
  delete data.clients[id];
  saveData();
  if (activeClient === id) {
    activeClient = null;
    localStorage.removeItem('fb_activeClient');
    document.getElementById('clientTitle').textContent = 'Selecione um cliente';
    document.getElementById('toggleAvatar').style.display = 'none';
    document.getElementById('toggleLabel').textContent = 'Selecionar cliente…';
    ['cartao-content','dividas-content','extrato-content','resumo-content','dre-content','graficos-content'].forEach(id => {
      document.getElementById(id).innerHTML = '<div class="empty-state"><div class="icon">👈</div>Selecione um cliente.</div>';
    });
  }
  renderClientList();
}

function toggleDropdown() {
  const m = document.getElementById('clientDropdownMenu'), t = document.getElementById('clientDropdownToggle');
  const o = m.classList.toggle('open'); t.classList.toggle('open', o);
}

function selectClient(id) {
  activeClient = id; localStorage.setItem('fb_activeClient', id);
  document.getElementById('clientDropdownMenu').classList.remove('open');
  document.getElementById('clientDropdownToggle').classList.remove('open');
  const c = data.clients[id];
  if (!c.cartoes)  c.cartoes  = [];
  if (!c.cartao)   c.cartao   = [];
  if (!c.dividas)  c.dividas  = [];
  if (!Array.isArray(c.extrato)) c.extrato = [];
  if (!Array.isArray(c.contas))  c.contas  = [];
  _ccFiltro   = new Set();
  _dvHistOpen = new Set();
  renderClientList();
  document.getElementById('clientTitle').textContent = c.name;
  renderTab(activeTab);
}
