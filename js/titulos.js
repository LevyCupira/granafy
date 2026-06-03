// Financeiro PJ: contas a receber / contas a pagar.

var _tfNatureza = 'receber';
var _tfStatus = 'todos';
var _tfBusca = '';
var _tfPanels = {
  novo: false
};

var COLS_TITULOS = [
  { key: 'vencimento', label: 'Vencimento', render: item => '<span style="color:var(--muted);font-size:.78rem">' + esc(formatDate(item.vencimento)) + '</span>' },
  { key: 'pessoa', label: 'Pessoa', render: item => '<strong>' + esc(item.pessoaNome || '-') + '</strong>' },
  { key: 'descricao', label: 'Descricao', render: item => esc(item.descricao || '-') + (item.observacao ? '<div class="installment-note">' + esc(item.observacao) + '</div>' : '') },
  { key: 'categoria', label: 'Categoria', render: item => '<span class="badge badge-cat">' + esc(item.categoria || 'Sem categoria') + '</span>' },
  { key: 'status', label: 'Status', render: item => '<span class="tf-status-badge ' + esc(tfStatusOf(item)) + '">' + esc(tfStatusLabel(tfStatusOf(item))) + '</span>' },
  { key: 'total', label: 'Total', render: item => '<span class="val ' + (_tfNatureza === 'receber' ? 'val-pos' : 'val-neg') + '">' + (_tfNatureza === 'receber' ? fmt(item.valorTotal || 0) : ('- ' + fmt(item.valorTotal || 0)) ) + '</span>' },
  { key: 'baixado', label: 'Baixado', render: item => '<span style="color:var(--accent3);font-weight:700">' + fmt(tfTotalBaixado(item)) + '</span>' },
  { key: 'saldo', label: 'Saldo', render: item => '<span style="color:' + (tfSaldo(item) > 0 ? 'var(--warning)' : 'var(--success)') + ';font-weight:700">' + fmt(tfSaldo(item)) + '</span>' },
  { key: '_del', label: '', render: () => '' }
];

function tfClienteAtivo() {
  return activeClient && data && data.clients ? data.clients[activeClient] : null;
}

function tfClienteEhPJ() {
  var cliente = tfClienteAtivo();
  return !!(cliente && String(cliente.tipoCliente || '').toLowerCase() === 'pj');
}

function tfTitulosCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.titulos) ? cliente.titulos : [];
}

function tfTitulosDisponiveisParaNatureza(natureza) {
  return tfSortItems(tfTitulosCliente().filter(function(item) {
    return item.natureza === natureza && tfSaldo(item) > 0;
  }));
}

function tfBaixasPorLancamentoId(lancamentoId, natureza) {
  if (!lancamentoId) return [];
  var resultados = [];
  tfTitulosCliente().forEach(function(item) {
    if (natureza && item.natureza !== natureza) return;
    (item.baixas || []).forEach(function(baixa) {
      if (baixa.lancamentoId === lancamentoId) {
        resultados.push({
          tituloId: item.id,
          tituloPessoa: item.pessoaNome || '',
          tituloDescricao: item.descricao || '',
          tituloNatureza: item.natureza,
          baixa: baixa
        });
      }
    });
  });
  return resultados;
}

function tfValorConciliadoLancamento(lancamentoId, natureza) {
  return tfBaixasPorLancamentoId(lancamentoId, natureza).reduce(function(sum, item) {
    return sum + Number(item.baixa.valor || 0);
  }, 0);
}

function tfNormalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tfParseAmountFromInput(id) {
  return parseMoney(document.getElementById(id));
}

function tfTotalBaixado(item) {
  return Number((item.baixas || []).reduce(function(sum, baixa) {
    return sum + Number(baixa.valor || 0);
  }, 0));
}

function tfSaldo(item) {
  return Math.max(0, Number(item.valorTotal || 0) - tfTotalBaixado(item));
}

