// ════════════════════════════════════════════════════
// SETTINGS.JS — Modal Configurações e Backup
// ════════════════════════════════════════════════════

function openModal(section, tab) {
  document.getElementById('modalOverlay').classList.add('open');
  section === 'settings' ? renderSettingsModal(tab) : renderBackupModal();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function renderBackupModal() {
  document.getElementById('modalTitle').textContent = '💾 Backup';
  document.getElementById('modalBody').innerHTML =
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:18px">Exporte todos os dados como JSON ou restaure a partir de um arquivo salvo.</p>'
    + '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<button class="btn-add" style="margin-top:0;padding:10px 18px" onclick="exportData()">⬇ Exportar dados (JSON)</button>'
    + '<button class="btn-sm" style="padding:9px 18px;font-size:.83rem" onclick="document.getElementById(\'importFileInput\').click()">⬆ Importar dados (JSON)</button>'
    + '</div>';
}

function exportData() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
  a.download = 'granafy_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importData(event) {
  var file = event.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var imp = JSON.parse(e.target.result);
      if (!imp.clients) throw new Error('Estrutura inválida.');
      if (!confirm('Importar? Substituirá os dados atuais.')) return;
      data = imp; saveData(); activeClient = null;
      document.getElementById('clientTitle').textContent = 'Selecione um cliente';
      document.getElementById('toggleLabel').textContent = 'Selecionar cliente…';
      document.getElementById('toggleAvatar').style.display = 'none';
      renderClientList();
      ['cartao-content','dividas-content','extrato-content','resumo-content','dre-content','graficos-content'].forEach(id => {
        document.getElementById(id).innerHTML = '<div class="empty-state"><div class="icon">👈</div>Selecione um cliente.</div>';
      });
      closeModal(); alert('Dados importados com sucesso!');
    } catch(err) { alert('Erro ao importar: ' + err.message); }
  };
  reader.readAsText(file); event.target.value = '';
}

