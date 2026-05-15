// ====================================================
// SETTINGS.JS - Configuracoes, perfil e backup
// ====================================================

function openModal(section, tab) {
  if (section === 'backup' && typeof canSeeBackup === 'function' && !canSeeBackup()) {
    alert('Backup disponivel apenas para perfis Master e Consultor.');
    return;
  }

  var overlay = document.getElementById('modalOverlay');
  var modal = overlay ? overlay.querySelector('.modal') : null;
  if (overlay) overlay.classList.add('open');
  if (overlay) overlay.dataset.mode = section === 'settings' ? 'settings' : 'backup';
  if (modal) modal.classList.toggle('modal-wide', section === 'settings');
  document.addEventListener('keydown', handleMainModalEscape);
  if (section === 'settings') renderSettingsModal(tab);
  else renderBackupModal();
}

function closeModal() {
  var overlay = document.getElementById('modalOverlay');
  var modal = overlay ? overlay.querySelector('.modal') : null;
  if (overlay) {
    overlay.classList.remove('open');
    delete overlay.dataset.mode;
  }
  if (modal) modal.classList.remove('modal-wide');
  document.removeEventListener('keydown', handleMainModalEscape);
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function handleMainModalEscape(event) {
  if (event.key !== 'Escape') return;
  var dialogOverlay = document.getElementById('appDialogOverlay');
  if (dialogOverlay && dialogOverlay.classList.contains('open')) return;
  var overlay = document.getElementById('modalOverlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  closeModal();
}

function renderBackupModal() {
  document.getElementById('modalTitle').textContent = 'Backup';
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-hero backup-hero">'
    + '<div><span class="settings-eyebrow">Seguranca dos dados</span><h4>Backup e restauracao</h4><p>Baixe uma copia em JSON para guardar fora do sistema ou restaurar uma base ja existente.</p></div>'
    + '</div>'
    + '<div class="settings-section-card">'
    + '<div class="settings-card-grid backup-card-grid">'
    + '<div class="settings-action-card">'
    + '<span class="settings-action-title">Exportar dados</span>'
    + '<small>Gera um arquivo JSON com os dados carregados no ambiente atual.</small>'
    + '<button class="btn-add" style="margin-top:14px;padding:10px 18px" onclick="exportData()">Baixar backup</button>'
    + '</div>'
    + '<div class="settings-action-card">'
    + '<span class="settings-action-title">Importar backup</span>'
    + '<small>Restaura dados a partir de um arquivo JSON ja salvo, respeitando as protecoes contra duplicidade.</small>'
    + '<button class="btn-sm" style="margin-top:14px;padding:9px 18px;font-size:.83rem" onclick="document.getElementById(\'importFileInput\').click()">Selecionar arquivo</button>'
    + '</div>'
    + '</div>'
    + '</div>';
}

function exportData() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'granafy_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importData(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var uid = typeof currentUserId === 'function' ? currentUserId() : null;
      if (!uid) throw new Error('Entre com o login do cliente antes de importar o backup.');

      var imp = JSON.parse(e.target.result);
      if (!imp.clients) throw new Error('Estrutura invalida.');

      if (!(await appConfirm('Importar este JSON para o Supabase no login atual? Dados iguais serao ignorados para evitar duplicidade.', {
        title: 'Importar backup',
        confirmText: 'Importar'
      }))) return;

      var resumo = await importarBackupJsonParaSupabase(imp);
      await loadData();
      renderClientList();
      if (typeof clearActiveClientView === 'function') clearActiveClientView();

      closeModal();
      alert(
        'Backup importado para o Supabase!\n\n'
        + 'Clientes criados: ' + resumo.clientes + '\n'
        + 'Dividas: ' + resumo.dividas + '\n'
        + 'Relacionamentos: ' + resumo.relacionamentos + '\n'
        + 'Lancamentos do extrato: ' + resumo.lancamentos + '\n'
        + 'Cartoes: ' + resumo.cartoes + '\n'
        + 'Lancamentos de cartao: ' + resumo.lancamentosCartao + '\n'
        + 'Ignorados por duplicidade: ' + resumo.ignorados
      );
    } catch (err) {
      alert('Erro ao importar: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

async function importarBackupJsonParaSupabase(backup) {
  var resumo = { clientes: 0, dividas: 0, relacionamentos: 0, lancamentos: 0, cartoes: 0, lancamentosCartao: 0, ignorados: 0 };
  var clientes = backup.clients || {};

  for (const [, cliente] of Object.entries(clientes)) {
    var nomeCliente = String(cliente.name || '').trim();
    if (!nomeCliente) continue;

    var clienteId = await garantirClienteImportado(nomeCliente, resumo);
    var mapaCartoes = await importarCartoesCliente(clienteId, cliente.cartoes || [], resumo);
    var mapaRelacionamentos = await importarRelacionamentosCliente(clienteId, cliente.relacionamentos || [], resumo);

    await importarDividasCliente(clienteId, cliente.dividas || [], resumo);
    await importarExtratoCliente(clienteId, cliente.extrato || [], mapaRelacionamentos, resumo);
    await importarLancamentosCartaoCliente(clienteId, cliente.cartao || [], mapaCartoes, resumo);
  }

  return resumo;
}

async function garantirClienteImportado(nomeCliente, resumo) {
  var busca = applyUserScope(
    supabaseClient
      .from('clientes')
      .select('id,nome')
      .eq('nome', nomeCliente)
      .limit(1)
  );

  var existente = await busca.maybeSingle();
  if (existente.error) throw new Error('Erro ao buscar cliente "' + nomeCliente + '": ' + existente.error.message);
  if (existente.data) {
    resumo.ignorados++;
    return existente.data.id;
  }

  var criado = await supabaseClient
    .from('clientes')
    .insert([Object.assign({ nome: nomeCliente }, getUserScopePayload())])
    .select('id')
    .single();

  if (criado.error) throw new Error('Erro ao criar cliente "' + nomeCliente + '": ' + criado.error.message);
  resumo.clientes++;
  return criado.data.id;
}

function queryCampoOpcional(query, campo, valor) {
  return valor === null || valor === undefined || valor === ''
    ? query.is(campo, null)
    : query.eq(campo, valor);
}

async function importarCartoesCliente(clienteId, cartoes, resumo) {
  var mapa = {};

  for (const cartao of cartoes) {
    var nome = String(cartao.nome || '').trim() || 'Cartao';
    var digits = String(cartao.digits || '').trim() || null;

    var busca = applyUserScope(
      supabaseClient
        .from('cartoes')
        .select('id,nome,digits')
        .eq('cliente_id', clienteId)
        .eq('nome', nome)
        .limit(1)
    );
    busca = queryCampoOpcional(busca, 'digits', digits);

    var existente = await busca.maybeSingle();
    if (existente.error) throw new Error('Erro ao buscar cartao "' + nome + '": ' + existente.error.message);

    if (existente.data) {
      mapa[cartao.id] = existente.data.id;
      resumo.ignorados++;
      continue;
    }

    var criado = await supabaseClient
      .from('cartoes')
      .insert([Object.assign({
        cliente_id: clienteId,
        nome: nome,
        digits: digits,
        bandeira: cartao.bandeira || null,
        limite: Number(cartao.limite || 0),
        venc: Number(cartao.venc || 0)
      }, getUserScopePayload())])
      .select('id')
      .single();

    if (criado.error) throw new Error('Erro ao criar cartao "' + nome + '": ' + criado.error.message);
    mapa[cartao.id] = criado.data.id;
    resumo.cartoes++;
  }

  return mapa;
}

async function importarDividasCliente(clienteId, dividas, resumo) {
  for (const d of dividas) {
    var payload = {
      cliente_id: clienteId,
      credor: d.org || null,
      tipo_divida: d.tipo || null,
      data_inicio: d.dataInicio || d.data_inicio || null,
      valor_total: Number(d.total || 0),
      valor_pago: Number(d.pago || 0),
      parcelas_total: Number(d.parcelas || 0),
      parcelas_restantes: Number(d.restantes || d.parcelas || 0),
      valor_parcela: Number(d.valorParcela || d.valor_parcela || 0),
      taxa: Number(d.taxa || 0),
      observacoes: d.obs || d.observacoes || null
    };

    var busca = applyUserScope(
      supabaseClient
        .from('dividas')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('valor_total', payload.valor_total)
        .limit(1)
    );
    busca = queryCampoOpcional(busca, 'credor', payload.credor);
    busca = queryCampoOpcional(busca, 'tipo_divida', payload.tipo_divida);

    var existente = await busca.maybeSingle();
    if (existente.error) throw new Error('Erro ao buscar divida de "' + (payload.credor || '-') + '": ' + existente.error.message);
    if (existente.data) {
      resumo.ignorados++;
      continue;
    }

    var inserido = await supabaseClient
      .from('dividas')
      .insert([Object.assign(payload, getUserScopePayload())]);

    if (inserido.error) throw new Error('Erro ao importar divida de "' + (payload.credor || '-') + '": ' + inserido.error.message);
    resumo.dividas++;
  }
}

async function importarRelacionamentosCliente(clienteId, relacionamentos, resumo) {
  var mapa = {};

  for (const rel of relacionamentos) {
    var nome = String(rel.nome || '').trim();
    if (!nome) continue;

    var busca = applyUserScope(
      supabaseClient
        .from('relacionamentos_cliente')
        .select('id,nome')
        .eq('cliente_id', clienteId)
        .eq('nome', nome)
        .limit(1)
    );

    var existente = await busca.maybeSingle();
    if (existente.error) throw new Error('Erro ao buscar relacionamento "' + nome + '": ' + existente.error.message);
    if (existente.data) {
      mapa[rel.id] = existente.data.id;
      resumo.ignorados++;
      continue;
    }

    var payload = Object.assign({
      cliente_id: clienteId,
      nome: nome,
      tipo: rel.tipo || 'interno',
      palavras_chave: rel.palavrasChave || rel.palavras_chave || null,
      observacao: rel.observacao || null
    }, getUserScopePayload());

    var criado = await supabaseClient
      .from('relacionamentos_cliente')
      .insert([payload])
      .select('id')
      .single();

    if (criado.error) {
      var msg = String((criado.error.message || '') + ' ' + (criado.error.details || '') + ' ' + (criado.error.hint || '')).toLowerCase();
      if (msg.includes('palavras_chave')) {
        var fallbackPayload = Object.assign({}, payload);
        delete fallbackPayload.palavras_chave;
        criado = await supabaseClient
          .from('relacionamentos_cliente')
          .insert([fallbackPayload])
          .select('id')
          .single();
      }
    }

    if (criado.error) throw new Error('Erro ao criar relacionamento "' + nome + '": ' + criado.error.message);
    mapa[rel.id] = criado.data.id;
    resumo.relacionamentos++;
  }

  return mapa;
}

async function importarExtratoCliente(clienteId, lancamentos, mapaRelacionamentos, resumo) {
  for (const l of lancamentos) {
    var relacionamentoId = l.relacionamentoId ? (mapaRelacionamentos[l.relacionamentoId] || null) : null;
    var payload = {
      cliente_id: clienteId,
      data_lancamento: l.data || l.data_lancamento || null,
      descricao: l.desc || l.descricao || null,
      descricao_original: l.descOriginal || l.descricao_original || l.desc || l.descricao || null,
      categoria: l.cat || l.categoria || null,
      tipo: l.tipo || null,
      valor: Number(l.valor || 0),
      relacionamento_id: relacionamentoId,
      observacao: l.observacao || null
    };

    var busca = applyUserScope(
      supabaseClient
        .from('lancamentos')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('tipo', payload.tipo)
        .eq('valor', payload.valor)
        .limit(1)
    );
    busca = queryCampoOpcional(busca, 'descricao', payload.descricao);
    busca = queryCampoOpcional(busca, 'data_lancamento', payload.data_lancamento);

    var existente = await busca.maybeSingle();
    if (existente.error) throw new Error('Erro ao buscar lancamento "' + (payload.descricao || '-') + '": ' + existente.error.message);
    if (existente.data) {
      resumo.ignorados++;
      continue;
    }

    var inserido = await supabaseClient
      .from('lancamentos')
      .insert([Object.assign(payload, getUserScopePayload())]);

    if (inserido.error) throw new Error('Erro ao importar lancamento "' + (payload.descricao || '-') + '": ' + inserido.error.message);
    resumo.lancamentos++;
  }
}

async function importarLancamentosCartaoCliente(clienteId, lancamentos, mapaCartoes, resumo) {
  for (const l of lancamentos) {
    var cartaoId = l.cartaoId ? mapaCartoes[l.cartaoId] || null : null;
    if (!cartaoId) {
      resumo.ignorados++;
      continue;
    }

    var payload = {
      cliente_id: clienteId,
      cartao_id: cartaoId,
      data: l.data || null,
      descricao: l.desc || l.descricao || null,
      categoria: l.cat || l.categoria || null,
      tipo: l.tipo === 'estorno' ? 'estorno' : 'lancamento',
      valor: Number(l.valor || 0)
    };

    var busca = applyUserScope(
      supabaseClient
        .from('lancamentos_cartao')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('cartao_id', cartaoId)
        .eq('tipo', payload.tipo)
        .eq('valor', payload.valor)
        .limit(1)
    );
    busca = queryCampoOpcional(busca, 'descricao', payload.descricao);
    busca = queryCampoOpcional(busca, 'data', payload.data);

    var existente = await busca.maybeSingle();
    if (existente.error) throw new Error('Erro ao buscar lancamento de cartao "' + (payload.descricao || '-') + '": ' + existente.error.message);
    if (existente.data) {
      resumo.ignorados++;
      continue;
    }

    var inserido = await supabaseClient
      .from('lancamentos_cartao')
      .insert([Object.assign(payload, getUserScopePayload())]);

    if (inserido.error) throw new Error('Erro ao importar lancamento de cartao "' + (payload.descricao || '-') + '": ' + inserido.error.message);
    resumo.lancamentosCartao++;
  }
}

function renderSettingsModal(activeTabKey) {
  var cliente = activeClient && data.clients ? data.clients[activeClient] : null;
  var clienteNome = cliente ? cliente.name : 'Nenhum cliente selecionado';
  var clienteTipo = cliente && cliente.tipoCliente ? clientTypeLabel(cliente.tipoCliente) : 'Cliente';
  var ccCount = (loadCatsCC() || []).length;
  var cartaoCount = (loadCatsCartao() || []).length;
  var showUsersTab = typeof canSeeUsersTab === 'function' ? canSeeUsersTab() : !!authUser;
  var showAuditoriaTab = typeof canSeeAuditoria === 'function' ? canSeeAuditoria() : true;
  var isMaster = typeof isAdminUser === 'function' && isAdminUser();
  var usersTabLabel = isMaster ? 'Usuarios' : 'Minha conta';
  var heroParts = ['Personalize as categorias deste cliente'];
  if (showUsersTab) heroParts.push(isMaster ? 'gerencie perfis' : 'acompanhe seu perfil');
  if (showAuditoriaTab) heroParts.push('revise a auditoria');
  var heroText = heroParts.join(', ') + ' sem misturar dados com os outros clientes da base.';
  var tabButtons = ''
    + '<button class="modal-tab settings-tab-rich" data-stab="cats_cc" onclick="switchSettingsTab(\'cats_cc\')"><span class="settings-tab-main">Conta Corrente</span><span class="settings-tab-meta">' + esc(clienteTipo) + '</span><span class="settings-tab-count">' + ccCount + '</span></button>'
    + '<button class="modal-tab settings-tab-rich" data-stab="cats_cartao" onclick="switchSettingsTab(\'cats_cartao\')"><span class="settings-tab-main">Cartao</span><span class="settings-tab-meta">' + esc(clienteTipo) + '</span><span class="settings-tab-count">' + cartaoCount + '</span></button>';

  if (showUsersTab) {
    tabButtons += '<button class="modal-tab" data-stab="usuarios" onclick="switchSettingsTab(\'usuarios\')">' + usersTabLabel + '</button>';
  }

  if (showAuditoriaTab) {
    tabButtons += '<button class="modal-tab" data-stab="auditoria" onclick="switchSettingsTab(\'auditoria\')">Auditoria</button>';
  }

  document.getElementById('modalTitle').textContent = 'Configuracoes';
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-hero">'
    + '<div><span class="settings-eyebrow">Ambiente do cliente</span><h4>' + esc(clienteNome) + '</h4><p>' + heroText + '</p></div>'
    + '<div class="settings-hero-badge">' + esc(clienteTipo) + '</div>'
    + '</div>'
    + '<div class="modal-tabs settings-tabs" id="settingsTabs">'
    + tabButtons
    + '</div>'
    + '<div id="modal-panel-cats_cc" class="modal-panel"></div>'
    + '<div id="modal-panel-cats_cartao" class="modal-panel"></div>'
    + '<div id="modal-panel-usuarios" class="modal-panel"></div>'
    + '<div id="modal-panel-auditoria" class="modal-panel"></div>';
  var firstTab = activeTabKey || 'cats_cc';
  if (firstTab === 'auditoria' && !showAuditoriaTab) firstTab = showUsersTab ? 'usuarios' : 'cats_cc';
  if (firstTab === 'usuarios' && !showUsersTab) firstTab = 'cats_cc';
  switchSettingsTab(firstTab);
}

function switchSettingsTab(tab) {
  document.querySelectorAll('#settingsTabs .modal-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.stab === tab);
  });
  document.querySelectorAll('#modalBody .modal-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  var panel = document.getElementById('modal-panel-' + tab);
  if (!panel) {
    if (tab !== 'cats_cc') switchSettingsTab('cats_cc');
    return;
  }
  panel.classList.add('active');
  if (tab === 'cats_cc') renderCatsPanel('cc');
  if (tab === 'cats_cartao') renderCatsPanel('cartao');
  if (tab === 'usuarios' && (typeof canSeeUsersTab !== 'function' || canSeeUsersTab())) renderUsuariosPanel();
  if (tab === 'auditoria' && (typeof canSeeAuditoria !== 'function' || canSeeAuditoria())) renderAuditoriaPanel();
}

function renderAuditoriaPanel() {
  document.getElementById('modal-panel-auditoria').innerHTML =
    '<div class="settings-section-card">'
    + '<div class="settings-card-head"><div><h5>Auditoria de cartoes</h5><p>Verifica lancamentos de cartao sem alterar nenhum dado do banco.</p></div><button class="btn-add" style="margin-top:0" onclick="renderAuditoriaCartoes()">Auditar cartoes agora</button></div>'
    + '<div id="auditoria-cartoes-output" style="margin-top:16px"></div>'
    + '</div>';
}

async function renderUsuariosPanel() {
  const panel = document.getElementById('modal-panel-usuarios');
  if (!panel) return;

  if (!isAdminUser()) {
    var perfilAtual = accessTypeLabel(authProfile && authProfile.tipo_acesso);
    var tipoAtual = normalizeAccessType(authProfile && authProfile.tipo_acesso);
    var limiteAtual = getClientLimit();
    var resumoAcesso = '<div class="settings-card-badges" style="margin:0 0 16px 0">'
      + '<span class="settings-card-badge">' + esc(perfilAtual) + '</span>'
      + '<span class="settings-card-badge subtle">' + (limiteAtual === Infinity ? 'Clientes ilimitados' : ('Limite de ' + limiteAtual + ' cliente' + (limiteAtual === 1 ? '' : 's'))) + '</span>'
      + '</div>';
    var profileOptions = [];
    if (tipoAtual !== 'usuario') profileOptions.push('<option value="usuario">Usuario</option>');
    if (tipoAtual !== 'consultor') profileOptions.push('<option value="consultor">Consultor</option>');
    if (tipoAtual !== 'master') profileOptions.push('<option value="master">Master</option>');
    var solicitacaoAtual = authProfile && authProfile.solicitacao_tipo_acesso
      ? '<p style="color:var(--muted);font-size:.8rem;margin-top:12px">Solicitacao atual: <strong style="color:var(--text)">' + esc(accessTypeLabel(authProfile.solicitacao_tipo_acesso)) + '</strong>'
        + (authProfile.solicitacao_perfil_em ? ' em ' + esc(formatDate(authProfile.solicitacao_perfil_em)) : '')
        + '.</p>'
      : '';
    panel.innerHTML =
      '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>Minha conta</h5><p>Seu perfil atual: <strong style="color:var(--text)">' + esc(perfilAtual) + '</strong>. Se precisar ajustar seu acesso, envie uma solicitacao para um usuario Master.</p></div></div>'
      + resumoAcesso
      + '<div class="settings-user-request">'
      + '<div class="form-group"><label>Perfil solicitado</label><select id="perfil-solicitado">' + profileOptions.join('') + '</select></div>'
      + '<div class="form-group"><label>Motivo</label><textarea id="perfil-solicitacao-motivo" rows="4" placeholder="Explique por que voce precisa desse perfil."></textarea></div>'
      + '<button class="btn-add" style="margin-top:6px" onclick="solicitarAlteracaoPerfil()">Enviar solicitacao</button>'
      + solicitacaoAtual
      + '</div>'
      + '</div>';
    return;
  }

  panel.innerHTML = '<p style="color:var(--muted);font-size:.83rem">Carregando usuarios...</p>';

  const { data: perfis, error } = await supabaseClient
    .from('perfis')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    panel.innerHTML = '<p style="color:var(--danger);font-size:.83rem">Nao foi possivel carregar usuarios. Rode a migracao de perfis no Supabase.</p>';
    console.error(error);
    return;
  }

  panel.innerHTML =
    '<div class="settings-section-card">'
    + '<div class="settings-card-head"><div><h5>Perfis de acesso</h5><p>Gerencie perfil, limite de clientes, plano, status e solicitacoes pendentes.</p></div></div>'
    + '<div class="user-table-wrap settings-table-wrap"><table><thead><tr><th>Usuario</th><th>Tipo</th><th>Limite</th><th>Plano</th><th>Status</th><th>Solicitacao</th><th></th></tr></thead><tbody>'
    + (perfis || []).map(function(p) {
      var id = esc(p.id);
      var tipoAtual = normalizeAccessType(p.tipo_acesso);
      var limiteAtual = Number.isFinite(Number(p.limite_clientes)) ? Number(p.limite_clientes) : defaultClientLimitForRole(tipoAtual);
      var solicitacao = p.solicitacao_tipo_acesso
        ? '<strong>' + esc(accessTypeLabel(p.solicitacao_tipo_acesso)) + '</strong>'
          + (p.solicitacao_perfil_motivo ? '<br><span style="color:var(--muted);font-size:.72rem">' + esc(p.solicitacao_perfil_motivo) + '</span>' : '')
          + (p.solicitacao_perfil_em ? '<br><span style="color:var(--muted);font-size:.72rem">' + esc(formatDate(p.solicitacao_perfil_em)) + '</span>' : '')
        : '<span style="color:var(--muted);font-size:.72rem">Sem solicitacao</span>';
      return '<tr>'
        + '<td><strong>' + esc(p.nome || p.email || '-') + '</strong><br><span style="color:var(--muted);font-size:.72rem">' + esc(p.email || '-') + (p.telefone ? ' · ' + esc(p.telefone) : '') + '</span></td>'
        + '<td><select id="usr-tipo-' + id + '"><option value="usuario"' + (tipoAtual === 'usuario' ? ' selected' : '') + '>Usuario</option><option value="consultor"' + (tipoAtual === 'consultor' ? ' selected' : '') + '>Consultor</option><option value="master"' + (tipoAtual === 'master' ? ' selected' : '') + '>Master</option></select></td>'
        + '<td><input id="usr-limite-' + id + '" type="number" min="0" value="' + limiteAtual + '"/></td>'
        + '<td><input id="usr-plano-' + id + '" value="' + esc(p.plano || 'gratuito') + '"/></td>'
        + '<td><select id="usr-status-' + id + '"><option value="ativo"' + (p.status === 'ativo' ? ' selected' : '') + '>Ativo</option><option value="teste"' + (p.status === 'teste' ? ' selected' : '') + '>Teste</option><option value="bloqueado"' + (p.status === 'bloqueado' ? ' selected' : '') + '>Bloqueado</option></select></td>'
        + '<td>' + solicitacao + '</td>'
        + '<td><button class="btn-sm" onclick="salvarPerfilUsuario(\'' + id + '\')">Salvar</button></td>'
        + '</tr>';
    }).join('')
    + '</tbody></table></div>'
    + '</div>';
}

async function salvarPerfilUsuario(id) {
  if (!isAdminUser()) return alert('Apenas o Master pode alterar perfis.');

  const tipo = normalizeAccessType(document.getElementById('usr-tipo-' + id).value);
  const limite = parseInt(document.getElementById('usr-limite-' + id).value, 10);
  const plano = document.getElementById('usr-plano-' + id).value.trim() || 'gratuito';
  const status = document.getElementById('usr-status-' + id).value;
  const limiteFinal = Number.isFinite(limite) ? limite : defaultClientLimitForRole(tipo);

  const { error } = await supabaseClient
    .from('perfis')
    .update({
      tipo_acesso: tipo,
      limite_clientes: limiteFinal,
      plano: plano,
      status: status,
      solicitacao_tipo_acesso: null,
      solicitacao_perfil_motivo: null,
      solicitacao_perfil_em: null
    })
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Nao foi possivel salvar o usuario.');
    return;
  }

  alert('Perfil atualizado.');
  await loadAuthProfile();
  renderUsuariosPanel();
}

async function solicitarAlteracaoPerfil() {
  if (!authUser || !authUser.id) {
    alert('Usuario nao autenticado.');
    return;
  }

  var tipoSolicitadoEl = document.getElementById('perfil-solicitado');
  var motivoEl = document.getElementById('perfil-solicitacao-motivo');
  var tipoSolicitado = normalizeAccessType(tipoSolicitadoEl ? tipoSolicitadoEl.value : 'usuario');
  var motivo = motivoEl ? motivoEl.value.trim() : '';

  if (!motivo) {
    alert('Explique o motivo da solicitacao.');
    return;
  }

  const { error } = await supabaseClient
    .from('perfis')
    .update({
      solicitacao_tipo_acesso: tipoSolicitado,
      solicitacao_perfil_motivo: motivo,
      solicitacao_perfil_em: new Date().toISOString()
    })
    .eq('id', authUser.id);

  if (error) {
    console.error(error);
    alert('Nao foi possivel enviar a solicitacao.');
    return;
  }

  await loadAuthProfile();
  alert('Solicitacao enviada ao Master.');
  renderUsuariosPanel();
}

function renderCatsPanel(tipo) {
  if (!activeClient || !data.clients || !data.clients[activeClient]) {
    document.getElementById('modal-panel-cats_' + (tipo === 'cc' ? 'cc' : 'cartao')).innerHTML =
      '<p style="color:var(--muted);font-size:.83rem">Selecione um cliente para personalizar as categorias dele.</p>';
    return;
  }

  var cats = tipo === 'cc' ? loadCatsCC() : loadCatsCartao();
  var pid = 'modal-panel-cats_' + (tipo === 'cc' ? 'cc' : 'cartao');
  var TIPOS_DRE = { receita: 'Receita', fixa: 'Fixa', variavel: 'Variavel', transferencia: 'Transferencia' };
  var clienteNome = (data.clients[activeClient] && data.clients[activeClient].name) || 'cliente atual';

  var tagHtml = '';
  if (tipo === 'cc') {
    tagHtml = cats.map(function(c, i) {
      var nome = c.nome || c;
      var tipoCatVal = c.tipo || 'variavel';
      var fixa = !!c.fixa;
      return '<div class="settings-cat-item">'
        + '<div class="settings-cat-main"><span class="settings-cat-name">' + esc(nome) + '</span>'
        + '<span class="settings-cat-flag">' + (fixa ? 'Padrao do sistema' : 'Editavel') + '</span></div>'
        + '<div class="settings-cat-actions">'
        + '<select onchange="setCatTipo(\'cc\',' + i + ',this.value)"' + (fixa ? ' disabled' : '') + ' class="settings-cat-select">'
        + Object.keys(TIPOS_DRE).map(function(k) {
            return '<option value="' + k + '"' + (tipoCatVal === k ? ' selected' : '') + '>' + TIPOS_DRE[k] + '</option>';
          }).join('')
        + '</select>'
        + (fixa ? '' : '<button class="btn-icon" type="button" onclick="openEditCategoryModal(\'cc\',' + i + ')" title="Editar categoria">&#9998;</button>')
        + (fixa ? '' : '<button class="tag-del" onclick="deleteCategory(\'cc\',' + i + ')">x</button>')
        + '</div></div>';
    }).join('');
  } else {
    tagHtml = cats.map(function(c, i) {
      return '<div class="settings-cat-item">'
        + '<div class="settings-cat-main"><span class="settings-cat-name">' + esc(c) + '</span><span class="settings-cat-flag">Editavel</span></div>'
        + '<div class="settings-cat-actions">'
        + '<button class="btn-icon" type="button" onclick="openEditCategoryModal(\'cartao\',' + i + ')" title="Editar categoria">&#9998;</button>'
        + '<button class="tag-del" onclick="deleteCategory(\'cartao\',' + i + ')">x</button>'
        + '</div></div>';
    }).join('');
  }

  var desc = tipo === 'cc'
    ? 'Categorias da <strong style="color:var(--text)">Conta Corrente</strong> de <strong style="color:var(--text)">' + esc(clienteNome) + '</strong>. Defina o tipo para classificar corretamente no <strong style="color:var(--text)">DRE</strong>.'
    : 'Categorias dos lancamentos do <strong style="color:var(--text)">Cartao de Credito</strong> de <strong style="color:var(--text)">' + esc(clienteNome) + '</strong>. Entram como despesa variavel no DRE.';
  var clienteTipo = data.clients[activeClient] && data.clients[activeClient].tipoCliente ? clientTypeLabel(data.clients[activeClient].tipoCliente) : 'Cliente';
  var totalCats = cats.length;

  document.getElementById(pid).innerHTML =
    '<div class="settings-section-card">'
    + '<div class="settings-card-head"><div><h5>' + (tipo === 'cc' ? 'Categorias da conta corrente' : 'Categorias do cartao') + '</h5><p>' + desc + '</p></div><div class="settings-card-badges"><span class="settings-card-badge">' + esc(clienteTipo) + '</span><span class="settings-card-badge subtle">' + totalCats + ' categorias</span></div></div>'
    + '<div class="settings-cat-grid" id="tagList-' + tipo + '">' + tagHtml + '</div>'
    + '<div class="tag-input-row settings-tag-input-row">'
    + '<input type="text" id="newCatInput-' + tipo + '" placeholder="Nova categoria..." onkeydown="if(event.key===\'Enter\')addCategory(\'' + tipo + '\')"/>'
    + '<button onclick="addCategory(\'' + tipo + '\')">Adicionar</button>'
    + '</div>'
    + '<div class="settings-card-footer">'
    + '<button class="btn-sm red" onclick="resetCategories(\'' + tipo + '\')">&#8634; Restaurar padrao</button>'
    + '</div>'
    + '</div>';
}

function setCatTipo(tipo, i, novoTipo) {
  var cats = loadCatsCC();
  if (cats[i] && cats[i].fixa) return;
  if (!cats[i] || typeof cats[i] === 'string') cats[i] = { nome: cats[i] || '', tipo: novoTipo };
  else cats[i].tipo = novoTipo;
  saveCatsCC(cats);
  renderCatsPanel('cc');
  refreshCategoryConsumers('cc');
}

function refreshCategoryConsumers(tipo) {
  if (typeof activeTab === 'undefined') return;

  if (tipo === 'cartao' && activeTab === 'cartao' && typeof renderCartao === 'function') {
    renderCartao();
    return;
  }

  if (tipo === 'cc' && activeTab === 'extrato' && typeof renderExtrato === 'function') {
    renderExtrato();
  }
}

function addCategory(tipo) {
  var inp = document.getElementById('newCatInput-' + tipo);
  var val = ((inp && inp.value) || '').trim();
  if (!val) return;

  if (tipo === 'cc') {
    var cats = loadCatsCC();
    if (cats.find(function(c) { return normalizarNomeCategoria(c.nome || c) === normalizarNomeCategoria(val); })) return alert('Categoria ja existe.');
    cats.push({ nome: val, tipo: 'variavel' });
    saveCatsCC(cats);
  } else {
    var carts = loadCatsCartao();
    if (carts.find(function(c) { return normalizarNomeCategoria(c) === normalizarNomeCategoria(val); })) return alert('Categoria ja existe.');
    carts.push(val);
    saveCatsCartao(carts);
  }

  if (inp) inp.value = '';
  renderCatsPanel(tipo);
  refreshCategoryConsumers(tipo);
}

function deleteCategory(tipo, i) {
  if (tipo === 'cc') {
    var cats = loadCatsCC();
    if (cats[i] && cats[i].fixa) return;
    cats.splice(i, 1);
    saveCatsCC(cats);
  } else {
    var carts = loadCatsCartao();
    carts.splice(i, 1);
    saveCatsCartao(carts);
  }
  renderCatsPanel(tipo);
  refreshCategoryConsumers(tipo);
}

function toggleTheme(isDark) {
  var theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fb_theme', theme);
  syncSidebarThemeToggle();
}

function syncSidebarThemeToggle() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var toggle = document.getElementById('sidebarThemeToggle');
  var text = document.getElementById('sidebarThemeText');
  if (toggle) toggle.checked = isDark;
  if (text) text.textContent = isDark ? 'Tema escuro' : 'Tema claro';
}

