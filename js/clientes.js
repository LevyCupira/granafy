// Clientes: cadastro, selecao e exclusao.

var _ccFiltro = new Set();
var _dvHistOpen = new Set();

function clientTypeLabel(tipo) {
  return tipo === 'pj' ? 'PJ' : 'PF';
}

function currentClientLimitReached() {
  return Object.keys(data.clients || {}).length >= getClientLimit();
}

function isMissingClientProfileColumnError(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return msg.includes('tipo_cliente')
    || msg.includes('email_financeiro')
    || msg.includes('razao_social')
    || msg.includes('nome_fantasia')
    || msg.includes('responsavel')
    || msg.includes('documento')
    || msg.includes('telefone')
    || msg.includes('observacoes');
}

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

  ['cartao-content', 'dividas-content', 'extrato-content', 'resumo-content', 'dre-content', 'graficos-content']
    .forEach(function(tabId) {
      var el = document.getElementById(tabId);
      if (el) el.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    });
}

function syncClientFormByType() {
  var tipoEl = document.getElementById('client-form-tipo');
  var tipo = tipoEl ? tipoEl.value : 'pf';
  document.querySelectorAll('.client-form-type-pf').forEach(function(el) {
    el.style.display = tipo === 'pf' ? 'grid' : 'none';
  });
  document.querySelectorAll('.client-form-type-pj').forEach(function(el) {
    el.style.display = tipo === 'pj' ? 'grid' : 'none';
  });
}

function openClientFormModal(id) {
  var cliente = id && data.clients ? data.clients[id] : null;
  var tipo = cliente && cliente.tipoCliente ? cliente.tipoCliente : 'pf';

  document.getElementById('modalTitle').textContent = cliente ? 'Editar cliente' : 'Cadastrar cliente';
  document.getElementById('modalBody').innerHTML =
    '<div class="form-row">'
      + '<div class="form-group" style="max-width:190px"><label>Tipo do cliente</label>'
      + '<select id="client-form-tipo" onchange="syncClientFormByType()">'
      + '<option value="pf"' + (tipo === 'pf' ? ' selected' : '') + '>Pessoa fisica</option>'
      + '<option value="pj"' + (tipo === 'pj' ? ' selected' : '') + '>Pessoa juridica</option>'
      + '</select></div>'
    + '</div>'
    + '<div class="form-row client-form-type client-form-type-pf">'
      + '<div class="form-group"><label>Nome completo</label><input type="text" id="client-form-nome" value="' + esc(cliente ? (cliente.name || '') : '') + '" placeholder="Nome do cliente"/></div>'
      + '<div class="form-group"><label>CPF</label><input type="text" id="client-form-documento" value="' + esc(cliente ? (cliente.documento || '') : '') + '" placeholder="000.000.000-00"/></div>'
    + '</div>'
    + '<div class="form-row client-form-type client-form-type-pj">'
      + '<div class="form-group"><label>Nome fantasia</label><input type="text" id="client-form-fantasia" value="' + esc(cliente ? (cliente.nomeFantasia || cliente.name || '') : '') + '" placeholder="Como o cliente aparece no sistema"/></div>'
      + '<div class="form-group"><label>CNPJ</label><input type="text" id="client-form-documento-pj" value="' + esc(cliente ? (cliente.documento || '') : '') + '" placeholder="00.000.000/0000-00"/></div>'
    + '</div>'
    + '<div class="form-row client-form-type client-form-type-pj">'
      + '<div class="form-group"><label>Razao social</label><input type="text" id="client-form-razao" value="' + esc(cliente ? (cliente.razaoSocial || '') : '') + '" placeholder="Razao social"/></div>'
      + '<div class="form-group"><label>Responsavel</label><input type="text" id="client-form-responsavel" value="' + esc(cliente ? (cliente.responsavel || '') : '') + '" placeholder="Responsavel pelo contato"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Telefone</label><input type="text" id="client-form-telefone" value="' + esc(cliente ? (cliente.telefone || '') : '') + '" placeholder="(00) 00000-0000"/></div>'
      + '<div class="form-group"><label>E-mail financeiro</label><input type="email" id="client-form-email" value="' + esc(cliente ? (cliente.emailFinanceiro || '') : '') + '" placeholder="financeiro@empresa.com"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Observacoes</label><textarea id="client-form-obs" rows="4" placeholder="Informacoes importantes deste cadastro">' + esc(cliente ? (cliente.observacoes || '') : '') + '</textarea></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px">'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Cancelar</button>'
      + '<button class="btn-add" type="button" style="margin-top:0" onclick="saveClientForm(' + (cliente ? ('\'' + cliente.id + '\'') : 'null') + ')">' + (cliente ? 'Salvar cliente' : 'Cadastrar cliente') + '</button>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  syncClientFormByType();
}

