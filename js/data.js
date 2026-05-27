// ════════════════════════════════════════════════════
// DATA.JS — SUPABASE (VERSÃO LIMPA)
// ════════════════════════════════════════════════════

var data = { clients: {} };
var activeClient = null;
var activeTab = 'cartao';

var TAB_DEFS = [
  { key: 'cartao', label: 'Cartão', contentId: 'cartao-content', render: () => renderCartao() },
  { key: 'dividas', label: 'Dívidas', contentId: 'dividas-content', render: () => renderDividas() },
  { key: 'extrato', label: 'Extrato', contentId: 'extrato-content', render: () => renderExtrato() },
  { key: 'financeiro', label: 'Financeiro', contentId: 'financeiro-content', render: () => renderFinanceiro(), visible: () => isActiveClientPJ() },
  { key: 'resumo', label: 'Resumo', contentId: 'resumo-content', render: () => renderResumo() },
  { key: 'dre', label: 'DRE', contentId: 'dre-content', render: () => renderDRE() },
  { key: 'graficos', label: 'Gráficos', contentId: 'graficos-content', render: () => renderGraficos() }
];

function isActiveClientPJ() {
  var cliente = activeClient && data && data.clients ? data.clients[activeClient] : null;
  return !!(cliente && String(cliente.tipoCliente || '').toLowerCase() === 'pj');
}