function tfIsOverdue(item) {
  if (!item || !item.vencimento || tfSaldo(item) <= 0) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = new Date(String(item.vencimento).slice(0, 10) + 'T00:00:00');
  if (isNaN(due.getTime())) return false;
  return due < today;
}

function tfStatusOf(item) {
  var baixado = tfTotalBaixado(item);
  var total = Number(item.valorTotal || 0);
  if (total > 0 && baixado >= total) return 'quitado';
  if (baixado > 0) return 'parcial';
  if (tfIsOverdue(item)) return 'atrasado';
  return 'aberto';
}

function tfStatusLabel(status) {
  if (status === 'quitado') return _tfNatureza === 'receber' ? 'Recebido' : 'Pago';
  if (status === 'parcial') return _tfNatureza === 'receber' ? 'Recebido parcial' : 'Pago parcial';
  if (status === 'atrasado') return 'Atrasado';
  return 'Em aberto';
}

function tfSortItems(items) {
  return items.slice().sort(function(a, b) {
    var statusOrder = { atrasado: 0, aberto: 1, parcial: 2, quitado: 3 };
    var sa = statusOrder[tfStatusOf(a)] || 9;
    var sb = statusOrder[tfStatusOf(b)] || 9;
    if (sa !== sb) return sa - sb;
    var da = String(a.vencimento || '9999-99-99');
    var db = String(b.vencimento || '9999-99-99');
    if (da !== db) return da.localeCompare(db);
    return String(a.pessoaNome || '').localeCompare(String(b.pessoaNome || ''), 'pt-BR');
  });
}

function tfFilteredItems() {
  return tfSortItems(tfTitulosCliente().filter(function(item) {
    if (item.natureza !== _tfNatureza) return false;
    if (_tfStatus !== 'todos' && tfStatusOf(item) !== _tfStatus) return false;
    if (_tfBusca) {
      var hay = tfNormalizeText([item.pessoaNome, item.descricao, item.categoria, item.observacao].join(' '));
      if (hay.indexOf(tfNormalizeText(_tfBusca)) === -1) return false;
    }
    return true;
  }));
}

function tfSummaryValues() {
  var items = tfTitulosCliente();
  var receber = 0;
  var pagar = 0;
  var vencidos = 0;

  items.forEach(function(item) {
    var saldo = tfSaldo(item);
    if (item.natureza === 'receber') receber += saldo;
    if (item.natureza === 'pagar') pagar += saldo;
    if (tfIsOverdue(item)) vencidos++;
  });

  return { receber: receber, pagar: pagar, vencidos: vencidos, total: items.length };
}

function tfSetNatureza(natureza) {
  _tfNatureza = natureza === 'pagar' ? 'pagar' : 'receber';
  renderFinanceiro();
}

function tfApplyFilters() {
  var statusEl = document.getElementById('tf-filtro-status');
  var buscaEl = document.getElementById('tf-filtro-busca');
  _tfStatus = statusEl ? statusEl.value : 'todos';
  _tfBusca = buscaEl ? buscaEl.value.trim() : '';
  renderFinanceiro();
}

function tfClearFilters() {
  _tfStatus = 'todos';
  _tfBusca = '';
  renderFinanceiro();
}

function toggleFinanceiroPanel(key) {
  _tfPanels[key] = !_tfPanels[key];
  renderFinanceiro();
}

function financeiroPanel(key, title, body) {
  var open = !!_tfPanels[key];
  return '<div class="form-card collapsible-card financeiro-collapsible-card' + (open ? ' open' : '') + '">'
    + '<button type="button" class="collapse-head" onclick="toggleFinanceiroPanel(\'' + key + '\')" aria-expanded="' + open + '">'
    + '<span>' + title + '</span>'
    + '<span class="collapse-chevron" aria-hidden="true">&#9662;</span>'
    + '</button>'
    + (open ? '<div class="collapse-body">' + body + '</div>' : '')
    + '</div>';
}