function openEditCategoryModal(tipo, i) {
  var cats = tipo === 'cc' ? loadCatsCC() : loadCatsCartao();
  var cat = cats[i];
  if (!cat) return;
  if (tipo === 'cc' && cat.fixa) return;

  var nome = tipo === 'cc' ? (cat.nome || '') : String(cat || '');
  var tipoAtual = tipo === 'cc' ? (cat.tipo || 'variavel') : '';

  document.getElementById('modalTitle').textContent = 'Editar categoria';
  document.getElementById('modalBody').innerHTML =
    '<div class="form-row">'
    + '<div class="form-group"><label>Nome</label><input type="text" id="cat-edit-nome" value="' + esc(nome) + '" placeholder="Nome da categoria"/></div>'
    + (tipo === 'cc'
      ? '<div class="form-group" style="max-width:180px"><label>Tipo</label><select id="cat-edit-tipo"><option value="receita"' + (tipoAtual === 'receita' ? ' selected' : '') + '>Receita</option><option value="fixa"' + (tipoAtual === 'fixa' ? ' selected' : '') + '>Fixa</option><option value="variavel"' + (tipoAtual === 'variavel' ? ' selected' : '') + '>Variavel</option><option value="transferencia"' + (tipoAtual === 'transferencia' ? ' selected' : '') + '>Transferencia</option></select></div>'
      : '')
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px">'
    + '<button class="btn-sm red" type="button" onclick="renderSettingsModal(\'' + (tipo === 'cc' ? 'cats_cc' : 'cats_cartao') + '\')">Cancelar</button>'
    + '<button class="btn-add" type="button" style="margin-top:0" onclick="saveCategoryEdit(\'' + tipo + '\',' + i + ')">Salvar alteracoes</button>'
    + '</div>';
}