async function loadData() {
  data = { clients: {} };
  const uid = typeof currentUserId === 'function' ? currentUserId() : null;

  if (!uid) return;

  async function carregarComEscopo() {
    const [
      clientesRes,
      dividasRes,
      lancRes,
      cartoesRes,
      lancCartaoRes
    ] = await Promise.all([
      supabaseClient.from('clientes').select('*').order('nome', { ascending: true }),
      supabaseClient.from('dividas').select('*'),
      supabaseClient.from('lancamentos').select('*'),
      supabaseClient.from('cartoes').select('*'),
      supabaseClient.from('lancamentos_cartao').select('*')
    ]);

    return { clientesRes, dividasRes, lancRes, cartoesRes, lancCartaoRes };
  }

  async function carregarContasComEscopo() {
    var query = supabaseClient.from('contas').select('*');
    var res = await query.order('banco', { ascending: true });

    if (!res.error) return res;

    var msg = String((res.error.message || '') + ' ' + (res.error.details || '')).toLowerCase();
    var tabelaAusente = res.error.code === '42P01' || res.error.code === 'PGRST205' || msg.includes('relation') || msg.includes('schema cache');
    if (tabelaAusente && msg.includes('contas')) {
      console.warn('Tabela contas ainda nao existe no Supabase. Rode a migracao 20260419_contas_clientes.sql.');
      return { data: [], error: null };
    }

    return res;
  }

  async function carregarCategoriasComEscopo() {
    var query = supabaseClient.from('categorias_cliente').select('*');
    var res = await query.order('nome', { ascending: true });

    if (!res.error) return res;

    if (isCategoriasClienteTableMissing(res.error)) {
      console.warn('Tabela categorias_cliente ainda nao existe no Supabase. Rode a migracao 20260508_categorias_por_cliente.sql.');
      return { data: [], error: null };
    }

    return res;
  }

  async function carregarRelacionamentosComEscopo() {
    var query = supabaseClient.from('relacionamentos_cliente').select('*');
    var res = await query.order('nome', { ascending: true });

    if (!res.error) return res;

    var msg = String((res.error.message || '') + ' ' + (res.error.details || '') + ' ' + (res.error.hint || '')).toLowerCase();
    var tabelaAusente = res.error.code === '42P01' || res.error.code === 'PGRST205' || msg.includes('relation') || msg.includes('schema cache');
    if (tabelaAusente && msg.includes('relacionamentos_cliente')) {
      console.warn('Tabela relacionamentos_cliente ainda nao existe no Supabase. Rode a migracao 20260510_relacionamentos_extrato.sql.');
      return { data: [], error: null };
    }

    return res;
  }

  async function carregarTitulosComEscopo() {
    var query = supabaseClient.from('titulos_financeiros').select('*');
    var res = await query.order('vencimento', { ascending: true, nullsFirst: false });

    if (!res.error) return res;

    var msg = String((res.error.message || '') + ' ' + (res.error.details || '') + ' ' + (res.error.hint || '')).toLowerCase();
    var tabelaAusente = res.error.code === '42P01' || res.error.code === 'PGRST205' || msg.includes('relation') || msg.includes('schema cache');
    if (tabelaAusente && msg.includes('titulos_financeiros')) {
      console.warn('Tabela titulos_financeiros ainda nao existe no Supabase. Rode a migracao 20260520_titulos_financeiros_pj.sql.');
      return { data: [], error: null };
    }

    return res;
  }

  async function carregarBaixasTitulosComEscopo() {
    var query = supabaseClient.from('titulos_financeiros_baixas').select('*');
    var res = await query.order('data_baixa', { ascending: true, nullsFirst: false });

    if (!res.error) return res;

    var msg = String((res.error.message || '') + ' ' + (res.error.details || '') + ' ' + (res.error.hint || '')).toLowerCase();
    var tabelaAusente = res.error.code === '42P01' || res.error.code === 'PGRST205' || msg.includes('relation') || msg.includes('schema cache');
    if (tabelaAusente && msg.includes('titulos_financeiros_baixas')) {
      console.warn('Tabela titulos_financeiros_baixas ainda nao existe no Supabase. Rode a migracao 20260520_titulos_financeiros_pj.sql.');
      return { data: [], error: null };
    }

    return res;
  }

  async function carregarAcessosClientes() {
    var query = supabaseClient.from('clientes_acessos').select('*');
    var res = await query.order('created_at', { ascending: true });

    if (!res.error) return res;

    var msg = String((res.error.message || '') + ' ' + (res.error.details || '') + ' ' + (res.error.hint || '')).toLowerCase();
    var tabelaAusente = res.error.code === '42P01' || res.error.code === 'PGRST205' || msg.includes('relation') || msg.includes('schema cache');
    if (tabelaAusente && msg.includes('clientes_acessos')) {
      console.warn('Tabela clientes_acessos ainda nao existe no Supabase. Rode a migracao 20260521_acesso_compartilhado_clientes.sql.');
      return { data: [], error: null };
    }

    return res;
  }

  let { clientesRes, dividasRes, lancRes, cartoesRes, lancCartaoRes } = await carregarComEscopo();

  const loadError = clientesRes.error || dividasRes.error || lancRes.error || cartoesRes.error || lancCartaoRes.error;
  if (loadError) {
    console.error('Erro ao carregar dados do usuario:', loadError);
    alert('Nao foi possivel carregar os dados do usuario. Verifique se as migracoes mais recentes ja foram aplicadas no Supabase.');
    return;
  }

  const clientesRows = clientesRes.data || [];
  const dividasRows = dividasRes.data || [];
  const lancRows = lancRes.data || [];
  const cartoesRows = cartoesRes.data || [];
  const lancCartaoRows = lancCartaoRes.data || [];
  const contasRes = await carregarContasComEscopo();
  if (contasRes.error) {
    console.warn('Nao foi possivel carregar contas cadastradas:', contasRes.error);
  }
  const contasRows = contasRes.data || [];
  const categoriasRes = await carregarCategoriasComEscopo();
  if (categoriasRes.error) {
    console.warn('Nao foi possivel carregar categorias personalizadas:', categoriasRes.error);
  }
  const categoriasRows = categoriasRes.data || [];
  const relacionamentosRes = await carregarRelacionamentosComEscopo();
  if (relacionamentosRes.error) {
    console.warn('Nao foi possivel carregar relacionamentos personalizados:', relacionamentosRes.error);
  }
  const relacionamentosRows = relacionamentosRes.data || [];
  const titulosRes = await carregarTitulosComEscopo();
  if (titulosRes.error) {
    console.warn('Nao foi possivel carregar titulos financeiros:', titulosRes.error);
  }
  const titulosRows = titulosRes.data || [];
  const baixasTitulosRes = await carregarBaixasTitulosComEscopo();
  if (baixasTitulosRes.error) {
    console.warn('Nao foi possivel carregar baixas de titulos:', baixasTitulosRes.error);
  }
  const baixasTitulosRows = baixasTitulosRes.data || [];
  const acessosClientesRes = await carregarAcessosClientes();
  if (acessosClientesRes.error) {
    console.warn('Nao foi possivel carregar acessos compartilhados:', acessosClientesRes.error);
  }
  const acessosClientesRows = acessosClientesRes.data || [];

  const contasPorCliente = {};
  (contasRows || []).forEach(conta => {
    if (!contasPorCliente[conta.cliente_id]) contasPorCliente[conta.cliente_id] = [];
    contasPorCliente[conta.cliente_id].push({
      id: conta.id,
      tipo: conta.tipo || 'corrente',
      banco: conta.banco || '',
      agencia: conta.agencia || '',
      numero: conta.numero || '',
      userId: conta.user_id || null
    });
  });

  const catsCCPorCliente = {};
  const catsCartaoPorCliente = {};
  const catsFinanceiroPorCliente = {};
  (categoriasRows || []).forEach(cat => {
    if (!cat || !cat.cliente_id || !cat.nome) return;
    if (cat.escopo === 'cc') {
      if (!catsCCPorCliente[cat.cliente_id]) catsCCPorCliente[cat.cliente_id] = [];
      catsCCPorCliente[cat.cliente_id].push({
        nome: cat.nome,
        tipo: cat.tipo || 'variavel',
        fixa: !!cat.fixa
      });
      return;
    }

    if (cat.escopo === 'cartao') {
      if (!catsCartaoPorCliente[cat.cliente_id]) catsCartaoPorCliente[cat.cliente_id] = [];
      catsCartaoPorCliente[cat.cliente_id].push(cat.nome);
      return;
    }

    if (cat.escopo === 'financeiro') {
      if (!catsFinanceiroPorCliente[cat.cliente_id]) catsFinanceiroPorCliente[cat.cliente_id] = [];
      catsFinanceiroPorCliente[cat.cliente_id].push(cat.nome);
    }
  });

  const relacionamentosPorCliente = {};
  (relacionamentosRows || []).forEach(rel => {
    if (!rel || !rel.cliente_id || !rel.nome) return;
    if (!relacionamentosPorCliente[rel.cliente_id]) relacionamentosPorCliente[rel.cliente_id] = [];
    relacionamentosPorCliente[rel.cliente_id].push({
      id: rel.id,
      nome: rel.nome,
      tipo: rel.tipo || 'interno',
      palavrasChave: rel.palavras_chave || '',
      observacao: rel.observacao || '',
      userId: rel.user_id || null
    });
  });

  const dividasPorCliente = {};
  (dividasRows || []).forEach(d => {
    if (!dividasPorCliente[d.cliente_id]) dividasPorCliente[d.cliente_id] = [];
    dividasPorCliente[d.cliente_id].push({
      id: d.id,
      org: d.credor || '',
      tipo: d.tipo_divida || '',
      dataInicio: d.data_inicio || null,
      total: Number(d.valor_total || 0),
      parcelas: Number(d.parcelas_total || 0),
      valorParcela: Number(d.valor_parcela || 0),
      taxa: Number(d.taxa || 0),
      pago: Number(d.valor_pago || 0),
      restantes: Number(d.parcelas_restantes || 0),
      obs: d.observacoes || '',
      pagamentos: []
    });
  });

  const extratoPorCliente = {};
  (lancRows || []).forEach(l => {
    if (!extratoPorCliente[l.cliente_id]) extratoPorCliente[l.cliente_id] = [];
    extratoPorCliente[l.cliente_id].push({
      id: l.id,
      data: l.data || l.data_lancamento || null,
      desc: l.descricao || '',
      descOriginal: l.descricao_original || l.descricao || '',
      cat: l.categoria || '',
      tipo: l.tipo || '',
      valor: Number(l.valor || 0),
      contaId: l.conta_id || null,
      relacionamentoId: l.relacionamento_id || null,
      observacao: l.observacao || ''
    });
  });

  const cartoesPorCliente = {};
  (cartoesRows || []).forEach(cc => {
    if (!cartoesPorCliente[cc.cliente_id]) cartoesPorCliente[cc.cliente_id] = [];
    cartoesPorCliente[cc.cliente_id].push(cc);
  });

  const lancCartaoPorCliente = {};
  (lancCartaoRows || []).forEach(l => {
    if (!lancCartaoPorCliente[l.cliente_id]) lancCartaoPorCliente[l.cliente_id] = [];
    lancCartaoPorCliente[l.cliente_id].push({
      id: l.id,
      cartaoId: l.cartao_id || l.cartaoId || null,
      data: l.data || null,
      desc: l.descricao || l.desc || '',
      cat: l.categoria || l.cat || '',
      tipo: l.tipo || 'lancamento',
      valor: Number(l.valor || 0)
    });
  });

  const baixasPorTitulo = {};
  (baixasTitulosRows || []).forEach(b => {
    if (!b || !b.titulo_id) return;
    if (!baixasPorTitulo[b.titulo_id]) baixasPorTitulo[b.titulo_id] = [];
    baixasPorTitulo[b.titulo_id].push({
      id: b.id,
      data: b.data_baixa || null,
      valor: Number(b.valor || 0),
      observacao: b.observacao || '',
      origem: b.origem || 'manual',
      lancamentoId: b.extrato_lancamento_id || null,
      userId: b.user_id || null
    });
  });

  const titulosPorCliente = {};
  (titulosRows || []).forEach(t => {
    if (!t || !t.cliente_id) return;
    if (!titulosPorCliente[t.cliente_id]) titulosPorCliente[t.cliente_id] = [];
    titulosPorCliente[t.cliente_id].push({
      id: t.id,
      natureza: t.natureza || 'receber',
      pessoaNome: t.pessoa_nome || '',
      descricao: t.descricao || '',
      categoria: t.categoria || '',
      vencimento: t.vencimento || null,
      valorTotal: Number(t.valor_total || 0),
      observacao: t.observacao || '',
      createdAt: t.created_at || null,
      updatedAt: t.updated_at || null,
      baixas: baixasPorTitulo[t.id] || [],
      userId: t.user_id || null
    });
  });

  const acessosPorCliente = {};
  (acessosClientesRows || []).forEach(function(acesso) {
    if (!acesso || !acesso.cliente_id) return;
    if (!acessosPorCliente[acesso.cliente_id]) acessosPorCliente[acesso.cliente_id] = [];
    acessosPorCliente[acesso.cliente_id].push({
      id: acesso.id,
      usuarioId: acesso.usuario_id || null,
      email: acesso.email || '',
      nome: acesso.nome || '',
      papel: acesso.papel || 'visualizador',
      status: acesso.status || 'ativo',
      createdBy: acesso.created_by || null,
      createdAt: acesso.created_at || null
    });
  });

  (clientesRows || []).forEach(c => {
    data.clients[c.id] = {
      id: c.id,
      userId: c.user_id || null,
      name: c.nome || '',
      tipoCliente: c.tipo_cliente || 'pf',
      documento: c.documento || '',
      telefone: c.telefone || '',
      emailFinanceiro: c.email_financeiro || '',
      responsavel: c.responsavel || '',
      razaoSocial: c.razao_social || '',
      nomeFantasia: c.nome_fantasia || '',
      observacoes: c.observacoes || '',
      cartoes: cartoesPorCliente[c.id] || [],
      cartao: lancCartaoPorCliente[c.id] || [],
      contas: contasPorCliente[c.id] || [],
      relacionamentos: relacionamentosPorCliente[c.id] || [],
      titulos: titulosPorCliente[c.id] || [],
      acessos: acessosPorCliente[c.id] || [],
      dividas: dividasPorCliente[c.id] || [],
      extrato: extratoPorCliente[c.id] || [],
      catsCC: catsCCPorCliente[c.id] ? sincronizarCatsCC(catsCCPorCliente[c.id]) : loadCatsCC(c.id),
      catsCartao: catsCartaoPorCliente[c.id] ? sincronizarCatsCartao(catsCartaoPorCliente[c.id]) : loadCatsCartao(c.id),
      catsFinanceiro: catsFinanceiroPorCliente[c.id] ? sincronizarCatsFinanceiro(catsFinanceiroPorCliente[c.id]) : loadCatsFinanceiro(c.id)
    };
  });
}

