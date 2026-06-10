// Clientes: cadastro, selecao e exclusao.

var _ccFiltro = new Set();
var _dvHistOpen = new Set();

function clientTypeLabel(tipo) {
  return tipo === 'pj' ? 'PJ' : 'PF';
}

function currentClientLimitReached() {
  var totalProprios = Object.values(data.clients || {}).filter(function(cliente) {
    return isOwnClient(cliente.id);
  }).length;
  return totalProprios >= getClientLimit();
}

function canCreateOwnedClient() {
  var clientes = Object.values(data.clients || {});
  var totalProprios = clientes.filter(function(cliente) {
    return isOwnClient(cliente.id);
  }).length;
  var possuiAcessoCompartilhado = clientes.some(function(cliente) {
    return isSharedClient(cliente.id);
  });
  if (totalProprios === 0 && possuiAcessoCompartilhado && !isAdminUser() && !isConsultorUser()) return false;
  return totalProprios < getClientLimit();
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
    var cliente = data.clients[activeClient];
    var acesso = getClientAccessEntry(activeClient);
    var sufixo = '';
    if (isAdminUser() && !isOwnClient(activeClient)) sufixo = ' · Outro login';
    else if (acesso) sufixo = ' · ' + accessRoleLabel(acesso.papel);
    document.getElementById('clientTitle').textContent = cliente.name + sufixo;
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

  ['cartao-content', 'dividas-content', 'extrato-content', 'financeiro-content', 'resumo-content', 'dre-content', 'graficos-content']
    .forEach(function(tabId) {
      var el = document.getElementById(tabId);
      if (el) el.innerHTML = '<div class="empty-state"><div class="icon">&#128071;</div>Selecione um cliente.</div>';
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

function renderClientAccessSection(clientId) {
  if (!clientId || !canManageClientAccess(clientId)) return '';
  var cliente = data && data.clients ? data.clients[clientId] : null;
  var acessos = cliente && Array.isArray(cliente.acessos)
    ? cliente.acessos.filter(function(item) { return item && item.status === 'ativo'; })
    : [];

  return '<div class="settings-section-card" style="margin-top:18px">'
    + '<div class="settings-card-head"><div><h5>Acesso compartilhado</h5><p>Convide outro login para acessar somente este cliente, sem abrir sua base geral.</p></div></div>'
    + (acessos.length
      ? '<div class="settings-cat-grid">' + acessos.map(function(item) {
          return '<div class="settings-cat-item">'
            + '<div class="settings-cat-main"><span class="settings-cat-name">' + esc(item.nome || item.email || '-') + '</span><span class="settings-cat-flag">' + esc(accessRoleLabel(item.papel)) + '</span></div>'
            + '<div class="settings-cat-actions"><small style="color:var(--muted)">' + esc(item.email || '') + '</small><button class="tag-del" type="button" onclick="revokeClientAccess(\'' + clientId + '\',\'' + item.id + '\')">x</button></div>'
            + '</div>';
        }).join('') + '</div>'
      : '<p style="color:var(--muted);font-size:.83rem;margin:0 0 16px">Nenhum acesso compartilhado ainda.</p>')
    + '<div class="form-row">'
      + '<div class="form-group"><label>E-mail do login convidado</label><input type="email" id="client-access-email" placeholder="cliente@empresa.com"/></div>'
      + '<div class="form-group" style="max-width:180px"><label>Papel</label><select id="client-access-role"><option value="visualizador">Visualizador</option><option value="editor">Editor</option></select></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end"><button class="btn-add" type="button" style="margin-top:6px" onclick="grantClientAccess(\'' + clientId + '\')">Conceder acesso</button></div>'
    + '</div>';
}

function buildClientInviteLink(email, clientId, papel) {
  var cliente = data && data.clients ? data.clients[clientId] : null;
  var base = window.getGranafyAppUrl ? window.getGranafyAppUrl() : (window.location.origin + window.location.pathname);
  var params = new URLSearchParams();
  params.set('invite_email', String(email || '').trim().toLowerCase());
  if (cliente && cliente.name) params.set('invite_client_name', cliente.name);
  if (papel) params.set('invite_role', papel);
  return base + '?' + params.toString();
}

async function copyTextSafe(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  return false;
}

function openClientFormModal(id) {
  var cliente = id && data.clients ? data.clients[id] : null;
  var tipo = cliente && cliente.tipoCliente ? cliente.tipoCliente : 'pf';
  var accessSection = cliente ? renderClientAccessSection(cliente.id) : '';

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
    + '</div>'
    + accessSection;

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

  if (!id && !canCreateOwnedClient()) {
    alert('Seu acesso nao pode cadastrar novos clientes nesta base.');
    return;
  }

  var query = id
    ? supabaseClient.from('clientes').update(payload).eq('id', id)
    : supabaseClient.from('clientes').insert([Object.assign({}, payload, getUserScopePayload())]).select().single();
  query = applyUserScope(query, id || activeClient || null);

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
  if (!canCreateOwnedClient()) {
    var clientes = Object.values(data.clients || {});
    var possuiAcessoCompartilhado = clientes.some(function(cliente) {
      return isSharedClient(cliente.id);
    });
    if (possuiAcessoCompartilhado && !isAdminUser() && !isConsultorUser()) {
      alert('Este login foi vinculado a clientes especificos. O cadastro de novos clientes permanece com o responsavel da base.');
      return;
    }
    alert('Seu acesso permite cadastrar somente um cliente.');
    return;
  }
  openClientFormModal();
}

function renderClientList() {
  var menu = document.getElementById('clientDropdownMenu');
  var entries = Object.entries(data.clients);
  var limiteClientes = getClientLimit();
  var totalProprios = entries.filter(function(entry) {
    return isOwnClient(entry[0]);
  }).length;
  var possuiAcessoCompartilhado = entries.some(function(entry) {
    return isSharedClient(entry[0]);
  });
  var canCreateClient = canCreateOwnedClient();

  menu.innerHTML = entries.length === 0
    ? '<div class="client-dropdown-empty">Nenhum cliente cadastrado.</div>'
    : entries.map(function(entry) {
        var id = entry[0];
        var c = entry[1];
        var acesso = getClientAccessEntry(id);
        var compartilhado = !isOwnClient(id) && !!acesso;
        var subtitulo = clientTypeLabel(c.tipoCliente)
          + (c.documento ? ' · ' + esc(c.documento) : '')
          + (compartilhado ? ' · ' + esc(accessRoleLabel(acesso.papel)) : '');
        var acoes = isOwnClient(id)
          ? '<button style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.75rem;flex-shrink:0" onclick="openClientFormModal(\'' + id + '\')" title="Editar cliente">&#9998;</button>'
            + '<button style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.75rem;flex-shrink:0" onclick="deleteClient(\'' + id + '\')" title="Excluir cliente">&#128465;</button>'
          : '';
        return '<div class="client-dropdown-item ' + (id === activeClient ? 'active' : '') + '" style="justify-content:space-between">'
          + '<button style="background:none;border:none;color:inherit;font-family:inherit;font-size:inherit;font-weight:inherit;cursor:pointer;display:flex;align-items:center;gap:7px;flex:1;text-align:left;padding:0" onclick="selectClient(\'' + id + '\')">'
          + '<div class="avatar">' + initials(c.name) + '</div>'
          + '<span style="display:flex;flex-direction:column;gap:2px"><strong>' + esc(c.name) + '</strong><small style="color:var(--muted)">' + subtitulo + '</small></span>'
          + '</button>'
          + acoes
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
      var limiteTexto = (totalProprios === 0 && possuiAcessoCompartilhado && !isAdminUser() && !isConsultorUser())
        ? 'Este login possui acesso compartilhado e nao pode cadastrar clientes proprios.'
        : (limiteClientes === Infinity
          ? 'Seu perfil permite cadastrar clientes sem limite.'
          : ('Seu perfil permite cadastrar ate ' + limiteClientes + ' cliente' + (limiteClientes === 1 ? '' : 's') + '.'));
      note.textContent = limiteTexto;
    } else if (note) {
      note.remove();
    }
  }
}

async function deleteClient(id) {
  if (!isOwnClient(id)) {
    alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
    return;
  }
  var c = data.clients[id];
  if (!c) return;

  if (!(await appConfirm('Excluir o cliente "' + c.name + '" e todos os seus dados?\n\nEsta acao nao pode ser desfeita.', { title: 'Excluir cliente', confirmText: 'Excluir' }))) {
    return;
  }

  var res = await applyUserScope(
    supabaseClient
      .from('clientes')
      .delete()
      .eq('id', id),
    id
  );

  if (res.error) {
    console.error('Erro ao excluir cliente:', res.error);
    alert('Nao foi possivel excluir o cliente.');
    return;
  }

  localStorage.removeItem(catsCCStorageKey(id));
  localStorage.removeItem(catsCartaoStorageKey(id));
  localStorage.removeItem(catsFinanceiroStorageKey(id));

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
  if (!id || !data.clients[id]) {
    if (typeof clearActiveClientView === 'function') clearActiveClientView();
    return;
  }

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
  if (!Array.isArray(c.catsFinanceiro)) c.catsFinanceiro = loadCatsFinanceiro(id);

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
  var acesso = getClientAccessEntry(id);
  var sufixo = '';
  if (isAdminUser() && !isOwnClient(id)) sufixo = ' · Outro login';
  else if (acesso) sufixo = ' · ' + accessRoleLabel(acesso.papel);
  document.getElementById('clientTitle').textContent = c.name + sufixo;
  renderTab(activeTab);
}

async function grantClientAccess(clientId) {
  if (!canManageClientAccess(clientId)) {
    alert('Apenas o responsavel por este cliente pode compartilhar acesso.');
    return;
  }

  var emailEl = document.getElementById('client-access-email');
  var roleEl = document.getElementById('client-access-role');
  var email = emailEl ? String(emailEl.value || '').trim().toLowerCase() : '';
  var papel = roleEl ? roleEl.value : 'visualizador';

  if (!email) {
    alert('Informe o e-mail do login convidado.');
    return;
  }
  if (email === currentUserEmail()) {
    alert('Seu proprio login ja possui acesso total a este cliente.');
    return;
  }

  var usuarioId = null;
  var nome = '';
  var perfilRes = await supabaseClient
    .from('perfis')
    .select('id,nome,email')
    .ilike('email', email)
    .maybeSingle();
  if (!perfilRes.error && perfilRes.data) {
    usuarioId = perfilRes.data.id || null;
    nome = perfilRes.data.nome || '';
  }

  var cliente = data && data.clients ? data.clients[clientId] : null;
  var existingAccess = cliente && Array.isArray(cliente.acessos)
    ? cliente.acessos.find(function(item) {
        return item && String(item.email || '').trim().toLowerCase() === email;
      })
    : null;

  var response;
  if (existingAccess && existingAccess.id) {
    response = await supabaseClient
      .from('clientes_acessos')
      .update({
        usuario_id: usuarioId,
        email: email,
        nome: nome || null,
        papel: papel,
        status: 'ativo'
      })
      .eq('id', existingAccess.id)
      .eq('cliente_id', clientId)
      .select();
  } else {
    response = await supabaseClient
      .from('clientes_acessos')
      .insert([{
        cliente_id: clientId,
        usuario_id: usuarioId,
        email: email,
        nome: nome || null,
        papel: papel,
        status: 'ativo',
        created_by: currentUserId()
      }])
      .select();
  }

  if (response.error) {
    console.error('Erro ao conceder acesso ao cliente:', response.error);
    alert('Nao foi possivel conceder o acesso agora: ' + (response.error.message || 'erro desconhecido'));
    return;
  }

  if (emailEl) emailEl.value = '';
  if (existingAccess && existingAccess.id) {
    await appAlert('Acesso atualizado para ' + email + '. Esse login ja pode entrar com a conta que usa hoje.', 'Acesso compartilhado');
  } else if (usuarioId) {
    await appAlert('Acesso liberado para ' + email + '. Como esse login ja existe, a pessoa pode entrar normalmente no Granafy.', 'Acesso compartilhado');
  } else {
    var inviteLink = buildClientInviteLink(email, clientId, papel);
    var copied = await copyTextSafe(inviteLink);
    await appAlert(
      'Acesso liberado para ' + email + '.\n\nEsse e-mail ainda nao tem conta no Granafy. A pessoa deve usar o primeiro acesso pelo link abaixo:\n'
      + inviteLink
      + (copied ? '\n\nO link ja foi copiado para a area de transferencia.' : '\n\nCopie esse link e envie para a pessoa.'),
      'Primeiro acesso'
    );
  }
  await loadData();
  openClientFormModal(clientId);
}

async function revokeClientAccess(clientId, accessId) {
  if (!canManageClientAccess(clientId)) {
    alert('Apenas o responsavel por este cliente pode revogar acessos.');
    return;
  }

  var cliente = data && data.clients ? data.clients[clientId] : null;
  var acesso = cliente && Array.isArray(cliente.acessos)
    ? cliente.acessos.find(function(item) { return item && item.id === accessId; })
    : null;
  if (!acesso) return;

  var confirmed = await appConfirm(
    'Revogar o acesso de "' + (acesso.nome || acesso.email || 'este login') + '" para este cliente?',
    { title: 'Revogar acesso', confirmText: 'Revogar' }
  );
  if (!confirmed) return;

  var response = await supabaseClient
    .from('clientes_acessos')
    .update({ status: 'revogado' })
    .eq('id', accessId)
    .eq('cliente_id', clientId);

  if (response.error) {
    console.error('Erro ao revogar acesso ao cliente:', response.error);
    alert('Nao foi possivel revogar o acesso agora.');
    return;
  }

  await loadData();
  openClientFormModal(clientId);
}
