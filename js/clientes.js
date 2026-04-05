// ════════════════════════════════════════════════════
// CLIENTES.JS — CRUD de clientes (Supabase)
// ════════════════════════════════════════════════════

var _ccFiltro = new Set();
var _dvHistOpen = new Set();

async function refreshClientsFromSupabase() {
  await loadData();
  renderClientList();

  if (activeClient && data.clients[activeClient]) {
    document.getElementById('clientTitle').textContent = data.clients[activeClient].name;
    renderTab(activeTab);
  }
}

async function addClient() {
  const inp = document.getElementById('newClientName');
  const name = inp.value.trim();

  if (!name) {
    alert('Digite o nome do cliente.');
    return;
  }

  const { data: inserted, error } = await supabaseClient
    .from('clientes')
    .insert([{ nome: name }])
    .select()
    .single();

  if (error) {
    console.error('Erro ao cadastrar cliente:', error);
    alert('Não foi possível cadastrar o cliente.');
    return;
  }

  inp.value = '';

  await loadData();
  renderClientList();

  if (inserted && inserted.id) {
    selectClient(inserted.id);
  }
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
        + 'onclick="deleteClient(\'' + id + '\')" title="Excluir cliente">🗑</button>'
        + '</div>'
      ).join('');

  const av = document.getElementById('toggleAvatar');
  const lbl = document.getElementById('toggleLabel');

  if (activeClient && data.clients[activeClient]) {
    lbl.textContent = data.clients[activeClient].name;
    av.textContent = initials(data.clients[activeClient].name);
    av.style.display = 'flex';
  } else {
    lbl.textContent = 'Selecionar cliente…';
    av.style.display = 'none';
  }
}

async function deleteClient(id) {
  const c = data.clients[id];
  if (!c) return;

  if (!confirm('Excluir o cliente "' + c.name + '" e todos os seus dados?\n\nEsta ação não pode ser desfeita.')) {
    return;
  }

  const { error } = await supabaseClient
    .from('clientes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir cliente:', error);
    alert('Não foi possível excluir o cliente.');
    return;
  }

  if (activeClient === id) {
    activeClient = null;
    localStorage.removeItem('fb_activeClient');

    document.getElementById('clientTitle').textContent = 'Selecione um cliente';
    document.getElementById('toggleAvatar').style.display = 'none';
    document.getElementById('toggleLabel').textContent = 'Selecionar cliente…';

    ['cartao-content','dividas-content','extrato-content','resumo-content','dre-content','graficos-content']
      .forEach(tabId => {
        document.getElementById(tabId).innerHTML =
          '<div class="empty-state"><div class="icon">👈</div>Selecione um cliente.</div>';
      });
  }

  await loadData();
  renderClientList();
}

function toggleDropdown() {
  const m = document.getElementById('clientDropdownMenu');
  const t = document.getElementById('clientDropdownToggle');
  const o = m.classList.toggle('open');
  t.classList.toggle('open', o);
}

function selectClient(id) {
  activeClient = id;
  localStorage.setItem('fb_activeClient', id);

  document.getElementById('clientDropdownMenu').classList.remove('open');
  document.getElementById('clientDropdownToggle').classList.remove('open');

  const c = data.clients[id];

  if (!c.cartoes) c.cartoes = [];
  if (!c.cartao) c.cartao = [];
  if (!c.dividas) c.dividas = [];
  if (!Array.isArray(c.extrato)) c.extrato = [];
  if (!Array.isArray(c.contas)) c.contas = [];

  _ccFiltro = new Set();
  _dvHistOpen = new Set();

  renderClientList();
  document.getElementById('clientTitle').textContent = c.name;
  renderTab(activeTab);
}