function tfFormPrefix() {
  return _tfNatureza === 'pagar' ? 'tf-pagar' : 'tf-receber';
}

function tfCategoriasOptionsHtml(selectedValue) {
  var atual = String(selectedValue || '').trim();
  var categorias = typeof nomesFinanceiro === 'function' ? nomesFinanceiro() : [];
  var lista = categorias.slice();
  if (atual && !lista.some(function(nome) { return normalizarNomeCategoria(nome) === normalizarNomeCategoria(atual); })) {
    lista.push(atual);
  }
  lista.sort(function(a, b) { return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' }); });
  return '<option value="">Sem categoria</option>' + lista.map(function(nome) {
    return '<option value="' + esc(nome) + '"' + (normalizarNomeCategoria(nome) === normalizarNomeCategoria(atual) ? ' selected' : '') + '>' + esc(nome) + '</option>';
  }).join('');
}

function tfCentrosCustoCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.centrosCustoMeta) ? cliente.centrosCustoMeta : [];
}

function tfNomeCentroCustoById(centroCustoId) {
  if (!centroCustoId) return '';
  var centro = tfCentrosCustoCliente().find(function(item) { return item.id === centroCustoId; });
  return centro ? String(centro.nome || '') : '';
}

function tfCentrosCustoOptionsHtml(selectedId) {
  var atual = String(selectedId || '').trim();
  var centros = tfCentrosCustoCliente().slice().sort(function(a, b) {
    return String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
  if (!centros.length) return '<option value="">Sem centro</option>';
  return '<option value="">Sem centro</option>' + centros.map(function(item) {
    return '<option value="' + esc(item.id) + '"' + (String(item.id) === atual ? ' selected' : '') + '>' + esc(item.nome || '') + '</option>';
  }).join('');
}

function tfNormalizeDateFieldValue(fieldId, label) {
  var el = document.getElementById(fieldId);
  if (!el) return '';
  var raw = String(el.value || '').trim();
  if (!raw) return '';
  var normalized = readFlexibleDateInput(el);
  if (!normalized) {
    alert('Informe uma data valida para ' + label + '. Use dd/mm ou dd/mm/aaaa.');
    el.focus();
    return null;
  }
  el.value = formatDate(normalized);
  return normalized;
}

function tfReadFormPayload(prefix) {
  var pessoa = (document.getElementById(prefix + '-pessoa') || {}).value || '';
  var descricao = (document.getElementById(prefix + '-descricao') || {}).value || '';
  var categoria = (document.getElementById(prefix + '-categoria') || {}).value || '';
  var centroCustoId = ((document.getElementById(prefix + '-centro-custo') || {}).value || '').trim() || null;
  var vencimento = tfNormalizeDateFieldValue(prefix + '-vencimento', 'vencimento');
  var valor = tfParseAmountFromInput(prefix + '-valor');
  var observacao = (document.getElementById(prefix + '-observacao') || {}).value || '';

  if (vencimento === null) return null;

  return {
    natureza: prefix === 'tf-pagar' ? 'pagar' : 'receber',
    pessoaNome: formatDescriptionTitleCase(pessoa),
    descricao: formatDescriptionTitleCase(descricao),
    categoria: formatDescriptionTitleCase(categoria),
    centroCustoId: centroCustoId,
    vencimento: vencimento || null,
    valorTotal: Number(valor || 0),
    observacao: observacao.trim()
  };
}

function tfResetForm(prefix) {
  ['pessoa', 'descricao', 'categoria', 'centro-custo', 'vencimento', 'observacao'].forEach(function(suffix) {
    var el = document.getElementById(prefix + '-' + suffix);
    if (el) el.value = '';
    if (el && suffix === 'vencimento') delete el.dataset.isoDate;
  });
  var valorEl = document.getElementById(prefix + '-valor');
  if (valorEl) {
    valorEl.value = '0,00';
    valorEl.dataset.cents = '0';
  }
}

async function tfAddTitulo() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var payload = tfReadFormPayload(tfFormPrefix());
  if (!payload) return;
  if (!payload.pessoaNome || !payload.descricao || payload.valorTotal <= 0) {
    alert('Preencha pessoa, descricao e valor do titulo.');
    return;
  }

  var insertPayload = Object.assign({
    cliente_id: activeClient,
    natureza: payload.natureza,
    pessoa_nome: payload.pessoaNome,
    descricao: payload.descricao,
    categoria: payload.categoria || null,
    centro_custo_id: payload.centroCustoId || null,
    vencimento: payload.vencimento,
    valor_total: payload.valorTotal,
    observacao: payload.observacao || null
  }, getUserScopePayload());

  var response = await supabaseClient
    .from('titulos_financeiros')
    .insert([insertPayload])
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel cadastrar o titulo. Verifique se a migracao 20260520_titulos_financeiros_pj.sql ja foi aplicada no Supabase.');
    return;
  }

  var cliente = tfClienteAtivo();
  if (!Array.isArray(cliente.titulos)) cliente.titulos = [];
  cliente.titulos.push({
    id: response.data.id,
    natureza: response.data.natureza,
    pessoaNome: response.data.pessoa_nome || '',
    descricao: response.data.descricao || '',
    categoria: response.data.categoria || '',
    centroCustoId: response.data.centro_custo_id || null,
    centroCusto: tfNomeCentroCustoById(response.data.centro_custo_id || null),
    vencimento: response.data.vencimento || null,
    valorTotal: Number(response.data.valor_total || 0),
    observacao: response.data.observacao || '',
    createdAt: response.data.created_at || null,
    updatedAt: response.data.updated_at || null,
    baixas: [],
    userId: response.data.user_id || null
  });

  tfResetForm(tfFormPrefix());
  renderFinanceiro();
}