async function importData(event) {
  var file = event.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var uid = typeof currentUserId === 'function' ? currentUserId() : null;
      if (!uid) throw new Error('Entre com o login do cliente antes de importar o backup.');

      var imp = JSON.parse(e.target.result);
      if (!imp.clients) throw new Error('Estrutura invalida.');
      if (!(await appConfirm('Importar este JSON para o Supabase no login atual? Dados iguais serao ignorados para evitar duplicidade.', { title: 'Importar backup', confirmText: 'Importar' }))) return;

      var resumo = await importarBackupJsonParaSupabase(imp);
      await loadData();
      renderClientList();
      if (typeof clearActiveClientView === 'function') clearActiveClientView();

      closeModal();
      alert('Backup importado para o Supabase!\n\n'
        + 'Clientes criados: ' + resumo.clientes + '\n'
        + 'Dividas: ' + resumo.dividas + '\n'
        + 'Lancamentos do extrato: ' + resumo.lancamentos + '\n'
        + 'Cartoes: ' + resumo.cartoes + '\n'
        + 'Lancamentos de cartao: ' + resumo.lancamentosCartao + '\n'
        + 'Ignorados por duplicidade: ' + resumo.ignorados);
    } catch(err) {
      alert('Erro ao importar: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

async function importarBackupJsonParaSupabase(backup) {
  var resumo = { clientes: 0, dividas: 0, lancamentos: 0, cartoes: 0, lancamentosCartao: 0, ignorados: 0 };
  var clientes = backup.clients || {};

  for (const [, cliente] of Object.entries(clientes)) {
    var nomeCliente = String(cliente.name || '').trim();
    if (!nomeCliente) continue;

    var clienteId = await garantirClienteImportado(nomeCliente, resumo);
    var mapaCartoes = await importarCartoesCliente(clienteId, cliente.cartoes || [], resumo);

    await importarDividasCliente(clienteId, cliente.dividas || [], resumo);
    await importarExtratoCliente(clienteId, cliente.extrato || [], resumo);
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

async function importarExtratoCliente(clienteId, lancamentos, resumo) {
  for (const l of lancamentos) {
    var payload = {
      cliente_id: clienteId,
      data_lancamento: l.data || l.data_lancamento || null,
      descricao: l.desc || l.descricao || null,
      categoria: l.cat || l.categoria || null,
      tipo: l.tipo || null,
      valor: Number(l.valor || 0)
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
  document.getElementById('modalTitle').textContent = '⚙️ Configurações';
  document.getElementById('modalBody').innerHTML =
    '<div class="modal-tabs" id="settingsTabs">'
    + '<button class="modal-tab" data-stab="cats_cc"     onclick="switchSettingsTab(\'cats_cc\')">🏦 Categorias Conta Corrente</button>'
    + '<button class="modal-tab" data-stab="cats_cartao" onclick="switchSettingsTab(\'cats_cartao\')">💳 Categorias Cartão</button>'
    + (isAdminUser() ? '<button class="modal-tab" data-stab="usuarios" onclick="switchSettingsTab(\'usuarios\')">Usuários</button>' : '')
    + '<button class="modal-tab" data-stab="auditoria"   onclick="switchSettingsTab(\'auditoria\')">Auditoria</button>'
    + '<button class="modal-tab" data-stab="tema"        onclick="switchSettingsTab(\'tema\')">🎨 Tema</button>'
    + '</div>'
    + '<div id="modal-panel-cats_cc"     class="modal-panel"></div>'
    + '<div id="modal-panel-cats_cartao" class="modal-panel"></div>'
    + '<div id="modal-panel-usuarios"    class="modal-panel"></div>'
    + '<div id="modal-panel-auditoria"   class="modal-panel"></div>'
    + '<div id="modal-panel-tema"        class="modal-panel"></div>';
  switchSettingsTab(activeTabKey || 'cats_cc');
}

function switchSettingsTab(tab) {
  document.querySelectorAll('#settingsTabs .modal-tab').forEach(b => b.classList.toggle('active', b.dataset.stab === tab));
  document.querySelectorAll('#modalBody .modal-panel').forEach(p => p.classList.remove('active'));
  var panel = document.getElementById('modal-panel-' + tab); if (!panel) return;
  panel.classList.add('active');
  if (tab === 'cats_cc')     renderCatsPanel('cc');
  if (tab === 'cats_cartao') renderCatsPanel('cartao');
  if (tab === 'usuarios')    renderUsuariosPanel();
  if (tab === 'auditoria')   renderAuditoriaPanel();
  if (tab === 'tema')        renderTemaPanel();
}

function renderAuditoriaPanel() {
  document.getElementById('modal-panel-auditoria').innerHTML =
    '<p style="color:var(--muted);font-size:.83rem;margin-bottom:13px">Verifica lançamentos de cartão sem alterar nenhum dado no banco.</p>'
    + '<button class="btn-add" style="margin-top:0" onclick="renderAuditoriaCartoes()">Auditar cartões agora</button>'
    + '<div id="auditoria-cartoes-output"></div>';
}

async function renderUsuariosPanel() {
  const panel = document.getElementById('modal-panel-usuarios');
  if (!panel) return;

  if (!isAdminUser()) {
    panel.innerHTML = '<p style="color:var(--muted);font-size:.83rem">Apenas administradores podem visualizar usuários.</p>';
    return;
  }

  panel.innerHTML = '<p style="color:var(--muted);font-size:.83rem">Carregando usuários...</p>';

  const { data: perfis, error } = await supabaseClient
    .from('perfis')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    panel.innerHTML = '<p style="color:var(--danger);font-size:.83rem">Não foi possível carregar usuários. Rode a migração de perfis no Supabase.</p>';
    console.error(error);
    return;
  }

  panel.innerHTML =
    '<p style="color:var(--muted);font-size:.83rem;margin-bottom:13px">Gerencie tipo de acesso, limite de clientes, plano e status.</p>'
    + '<div class="user-table-wrap"><table><thead><tr><th>Usuário</th><th>Tipo</th><th>Limite</th><th>Plano</th><th>Status</th><th></th></tr></thead><tbody>'
    + (perfis || []).map(p => {
      var id = esc(p.id);
      return '<tr>'
        + '<td><strong>' + esc(p.nome || p.email || '-') + '</strong><br><span style="color:var(--muted);font-size:.72rem">' + esc(p.email || '-') + (p.telefone ? ' · ' + esc(p.telefone) : '') + '</span></td>'
        + '<td><select id="usr-tipo-' + id + '"><option value="cliente"' + (p.tipo_acesso === 'cliente' ? ' selected' : '') + '>Cliente</option><option value="admin"' + (p.tipo_acesso === 'admin' ? ' selected' : '') + '>Admin</option></select></td>'
        + '<td><input id="usr-limite-' + id + '" type="number" min="0" value="' + Number(p.limite_clientes || 0) + '"/></td>'
        + '<td><input id="usr-plano-' + id + '" value="' + esc(p.plano || 'gratuito') + '"/></td>'
        + '<td><select id="usr-status-' + id + '"><option value="ativo"' + (p.status === 'ativo' ? ' selected' : '') + '>Ativo</option><option value="teste"' + (p.status === 'teste' ? ' selected' : '') + '>Teste</option><option value="bloqueado"' + (p.status === 'bloqueado' ? ' selected' : '') + '>Bloqueado</option></select></td>'
        + '<td><button class="btn-sm" onclick="salvarPerfilUsuario(\'' + id + '\')">Salvar</button></td>'
        + '</tr>';
    }).join('')
    + '</tbody></table></div>';
}

async function salvarPerfilUsuario(id) {
  if (!isAdminUser()) return alert('Apenas administradores podem alterar usuários.');

  const tipo = document.getElementById('usr-tipo-' + id).value;
  const limite = parseInt(document.getElementById('usr-limite-' + id).value, 10);
  const plano = document.getElementById('usr-plano-' + id).value.trim() || 'gratuito';
  const status = document.getElementById('usr-status-' + id).value;

  const { error } = await supabaseClient
    .from('perfis')
    .update({
      tipo_acesso: tipo,
      limite_clientes: Number.isFinite(limite) ? limite : 1,
      plano,
      status
    })
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Não foi possível salvar o usuário.');
    return;
  }

  alert('Usuário atualizado.');
  await loadAuthProfile();
  renderUsuariosPanel();
}

function renderCatsPanel(tipo) {
  var cats = tipo === 'cc' ? loadCatsCC() : loadCatsCartao();
  var pid  = 'modal-panel-cats_' + (tipo === 'cc' ? 'cc' : 'cartao');
  var TIPOS_DRE = { receita: '🟢 Receita', fixa: '🔴 Fixa', variavel: '🟡 Variável' };

  var tagHtml;
  if (tipo === 'cc') {
    // Categorias CC têm tipo DRE editável
    tagHtml = cats.map((c, i) => {
      var nome = c.nome || c, tipoCatVal = c.tipo || 'variavel';
      return '<div class="tag-item" style="gap:8px">'
        + '<span>' + esc(nome) + '</span>'
        + '<select onchange="setCatTipo(\'cc\',' + i + ',this.value)" style="background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.72rem;padding:2px 5px;border-radius:5px;outline:none">'
        + Object.entries(TIPOS_DRE).map(([k,v]) => '<option value="' + k + '"' + (tipoCatVal===k?' selected':'') + '>' + v + '</option>').join('')
        + '</select>'
        + '<button class="tag-del" onclick="deleteCategory(\'cc\',' + i + ')">✕</button>'
        + '</div>';
    }).join('');
  } else {
    tagHtml = (cats).map((c, i) => '<div class="tag-item">' + esc(c) + '<button class="tag-del" onclick="deleteCategory(\'cartao\',' + i + ')">✕</button></div>').join('');
  }

  var desc = tipo === 'cc'
    ? 'Categorias da <strong style="color:var(--text)">Conta Corrente</strong>. Defina o tipo para classificar corretamente no <strong style="color:var(--text)">DRE</strong>.'
    : 'Categorias dos lançamentos do <strong style="color:var(--text)">Cartão de Crédito</strong>. Entram como Despesa Variável no DRE.';

  document.getElementById(pid).innerHTML =
    '<p style="color:var(--muted);font-size:.83rem;margin-bottom:13px">' + desc + '</p>'
    + '<div class="tag-list" id="tagList-' + tipo + '">' + tagHtml + '</div>'
    + '<div class="tag-input-row">'
    + '<input type="text" id="newCatInput-' + tipo + '" placeholder="Nova categoria…" onkeydown="if(event.key===\'Enter\')addCategory(\'' + tipo + '\')"/>'
    + '<button onclick="addCategory(\'' + tipo + '\')">Adicionar</button>'
    + '</div>'
    + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">'
    + '<button class="btn-sm red" onclick="resetCategories(\'' + tipo + '\')">↺ Restaurar padrão</button>'
    + '</div>';
}

function setCatTipo(tipo, i, novoTipo) {
  var cats = loadCatsCC();
  if (!cats[i] || typeof cats[i] === 'string') cats[i] = { nome: cats[i] || '', tipo: novoTipo };
  else cats[i].tipo = novoTipo;
  saveCatsCC(cats);
}

function addCategory(tipo) {
  var inp = document.getElementById('newCatInput-' + tipo), val = inp.value.trim(); if (!val) return;
  if (tipo === 'cc') {
    var cats = loadCatsCC();
    if (cats.find(c => (c.nome||c) === val)) return alert('Categoria já existe.');
    cats.push({ nome: val, tipo: 'variavel' });
    saveCatsCC(cats);
  } else {
    var carts = loadCatsCartao();
    if (carts.includes(val)) return alert('Categoria já existe.');
    carts.push(val); saveCatsCartao(carts);
  }
  inp.value = ''; renderCatsPanel(tipo);
}

function deleteCategory(tipo, i) {
  if (tipo === 'cc') { var cats = loadCatsCC(); cats.splice(i,1); saveCatsCC(cats); }
  else { var carts = loadCatsCartao(); carts.splice(i,1); saveCatsCartao(carts); }
  renderCatsPanel(tipo);
}

async function resetCategories(tipo) {
  if (!(await appConfirm('Restaurar categorias padrao?', { title: 'Restaurar categorias', confirmText: 'Restaurar' }))) return;
  if (tipo === 'cc') saveCatsCC(DC_CC.map(c => ({...c})));
  else saveCatsCartao([...DC_CART]);
  renderCatsPanel(tipo);
}

function renderTemaPanel() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.getElementById('modal-panel-tema').innerHTML =
    '<div style="padding:4px 0">'
    + '<div class="theme-toggle-row">'
    + '<div class="ttr-info"><span>Tema escuro</span><small>Alterne entre tema escuro e claro</small></div>'
    + '<label class="toggle-switch">'
    + '<input type="checkbox" id="themeToggle" ' + (isDark ? 'checked' : '') + ' onchange="toggleTheme(this.checked)"/>'
    + '<span class="toggle-track"></span>'
    + '</label></div>'
    + '<div style="margin-top:14px;padding:12px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border)">'
    + '<p style="font-size:.82rem;color:var(--muted)">A preferência é salva automaticamente.</p>'
    + '</div></div>';
}

function toggleTheme(isDark) {
  var theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fb_theme', theme);
}