function saveData() {
  // Não usamos mais localStorage
}

function tabOrderStorageKey() {
  var uid = typeof currentUserId === 'function' ? currentUserId() : 'anon';
  return 'granafy_tab_order_' + (uid || 'anon');
}

function getOrderedTabs() {
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem(tabOrderStorageKey())) || []; } catch (e) { saved = []; }

  var map = Object.fromEntries(TAB_DEFS.map(tab => [tab.key, tab]));
  var ordered = saved.filter(key => map[key]).map(key => map[key]);
  TAB_DEFS.forEach(tab => {
    if (!saved.includes(tab.key)) ordered.push(tab);
  });
  return ordered;
}

function saveTabOrder(keys) {
  try { localStorage.setItem(tabOrderStorageKey(), JSON.stringify(keys)); } catch (e) {}
}

function getVisibleTabs() {
  return getOrderedTabs().filter(function(tab) {
    return !tab.visible || tab.visible();
  });
}

function moveTabBefore(srcKey, dstKey) {
  if (!srcKey || !dstKey || srcKey === dstKey) return;

  var keys = getOrderedTabs().map(tab => tab.key);
  var from = keys.indexOf(srcKey);
  var to = keys.indexOf(dstKey);
  if (from < 0 || to < 0) return;

  keys.splice(from, 1);
  keys.splice(to, 0, srcKey);
  saveTabOrder(keys);
  renderTabs();
}