function tfFindTituloById(id) {
  return tfTitulosCliente().find(function(item) { return item.id === id; }) || null;
}

function tfUpdateLocalTitulo(row) {
  var cliente = tfClienteAtivo();
  if (!cliente || !Array.isArray(cliente.titulos)) return;
  var idx = cliente.titulos.findIndex(function(item) { return item.id === row.id; });
  if (idx < 0) return;
  cliente.titulos[idx] = Object.assign({}, cliente.titulos[idx], {
    pessoaNome: row.pessoa_nome || '',
    descricao: row.descricao || '',
    categoria: row.categoria || '',
    centroCustoId: row.centro_custo_id || null,
    centroCusto: tfNomeCentroCustoById(row.centro_custo_id || null),
    vencimento: row.vencimento || null,
    valorTotal: Number(row.valor_total || 0),
    observacao: row.observacao || '',
    updatedAt: row.updated_at || null
  });
}

function tfOpenTituloModal(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var naturezaLabel = item.natureza === 'receber' ? 'Conta a receber' : 'Conta a pagar';
  var baixarLabel = item.natureza === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento';
  var baixasHtml = (item.baixas || []).length
    ? item.baixas.slice().sort(function(a, b) {
        return String(b.data || '').localeCompare(String(a.data || ''));
      }).map(function(baixa) {
        return '<div class="tf-baixa-item">'
          + '<div><strong>' + esc(formatDate(baixa.data)) + '</strong><small>' + esc(baixa.origem === 'extrato' ? 'Conciliado com extrato' : 'Baixa manual') + (baixa.observacao ? ' · ' + esc(baixa.observacao) : '') + '</small></div>'
          + '<div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--accent3)">' + fmt(baixa.valor) + '</strong><button class="btn-icon danger" onclick="tfDeleteBaixa(\'' + id + '\',\'' + baixa.id + '\')" title="Excluir baixa">&#128465;</button></div>'
          + '</div>';
      }).join('')
    : '<div class="empty-state" style="padding:22px 12px">Nenhuma baixa registrada ainda.</div>';

  document.getElementById('modalTitle').textContent = naturezaLabel;
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-card-badges" style="margin:0 0 18px 0">'
      + '<span class="settings-card-badge">' + esc(item.natureza === 'receber' ? 'Receber' : 'Pagar') + '</span>'
      + '<span class="settings-card-badge subtle">Total ' + fmt(item.valorTotal) + '</span>'
      + '<span class="settings-card-badge subtle">Baixado ' + fmt(tfTotalBaixado(item)) + '</span>'
      + '<span class="settings-card-badge subtle">Saldo ' + fmt(tfSaldo(item)) + '</span>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>' + (item.natureza === 'receber' ? 'Cliente pagador' : 'Favorecido / fornecedor') + '</label><input type="text" id="tf-edit-pessoa" value="' + esc(item.pessoaNome || '') + '"/></div>'
      + '<div class="form-group"><label>Descricao</label><input type="text" id="tf-edit-descricao" value="' + esc(item.descricao || '') + '"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Categoria (<a href="#" onclick="openModal(\'settings\',\'cats_financeiro\');return false;">+ gerir</a>)</label><select id="tf-edit-categoria">' + tfCategoriasOptionsHtml(item.categoria || '') + '</select></div>'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="tf-edit-vencimento" class="flex-date-input" value="' + esc(item.vencimento ? formatDate(item.vencimento) : '') + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor total</label><input type="text" id="tf-edit-valor" class="money-input" value="' + esc((Number(item.valorTotal || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Observacao</label><textarea id="tf-edit-observacao" rows="3" placeholder="Informacoes importantes deste titulo">' + esc(item.observacao || '') + '</textarea></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 18px">'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
      + '<button class="btn-add" type="button" style="margin-top:0" onclick="tfSaveTitulo(\'' + id + '\')">Salvar titulo</button>'
    + '</div>'
    + '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>Baixas registradas</h5><p>Registre recebimentos ou pagamentos parciais para acompanhar o saldo deste titulo.</p></div></div>'
      + baixasHtml
      + '<div class="form-row" style="margin-top:16px">'
        + '<div class="form-group" style="max-width:170px"><label>Data da baixa</label><input type="text" id="tf-baixa-data" class="flex-date-input" value="' + esc(formatDate(new Date().toISOString().slice(0, 10))) + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor</label><input type="text" id="tf-baixa-valor" class="money-input" value="' + esc(Math.max(tfSaldo(item), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
        + '<div class="form-group"><label>Observacao</label><input type="text" id="tf-baixa-observacao" placeholder="Ex.: Pix, TED, boleto"/></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end"><button class="btn-add" type="button" style="margin-top:6px" onclick="tfRegistrarBaixa(\'' + id + '\')">' + baixarLabel + '</button></div>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  initMoneyInputs(document.getElementById('modalBody'));
  initFlexibleDateInputs(document.getElementById('modalBody'));
}