async function renomearCategoriaEmLancamentos(tipo, nomeAntigo, nomeNovo) {
  if (!nomeAntigo || !nomeNovo) return;
  if (normalizarNomeCategoria(nomeAntigo) === normalizarNomeCategoria(nomeNovo)) return;
  if (!activeClient || !data.clients || !data.clients[activeClient]) return;

  var cliente = data.clients[activeClient];
  var lista = tipo === 'cc' ? (cliente.extrato || []) : (cliente.cartao || []);
  lista.forEach(function(item) {
    if (normalizarNomeCategoria(item.cat) === normalizarNomeCategoria(nomeAntigo)) item.cat = nomeNovo;
  });
  if (typeof saveData === 'function') saveData();

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    var tabela = tipo === 'cc' ? 'lancamentos' : 'lancamentos_cartao';
    var query = supabaseClient
      .from(tabela)
      .update({ categoria: nomeNovo })
      .eq('cliente_id', activeClient)
      .eq('categoria', nomeAntigo);
    query = typeof applyUserScope === 'function' ? applyUserScope(query) : query;
    var resposta = await query;
    if (resposta && resposta.error) throw new Error(resposta.error.message || 'Erro ao atualizar categoria.');
  }
}

async function saveCategoryEdit(tipo, i) {
  var nome = (document.getElementById('cat-edit-nome').value || '').trim();
  if (!nome) return alert('Informe o nome da categoria.');

  if (tipo === 'cc') {
    var cats = loadCatsCC();
    var atual = cats[i];
    if (!atual || atual.fixa) return;
    if (cats.some(function(c, idx) { return idx !== i && normalizarNomeCategoria(c.nome || c) === normalizarNomeCategoria(nome); })) return alert('Categoria ja existe.');

    var nomeAntigo = atual.nome || '';
    atual.nome = nome;
    atual.tipo = document.getElementById('cat-edit-tipo').value || 'variavel';
    cats[i] = atual;
    await Promise.resolve(saveCatsCC(cats));

    try {
      await renomearCategoriaEmLancamentos('cc', nomeAntigo, nome);
      if (typeof loadData === 'function') await loadData();
      renderSettingsModal('cats_cc');
      refreshCategoryConsumers('cc');
    } catch (err) {
      alert('Nao foi possivel renomear a categoria nos lancamentos: ' + err.message);
    }
    return;
  }

  var carts = loadCatsCartao();
  if (!carts[i]) return;
  if (carts.some(function(c, idx) { return idx !== i && normalizarNomeCategoria(c) === normalizarNomeCategoria(nome); })) return alert('Categoria ja existe.');

  var nomeAntigoCartao = String(carts[i] || '');
  carts[i] = nome;
  await Promise.resolve(saveCatsCartao(carts));

  try {
    await renomearCategoriaEmLancamentos('cartao', nomeAntigoCartao, nome);
    if (typeof loadData === 'function') await loadData();
    renderSettingsModal('cats_cartao');
    refreshCategoryConsumers('cartao');
  } catch (err2) {
    alert('Nao foi possivel renomear a categoria nos lancamentos: ' + err2.message);
  }
}

async function resetCategories(tipo) {
  if (!(await appConfirm('Restaurar categorias padrao?', { title: 'Restaurar categorias', confirmText: 'Restaurar' }))) return;
  if (tipo === 'cc') await Promise.resolve(saveCatsCC(DC_CC.map(function(c) { return Object.assign({}, c); })));
  else await Promise.resolve(saveCatsCartao(DC_CART.slice()));
  renderCatsPanel(tipo);
  refreshCategoryConsumers(tipo);
}
