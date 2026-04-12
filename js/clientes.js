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
  } else {
    clearActiveClientView();
  }
}

function clearActiveClientView() {
  activeClient = null;
  document.getElementById('clientTitle').textContent = 'Selecione um cliente';
  document.getElementById('toggleAvatar').style.display = 'none';
  document.getElementById('toggleLabel').textContent = 'Selecionar cliente...';

  ['cartao-content','dividas-content','extrato-content','resumo-content','dre-content','graficos-content']
    .forEach(tabId => {
      var el = document.getElementById(tabId);
      if (el) el.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    });
}

async function addClient() {
  const inp = document.getElementById('newClientName');
  const name = inp.value.trim();
  const totalClientes = Object.keys(data.clients || {}).length;

  if (!name) {
    alert('Digite o nome do cliente.');
    return;
  }

  if (totalClientes >= getClientLimit()) {
    alert('Seu acesso permite cadastrar somente um cliente.');
    return;
  }

  const { data: inserted, error } = await supabaseClient
    .from('clientes')
    .insert([Object.assign({ nome: name }, getUserScopePayload())])
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
  const limiteClientes = getClientLimit();
  const canCreateClient = entries.length < limiteClientes;

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

  const inputNovo = document.getElementById('newClientName');
  const areaNovo = document.querySelector('.new-client-area');
  if (inputNovo && areaNovo) {
    inputNovo.disabled = !canCreateClient;
    inputNovo.placeholder = canCreateClient ? 'Nome do cliente...' : 'Limite de 1 cliente atingido';
    const btnNovo = areaNovo.querySelector('button');
    if (btnNovo) btnNovo.disabled = !canCreateClient;
    let note = document.getElementById('clientLimitNote');
    if (!canCreateClient) {
      if (!note) {
        note = document.createElement('small');
        note.id = 'clientLimitNote';
        areaNovo.appendChild(note);
      }
      note.textContent = 'Seu acesso permite cadastrar somente um cliente.';
    } else if (note) {
      note.remove();
    }
  }
}

async function deleteClient(id) {
  if (!isOwnClient(id)) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  const c = data.clients[id];
  if (!c) return;

  if (!confirm('Excluir o cliente "' + c.name + '" e todos os seus dados?\n\nEsta ação não pode ser desfeita.')) {
    return;
  }

  const { error } = await applyUserScope(
    supabaseClient
      .from('clientes')
      .delete()
      .eq('id', id)
  );

  if (error) {
    console.error('Erro ao excluir cliente:', error);
    alert('Não foi possível excluir o cliente.');
    return;
  }

  if (activeClient === id) {
    localStorage.removeItem('fb_activeClient');
    localStorage.removeItem(activeClientStorageKey());
    clearActiveClientView();

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
  localStorage.setItem(activeClientStorageKey(), id);
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
  _ccFiltroMes = '';
  _ccFiltroTipo = 'todos';
  _ccFiltroCat = '';
  _ccFiltroBusca = '';
  _dvHistOpen = new Set();
  _dvFiltroStatus = 'todos';
  _dvFiltroTipo = '';
  _dvFiltroBusca = '';
  _exFiltroTipo = 'todos';
  _exFiltroCat = '';
  _exFiltroMes = typeof getPreviousMonthKey === 'function' ? getPreviousMonthKey() : '';
  _exFiltroBusca = '';

  renderClientList();
  document.getElementById('clientTitle').textContent = c.name + (isAdminUser() && !isOwnClient(id) ? ' · Outro login' : '');
  renderTab(activeTab);
}