async function tfSaveTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var payload = {
    pessoa_nome: formatDescriptionTitleCase((document.getElementById('tf-edit-pessoa') || {}).value || ''),
    descricao: formatDescriptionTitleCase((document.getElementById('tf-edit-descricao') || {}).value || ''),
    categoria: formatDescriptionTitleCase((document.getElementById('tf-edit-categoria') || {}).value || ''),
    centro_custo_id: ((document.getElementById('tf-edit-centro-custo') || {}).value || '').trim() || null,
    vencimento: tfNormalizeDateFieldValue('tf-edit-vencimento', 'vencimento'),
    valor_total: tfParseAmountFromInput('tf-edit-valor'),
    observacao: ((document.getElementById('tf-edit-observacao') || {}).value || '').trim() || null
  };

  if (payload.vencimento === null) return;

  if (!payload.pessoa_nome || !payload.descricao || payload.valor_total <= 0) {
    alert('Preencha pessoa, descricao e valor do titulo.');
    return;
  }

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .update(payload)
      .eq('id', id)
  ).select().single();

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel salvar o titulo.');
    return;
  }

  tfUpdateLocalTitulo(response.data);
  closeModal();
  renderFinanceiro();
}

async function tfDeleteTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var ok = await appConfirm('Excluir este titulo financeiro? As baixas registradas tambem serao removidas.', { title: 'Excluir titulo', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .delete()
      .eq('id', id)
  );

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel excluir o titulo.');
    return;
  }

  var cliente = tfClienteAtivo();
  cliente.titulos = (cliente.titulos || []).filter(function(entry) { return entry.id !== id; });
  closeModal();
  renderFinanceiro();
}

