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
  { key: 'resumo', label: 'Resumo', contentId: 'resumo-content', render: () => renderResumo() },
  { key: 'dre', label: 'DRE', contentId: 'dre-content', render: () => renderDRE() },
  { key: 'graficos', label: 'Gráficos', contentId: 'graficos-content', render: () => renderGraficos() }
];

async function loadData() {
  data = { clients: {} };
  const uid = typeof currentUserId === 'function' ? currentUserId() : null;

  if (!uid) return;

  async function carregarComEscopo(usarEscopo) {
    const filtrarUsuario = usarEscopo && !isAdminUser();
    const [
      clientesRes,
      dividasRes,
      lancRes,
      cartoesRes,
      lancCartaoRes
    ] = await Promise.all([
      (filtrarUsuario ? supabaseClient.from('clientes').select('*').eq('user_id', uid) : supabaseClient.from('clientes').select('*')).order('nome', { ascending: true }),
      filtrarUsuario ? supabaseClient.from('dividas').select('*').eq('user_id', uid) : supabaseClient.from('dividas').select('*'),
      filtrarUsuario ? supabaseClient.from('lancamentos').select('*').eq('user_id', uid) : supabaseClient.from('lancamentos').select('*'),
      filtrarUsuario ? supabaseClient.from('cartoes').select('*').eq('user_id', uid) : supabaseClient.from('cartoes').select('*'),
      filtrarUsuario ? supabaseClient.from('lancamentos_cartao').select('*').eq('user_id', uid) : supabaseClient.from('lancamentos_cartao').select('*')
    ]);

    return { clientesRes, dividasRes, lancRes, cartoesRes, lancCartaoRes };
  }

  let { clientesRes, dividasRes, lancRes, cartoesRes, lancCartaoRes } = await carregarComEscopo(userScopeEnabled);

  const loadError = clientesRes.error || dividasRes.error || lancRes.error || cartoesRes.error || lancCartaoRes.error;
  if (loadError) {
    if (userScopeEnabled && isMissingUserScopeError(loadError)) {
      console.warn('Coluna user_id ainda nao existe. Carregando dados em modo compatibilidade ate aplicar a migracao RLS.');
      setUserScopeEnabled(false);
      ({ clientesRes, dividasRes, lancRes, cartoesRes, lancCartaoRes } = await carregarComEscopo(false));
    } else {
      console.error('Erro ao carregar dados do usuario:', loadError);
      alert('Nao foi possivel carregar os dados do usuario. Verifique se a migracao user_id/RLS ja foi aplicada no Supabase.');
      return;
    }
  }

  const clientesRows = clientesRes.data || [];
  const dividasRows = dividasRes.data || [];
  const lancRows = lancRes.data || [];
  const cartoesRows = cartoesRes.data || [];
  const lancCartaoRows = lancCartaoRes.data || [];

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
      cat: l.categoria || '',
      tipo: l.tipo || '',
      valor: Number(l.valor || 0)
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

  (clientesRows || []).forEach(c => {
    data.clients[c.id] = {
      id: c.id,
      userId: c.user_id || null,
      name: c.nome || '',
      cartoes: cartoesPorCliente[c.id] || [],
      cartao: lancCartaoPorCliente[c.id] || [],
      contas: [],
      dividas: dividasPorCliente[c.id] || [],
      extrato: extratoPorCliente[c.id] || []
    };
  });
}

function saveData() {
  // Não usamos mais localStorage
}

function renderTabs() {
  const container = document.getElementById('tabsContainer');
  if (!container) return;

  container.innerHTML = TAB_DEFS.map(tab =>
    '<button class="tab-btn' + (tab.key === activeTab ? ' active' : '') + '" onclick="switchTab(\'' + tab.key + '\')">' +
    tab.label +
    '</button>'
  ).join('');

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + activeTab);
  });
}

function switchTab(tabKey) {
  activeTab = TAB_DEFS.find(tab => tab.key === tabKey) ? tabKey : 'cartao';
  renderTabs();
  renderTab(activeTab);
}

function renderTab(tabKey) {
  const tab = TAB_DEFS.find(item => item.key === tabKey) || TAB_DEFS[0];
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
})();