function renderTabs() {
  const container = document.getElementById('tabsContainer');
  if (!container) return;

  var visibleTabs = getVisibleTabs();
  if (!visibleTabs.length) return;
  if (!visibleTabs.some(function(tab) { return tab.key === activeTab; })) {
    activeTab = visibleTabs[0].key;
  }

  container.innerHTML = visibleTabs.map(tab =>
    '<button class="tab-btn' + (tab.key === activeTab ? ' active' : '') + '" draggable="true" data-tab="' + tab.key + '" onclick="switchTab(\'' + tab.key + '\')">' +
    tab.label +
    '</button>'
  ).join('');

  initTabDrag(container);

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + activeTab);
  });
}

function initTabDrag(container) {
  var dragKey = null;
  var pointer = null;
  var suppressClick = false;

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    btn.addEventListener('dragstart', e => {
      dragKey = btn.dataset.tab;
      btn.classList.add('tab-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    btn.addEventListener('dragend', () => {
      btn.classList.remove('tab-dragging');
      container.querySelectorAll('.tab-btn').forEach(item => item.classList.remove('tab-drag-over'));
      dragKey = null;
    });

    btn.addEventListener('dragover', e => {
      e.preventDefault();
      container.querySelectorAll('.tab-btn').forEach(item => item.classList.remove('tab-drag-over'));
      if (btn.dataset.tab !== dragKey) btn.classList.add('tab-drag-over');
    });

    btn.addEventListener('dragleave', () => btn.classList.remove('tab-drag-over'));

    btn.addEventListener('drop', e => {
      e.preventDefault();
      btn.classList.remove('tab-drag-over');
      moveTabBefore(dragKey, btn.dataset.tab);
    });

    btn.addEventListener('pointerdown', e => {
      pointer = { key: btn.dataset.tab, x: e.clientX, y: e.clientY, moved: false };
    });

    btn.addEventListener('pointermove', e => {
      if (!pointer || pointer.key !== btn.dataset.tab) return;
      if (Math.abs(e.clientX - pointer.x) > 24 || Math.abs(e.clientY - pointer.y) > 18) pointer.moved = true;
    });

    btn.addEventListener('pointerup', e => {
      if (!pointer || pointer.key !== btn.dataset.tab) return;
      var current = pointer;
      pointer = null;
      if (!current.moved) return;

      e.preventDefault();
      e.stopPropagation();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      var target = document.elementFromPoint(e.clientX, e.clientY);
      var targetBtn = target && target.closest ? target.closest('.tab-btn') : null;
      if (targetBtn) moveTabBefore(current.key, targetBtn.dataset.tab);
    });
  });
}