async function tfRegistrarBaixa(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var dataBaixa = tfNormalizeDateFieldValue('tf-baixa-data', 'data da baixa');
  var valor = tfParseAmountFromInput('tf-baixa-valor');
  var observacao = ((document.getElementById('tf-baixa-observacao') || {}).value || '').trim();

  if (dataBaixa === null) return;
  if (!dataBaixa) dataBaixa = new Date().toISOString().slice(0, 10);

  if (valor <= 0) {
    alert('Informe um valor de baixa maior que zero.');
    return;
  }

  var response = await supabaseClient
    .from('titulos_financeiros_baixas')
    .insert([Object.assign({
      titulo_id: id,
      cliente_id: activeClient,
      data_baixa: dataBaixa,
      valor: valor,
      observacao: observacao || null,
      origem: 'manual'
    }, getUserScopePayload())])
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel registrar a baixa.');
    return;
  }

  if (!Array.isArray(item.baixas)) item.baixas = [];
  item.baixas.push({
    id: response.data.id,
    data: response.data.data_baixa || null,
    valor: Number(response.data.valor || 0),
    observacao: response.data.observacao || '',
    origem: response.data.origem || 'manual',
    lancamentoId: response.data.extrato_lancamento_id || null,
    userId: response.data.user_id || null
  });

  tfOpenTituloModal(id);
  renderFinanceiro();
}

async function tfDeleteBaixa(tituloId, baixaId) {
  var ok = await appConfirm('Excluir esta baixa registrada?', { title: 'Excluir baixa', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros_baixas')
      .delete()
      .eq('id', baixaId)
  );

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel excluir a baixa.');
    return;
  }

  var item = tfFindTituloById(tituloId);
  if (item) item.baixas = (item.baixas || []).filter(function(baixa) { return baixa.id !== baixaId; });
  tfOpenTituloModal(tituloId);
  renderFinanceiro();
}