function buildClientPayloadFromForm() {
  var tipo = document.getElementById('client-form-tipo').value || 'pf';
  var nomePF = (document.getElementById('client-form-nome').value || '').trim();
  var fantasia = (document.getElementById('client-form-fantasia').value || '').trim();
  var razao = (document.getElementById('client-form-razao').value || '').trim();
  var documentoPF = (document.getElementById('client-form-documento').value || '').trim();
  var documentoPJ = (document.getElementById('client-form-documento-pj').value || '').trim();
  var responsavel = (document.getElementById('client-form-responsavel').value || '').trim();
  var telefone = (document.getElementById('client-form-telefone').value || '').trim();
  var email = (document.getElementById('client-form-email').value || '').trim();
  var observacoes = (document.getElementById('client-form-obs').value || '').trim();

  return {
    tipo_cliente: tipo,
    nome: tipo === 'pj' ? (fantasia || razao) : nomePF,
    documento: (tipo === 'pj' ? documentoPJ : documentoPF) || null,
    telefone: telefone || null,
    email_financeiro: email || null,
    responsavel: tipo === 'pj' ? (responsavel || null) : null,
    razao_social: tipo === 'pj' ? (razao || null) : null,
    nome_fantasia: tipo === 'pj' ? (fantasia || null) : null,
    observacoes: observacoes || null
  };
}

async function saveClientForm(id) {
  var payload = buildClientPayloadFromForm();

  if (!payload.nome) {
    alert(payload.tipo_cliente === 'pj' ? 'Informe ao menos o nome fantasia ou a razao social.' : 'Informe o nome do cliente.');
    return;
  }

  if (!id && currentClientLimitReached()) {
    alert('Seu acesso permite cadastrar somente um cliente.');
    return;
  }

  var query = id
    ? supabaseClient.from('clientes').update(payload).eq('id', id)
    : supabaseClient.from('clientes').insert([Object.assign({}, payload, getUserScopePayload())]).select().single();
  query = applyUserScope(query);

  var resposta = await query;
  if (resposta.error) {
    console.error('Erro ao salvar cliente:', resposta.error);
    if (isMissingClientProfileColumnError(resposta.error)) {
      alert('O cadastro completo de PF/PJ precisa da migracao 20260508_cadastro_pf_pj.sql no Supabase.');
    } else {
      alert('Nao foi possivel salvar o cliente.');
    }
    return;
  }

  closeModal();
  await loadData();
  renderClientList();

  var targetId = id || (resposta.data && resposta.data.id);
  if (targetId) selectClient(targetId);
}

async function addClient() {
  if (currentClientLimitReached()) {
    alert('Seu acesso permite cadastrar somente um cliente.');
    return;
  }
  openClientFormModal();
}