function switchTab(tabKey) {
  var visibleTabs = getVisibleTabs();
  activeTab = visibleTabs.find(function(tab) { return tab.key === tabKey; }) ? tabKey : (visibleTabs[0] ? visibleTabs[0].key : 'cartao');
  renderTabs();
  renderTab(activeTab);
}

function renderTab(tabKey) {
  const visibleTabs = getVisibleTabs();
  const tab = visibleTabs.find(function(item) { return item.key === tabKey; }) || visibleTabs[0] || TAB_DEFS[0];
  activeTab = tab.key;

  renderTabs();

  if (!activeClient || !data.clients[activeClient]) {
    const target = document.getElementById(tab.contentId);
    if (target) {
      target.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    }
    return;
  }

  tab.render();
}

(async function init() {
  const savedTheme = localStorage.getItem('fb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (typeof syncSidebarThemeToggle === 'function') syncSidebarThemeToggle();

  if (typeof requireAuthSession === 'function') {
    await requireAuthSession();
  }

  await loadData();
  renderTabs();
  renderClientList();
  if (typeof renderAuthUser === 'function') renderAuthUser();

  const saved = localStorage.getItem(activeClientStorageKey());
  if (saved && data.clients[saved]) {
    selectClient(saved);
  } else {
    localStorage.removeItem(activeClientStorageKey());
    if (typeof clearActiveClientView === 'function') clearActiveClientView();
  }

  document.addEventListener('click', e => {
    const wrap = document.getElementById('clientDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
      const menu = document.getElementById('clientDropdownMenu');
      const toggle = document.getElementById('clientDropdownToggle');
      if (menu) menu.classList.remove('open');
      if (toggle) toggle.classList.remove('open');
    }
  });

  const input = document.getElementById('newClientName');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') addClient();
    });
  }
  if (typeof syncSidebarThemeToggle === 'function') syncSidebarThemeToggle();
})();