function renderFinanceiro() {
  var root = document.getElementById('financeiro-content');
  if (!root) return;

  if (!activeClient || !tfClienteAtivo()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    return;
  }

  if (!tfClienteEhPJ()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">🏢</div>O modulo Financeiro esta disponivel apenas para clientes PJ.</div>';
    return;
  }

  var resumo = tfSummaryValues();
  var tituloAtivo = _tfNatureza === 'pagar' ? 'Contas a pagar' : 'Contas a receber';
  var pessoaLabel = _tfNatureza === 'pagar' ? 'Favorecido / fornecedor' : 'Cliente pagador';
  var btnLabel = _tfNatureza === 'pagar' ? 'Cadastrar conta a pagar' : 'Cadastrar conta a receber';
  var itens = tfFilteredItems();
  var areaHtml = buildTable('financeiro', COLS_TITULOS, itens, function(item) {
    return COLS_TITULOS.map(function(col) {
      if (col.key === '_del') {
        return '<td><div class="row-actions"><button class="btn-icon" onclick="tfOpenTituloModal(\'' + item.id + '\')" title="Abrir titulo">&#9998;</button><button class="btn-icon danger" onclick="tfDeleteTitulo(\'' + item.id + '\')" title="Excluir titulo">&#128465;</button></div></td>';
      }
      return '<td>' + col.render(item) + '</td>';
    }).join('');
  }, function(item) {
    return tfStatusOf(item) === 'atrasado' ? 'row-overdue' : '';
  });

  root.innerHTML =
    '<div class="summary-grid">'
      + '<div class="summary-card"><div class="s-label">A receber em aberto</div><div class="s-val green">' + fmt(resumo.receber) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">A pagar em aberto</div><div class="s-val red">' + fmt(resumo.pagar) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Vencidos</div><div class="s-val yellow">' + resumo.vencidos + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Titulos</div><div class="s-val blue">' + resumo.total + '</div></div>'
    + '</div>'
    + '<div class="form-card">'
      + '<h3>Financeiro PJ</h3>'
      + '<p class="cartao-helper-text">Cadastre os titulos a receber e a pagar da empresa. No proximo passo, vamos poder conciliar essas baixas diretamente com o Extrato.</p>'
      + '<div class="tipo-toggle" style="margin-top:14px">'
        + '<button type="button" class="tipo-btn credito' + (_tfNatureza === 'receber' ? ' active' : '') + '" onclick="tfSetNatureza(\'receber\')">A Receber</button>'
        + '<button type="button" class="tipo-btn debito' + (_tfNatureza === 'pagar' ? ' active' : '') + '" onclick="tfSetNatureza(\'pagar\')">A Pagar</button>'
      + '</div>'
    + '</div>'
    + financeiroPanel('novo', '+ Novo titulo - ' + tituloAtivo,
      '<div class="form-row">'
        + '<div class="form-group"><label>' + pessoaLabel + '</label><input type="text" id="' + tfFormPrefix() + '-pessoa" placeholder="Quem esta envolvido neste titulo"/></div>'
        + '<div class="form-group"><label>Descricao</label><input type="text" id="' + tfFormPrefix() + '-descricao" placeholder="Ex.: Mensalidade, imposto, fornecedor"/></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group"><label>Categoria (<a href="#" onclick="openModal(\'settings\',\'cats_financeiro\');return false;">+ gerir</a>)</label><select id="' + tfFormPrefix() + '-categoria">' + tfCategoriasOptionsHtml('') + '</select></div>'
        + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="' + tfFormPrefix() + '-vencimento" class="flex-date-input" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="' + tfFormPrefix() + '-valor" class="money-input" value="0,00"/></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group"><label>Observacao</label><textarea id="' + tfFormPrefix() + '-observacao" rows="3" placeholder="Informacoes complementares deste titulo"></textarea></div>'
      + '</div>'
      + '<button class="btn-add" onclick="tfAddTitulo()">' + btnLabel + '</button>'
    )
    + '<div class="form-card">'
      + '<h3>Filtros</h3>'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:180px"><label>Status</label><select id="tf-filtro-status"><option value="todos"' + (_tfStatus === 'todos' ? ' selected' : '') + '>Todos</option><option value="aberto"' + (_tfStatus === 'aberto' ? ' selected' : '') + '>Em aberto</option><option value="parcial"' + (_tfStatus === 'parcial' ? ' selected' : '') + '>Parcial</option><option value="quitado"' + (_tfStatus === 'quitado' ? ' selected' : '') + '>Quitado</option><option value="atrasado"' + (_tfStatus === 'atrasado' ? ' selected' : '') + '>Atrasado</option></select></div>'
        + '<div class="form-group"><label>Busca</label><input type="text" id="tf-filtro-busca" value="' + esc(_tfBusca) + '" placeholder="Pessoa, descricao ou categoria" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="tfApplyFilters()">Aplicar filtros</button><button class="btn-sm red" onclick="tfClearFilters()">Limpar</button></div>'
    + '</div>'
    + '<p class="section-title">' + tituloAtivo + '</p>'
    + areaHtml;

  initMoneyInputs(root);
  initFlexibleDateInputs(root);
  initDrag('financeiro', COLS_TITULOS, renderFinanceiro);
}