function renderClientList() {
  var menu = document.getElementById('clientDropdownMenu');
  var entries = Object.entries(data.clients);
  var limiteClientes = getClientLimit();
  var canCreateClient = entries.length < limiteClientes;

  menu.innerHTML = entries.length === 0
    ? '<div class="client-dropdown-empty">Nenhum cliente cadastrado.</div>'
    : entries.map(function(entry) {
        var id = entry[0];
        var c = entry[1];
        return '<div class="client-dropdown-item ' + (id === activeClient ? 'active' : '') + '" style="justify-content:space-between">'
          + '<button style="background:none;border:none;color:inherit;font-family:inherit;font-size:inherit;font-weight:inherit;cursor:pointer;display:flex;align-items:center;gap:7px;flex:1;text-align:left;padding:0" onclick="selectClient(\'' + id + '\')">'
          + '<div class="avatar">' + initials(c.name) + '</div>'
          + '<span style="display:flex;flex-direction:column;gap:2px"><strong>' + esc(c.name) + '</strong><small style="color:var(--muted)">' + clientTypeLabel(c.tipoCliente) + (c.documento ? ' · ' + esc(c.documento) : '') + '</small></span>'
          + '</button>'
          + '<button style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.75rem;flex-shrink:0" onclick="openClientFormModal(\'' + id + '\')" title="Editar cliente">&#9998;</button>'
          + '<button style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.75rem;flex-shrink:0" onclick="deleteClient(\'' + id + '\')" title="Excluir cliente">🗑</button>'
          + '</div>';
      }).join('');

  var av = document.getElementById('toggleAvatar');
  var lbl = document.getElementById('toggleLabel');

  if (activeClient && data.clients[activeClient]) {
    lbl.textContent = data.clients[activeClient].name;
    av.textContent = initials(data.clients[activeClient].name);
    av.style.display = 'flex';
  } else {
    lbl.textContent = 'Selecionar cliente...';
    av.style.display = 'none';
  }

  var btnNovo = document.getElementById('openClientFormBtn');
  var areaNovo = document.querySelector('.new-client-area');
  if (btnNovo && areaNovo) {
    btnNovo.disabled = !canCreateClient;
    btnNovo.textContent = canCreateClient ? '+ Cadastrar cliente' : 'Limite do perfil atingido';
    var note = document.getElementById('clientLimitNote');
    if (!canCreateClient) {
      if (!note) {
        note = document.createElement('small');
        note.id = 'clientLimitNote';
        areaNovo.appendChild(note);
      }
      var limiteTexto = limiteClientes === Infinity
        ? 'Seu perfil permite cadastrar clientes sem limite.'
        : ('Seu perfil permite cadastrar ate ' + limiteClientes + ' cliente' + (limiteClientes === 1 ? '' : 's') + '.');
      note.textContent = limiteTexto;
    } else if (note) {
      note.remove();
    }
  }
}

async function deleteClient(id) {
  if (!isOwnClient(id)) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var c = data.clients[id];
  if (!c) return;

  if (!(await appConfirm('Excluir o cliente "' + c.name + '" e todos os seus dados?\n\nEsta acao nao pode ser desfeita.', { title: 'Excluir cliente', confirmText: 'Excluir' }))) {
    return;
  }

  var res = await applyUserScope(
    supabaseClient
      .from('clientes')
      .delete()
      .eq('id', id)
  );

  if (res.error) {
    console.error('Erro ao excluir cliente:', res.error);
    alert('Nao foi possivel excluir o cliente.');
    return;
  }

  localStorage.removeItem(catsCCStorageKey(id));
  localStorage.removeItem(catsCartaoStorageKey(id));

  if (activeClient === id) {
    localStorage.removeItem('fb_activeClient');
    localStorage.removeItem(activeClientStorageKey());
    clearActiveClientView();
  }

  await loadData();
  renderClientList();
}

function toggleDropdown() {
  var m = document.getElementById('clientDropdownMenu');
  var t = document.getElementById('clientDropdownToggle');
  var o = m.classList.toggle('open');
  t.classList.toggle('open', o);
}

function selectClient(id) {
  activeClient = id;
  localStorage.setItem(activeClientStorageKey(), id);
  localStorage.setItem('fb_activeClient', id);

  document.getElementById('clientDropdownMenu').classList.remove('open');
  document.getElementById('clientDropdownToggle').classList.remove('open');

  var c = data.clients[id];

  if (!c.cartoes) c.cartoes = [];
  if (!c.cartao) c.cartao = [];
  if (!c.dividas) c.dividas = [];
  if (!Array.isArray(c.extrato)) c.extrato = [];
  if (!Array.isArray(c.contas)) c.contas = [];
  if (!Array.isArray(c.catsCC)) c.catsCC = loadCatsCC(id);
  if (!Array.isArray(c.catsCartao)) c.catsCartao = loadCatsCartao(id);

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
