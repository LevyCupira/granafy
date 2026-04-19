// ════════════════════════════════════════════════════
// DIVIDAS.JS — VERSÃO FINAL LIMPA (SUPABASE)
// ════════════════════════════════════════════════════

var DV_TIPOS = ['Empréstimo','Financiamento','Acordo','Cartão de crédito','Cheque especial','Consignado','Outros'];

var DV_STATUS_LABEL = {
  quitada: '✅ Quitada',
  atrasada: '⚠️ Atrasada',
  'em-dia': '✔ Em dia'
};

var _lastCalc = null;
var _dvHistOpen = new Set();
var _dvFiltroStatus = 'todos';
var _dvFiltroTipo = '';
var _dvFiltroBusca = '';
var _dvPanels = {
  reneg: false,
  filtros: true
};

function toggleDividasPanel(key) {
  _dvPanels[key] = !_dvPanels[key];
  renderDividas();
}

function setupDividasCollapsiblePanels(area) {
  if (!area) return;

  var cards = area.querySelectorAll('.form-card');
  setupDividasPanelDom(area.querySelector('.calc-bc'), 'reneg', 'Renegociacao / nova divida');
  if (cards[0]) cards[0].style.display = 'none';
  setupDividasPanelDom(cards[1], 'filtros', 'Filtros');
}

function setupDividasPanelDom(card, key, title) {
  if (!card) return;

  var open = !!_dvPanels[key];
  var children = Array.from(card.childNodes);
  var body = document.createElement('div');
  body.className = 'collapse-body';

  children.forEach(function(node) {
    if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'h3') return;
    body.appendChild(node);
  });

  card.innerHTML = '';
  card.classList.add('collapsible-card');
  card.classList.toggle('open', open);

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'collapse-head';
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.onclick = function() { toggleDividasPanel(key); };
  button.innerHTML = '<span>' + esc(title) + '</span><span class="collapse-hint">' + (open ? 'Minimizar' : 'Abrir') + '</span>';
  card.appendChild(button);

  if (open) card.appendChild(body);
}

function calcPrice(pv, iMensal, n) {
  if (!pv || !n) return null;

  if (!iMensal || iMensal === 0) {
    var pmt0 = pv / n;
    return {
      pmt: pmt0,
      totalPago: pmt0 * n,
      totalJuros: 0,
      cet: 0,
      tabela: Array.from({ length: n }, (_, k) => ({
        n: k + 1,
        pmt: pmt0,
        juros: 0,
        amort: pmt0,
        saldo: pv - (pmt0 * (k + 1))
      }))
    };
  }

  var i = iMensal / 100;
  var pmt = pv * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  var saldo = pv, tabela = [];

  for (var k = 1; k <= n; k++) {
    var juros = saldo * i;
    var amort = pmt - juros;
    saldo -= amort;

    tabela.push({
      n: k,
      pmt,
      juros,
      amort,
      saldo: Math.max(0, saldo)
    });
  }

  return {
    pmt,
    totalPago: pmt * n,
    totalJuros: pmt * n - pv,
    cet: (Math.pow(1 + i, 12) - 1) * 100,
    tabela
  };
}

function calcTaxaMensalPorParcela(pv, pmt, n) {
  if (!pv || !pmt || !n) return null;
  if (Math.abs((pv / n) - pmt) < 0.01) return 0;

  var baixo = 0;
  var alto = 1;

  for (var i = 0; i < 100; i++) {
    var meio = (baixo + alto) / 2;
    var parcela = pv * (meio * Math.pow(1 + meio, n)) / (Math.pow(1 + meio, n) - 1);
    if (parcela > pmt) alto = meio;
    else baixo = meio;
  }

  return ((baixo + alto) / 2) * 100;
}

function simularRenegociacaoDivida() {
  var pv = parseMoney(document.getElementById('dv-total'));
  var parcelas = parseInt(document.getElementById('dv-parcelas').value) || 0;
  var valorParcela = parseMoney(document.getElementById('dv-vparcela'));
  var taxa = parseFloat(document.getElementById('dv-taxa').value) || 0;

  if (!pv || !parcelas) {
    alert('Informe valor da divida e quantidade de parcelas.');
    return null;
  }

  if (valorParcela) {
    taxa = calcTaxaMensalPorParcela(pv, valorParcela, parcelas);
    var totalPago = valorParcela * parcelas;
    var tabelaBase = calcPrice(pv, taxa, parcelas);
    _lastCalc = {
      pmt: valorParcela,
      totalPago: totalPago,
      totalJuros: totalPago - pv,
      cet: totalPago > 0 && pv > 0 ? ((totalPago / pv) - 1) * 100 : 0,
      taxaMensal: taxa,
      tabela: tabelaBase ? tabelaBase.tabela : []
    };
  } else {
    _lastCalc = calcPrice(pv, taxa, parcelas);
    if (_lastCalc) {
      _lastCalc.taxaMensal = taxa;
      _lastCalc.cet = _lastCalc.totalPago > 0 && pv > 0 ? ((_lastCalc.totalPago / pv) - 1) * 100 : 0;
    }
  }

  renderDividas();
  return _lastCalc;
}

function getDvStatus(d) {
  var pago = Number(d.pago) || 0;
  var total = Number(d.total) || 0;

  if (pago >= total && total > 0) return 'quitada';
  if (!d.dataInicio) return 'em-dia';

  var inicio = new Date(d.dataInicio + 'T00:00:00');
  var hoje = new Date();
  hoje.setHours(0,0,0,0);

  var meses = Math.floor((hoje - inicio) / (1000*60*60*24*30.44));
  var parcelasPagas = Math.round(pago / (Number(d.valorParcela) || 1));

  if (parcelasPagas < meses && meses > 0) return 'atrasada';

  return 'em-dia';
}

function aplicarFiltrosDividas() {
  var status = document.getElementById('dv-filtro-status');
  var tipo = document.getElementById('dv-filtro-tipo');
  var busca = document.getElementById('dv-filtro-busca');

  _dvFiltroStatus = status ? status.value : 'todos';
  _dvFiltroTipo = tipo ? tipo.value : '';
  _dvFiltroBusca = busca ? busca.value.trim().toLowerCase() : '';

  renderDividas();
}

function limparFiltrosDividas() {
  _dvFiltroStatus = 'todos';
  _dvFiltroTipo = '';
  _dvFiltroBusca = '';
  renderDividas();
}

function renderDividas() {
  var c = data.clients[activeClient];
  var area = document.getElementById('dividas-content');
  if (!area) return;

  if (!c) {
    area.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    return;
  }

  if (!Array.isArray(c.dividas)) c.dividas = [];

  var tiposCadastrados = [...new Set(c.dividas.map(d => d.tipo || '').filter(Boolean))].sort();
  var dividasFiltradas = c.dividas.filter(d => {
    var status = getDvStatus(d);
    var texto = ((d.org || '') + ' ' + (d.tipo || '')).toLowerCase();
    if (_dvFiltroStatus !== 'todos' && status !== _dvFiltroStatus) return false;
    if (_dvFiltroTipo && d.tipo !== _dvFiltroTipo) return false;
    if (_dvFiltroBusca && !texto.includes(_dvFiltroBusca)) return false;
    return true;
  });

  var total = dividasFiltradas.reduce((s, d) => s + Number(d.total || 0), 0);
  var pago = dividasFiltradas.reduce((s, d) => s + Number(d.pago || 0), 0);
  var aberto = Math.max(0, total - pago);
  var atrasadas = dividasFiltradas.filter(d => getDvStatus(d) === 'atrasada').length;

  var tipoOpts = DV_TIPOS.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
  var filtroTipoOpts = tiposCadastrados.map(t => '<option value="' + esc(t) + '"' + (_dvFiltroTipo === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');

  var calcHtml = _lastCalc ? (
    '<div class="calc-result-grid">'
    + '<div class="calc-result-item"><div class="cr-label">Parcela</div><div class="cr-val blue">' + fmt(_lastCalc.pmt) + '</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">Total pago</div><div class="cr-val yellow">' + fmt(_lastCalc.totalPago) + '</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">Juros</div><div class="cr-val red">' + fmt(_lastCalc.totalJuros) + '</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">Taxa mensal</div><div class="cr-val green">' + Number(_lastCalc.taxaMensal || 0).toFixed(2) + '%</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">CET total</div><div class="cr-val green">' + _lastCalc.cet.toFixed(2) + '%</div></div>'
    + '</div>'
    + '<div class="calc-amort-table"><table><thead><tr><th>#</th><th>Parcela</th><th>Juros</th><th>Amort.</th><th>Saldo</th></tr></thead><tbody>'
    + _lastCalc.tabela.slice(0, 120).map(row =>
      '<tr><td>' + row.n + '</td><td>' + fmt(row.pmt) + '</td><td>' + fmt(row.juros) + '</td><td>' + fmt(row.amort) + '</td><td>' + fmt(row.saldo) + '</td></tr>'
    ).join('')
    + '</tbody></table></div>'
  ) : '';

  var lista = c.dividas.length === 0
    ? '<div class="empty-state" style="padding:32px 20px"><div class="icon">📄</div>Nenhuma dívida cadastrada.</div>'
    : dividasFiltradas.length === 0
      ? '<div class="empty-state" style="padding:32px 20px">Nenhuma dívida encontrada com os filtros atuais.</div>'
      : dividasFiltradas.map((d) => {
      var i = c.dividas.indexOf(d);
      var status = getDvStatus(d);
      var pct = Number(d.total) > 0 ? Math.min(100, Math.round((Number(d.pago || 0) / Number(d.total)) * 100)) : 0;
      var restante = Math.max(0, Number(d.total || 0) - Number(d.pago || 0));
      var progressClass = status === 'quitada' ? ' done' : status === 'atrasada' ? ' late' : '';

      return '<div class="dv-card ' + status + '">'
        + '<div class="dv-header">'
        + '<div class="dv-header-left"><div class="dv-title">' + esc(d.org || 'Sem credor') + '</div>'
        + '<span class="dv-tipo-badge">' + esc(d.tipo || 'Outros') + '</span>'
        + '<span class="dv-status-badge ' + status + '">' + (DV_STATUS_LABEL[status] || status) + '</span></div>'
        + '<button class="btn-sm red" onclick="deleteDivida(' + i + ')">Excluir</button>'
        + '</div>'
        + '<div class="dv-meta">'
        + '<span>Total: <strong>' + fmt(d.total || 0) + '</strong></span>'
        + '<span>Pago: <strong>' + fmt(d.pago || 0) + '</strong></span>'
        + '<span>Restante: <strong>' + fmt(restante) + '</strong></span>'
        + '<span>Parcela: <strong>' + fmt(d.valorParcela || 0) + '</strong></span>'
        + '<span>Inicio: <strong>' + (d.dataInicio ? d.dataInicio.split('-').reverse().join('/') : '-') + '</strong></span>'
        + '</div>'
        + '<div class="dv-progress-wrap">'
        + '<div class="dv-progress-bar"><div class="dv-progress-fill' + progressClass + '" style="width:' + pct + '%"></div></div>'
        + '<div class="dv-progress-labels"><span>' + pct + '% pago</span><span>' + fmt(restante) + ' em aberto</span></div>'
        + '</div>'
        + '<div class="dv-actions">'
        + '<input class="dv-pag-input money-input" id="dv-pag-inp-' + i + '" placeholder="0,00" inputmode="numeric"/>'
        + '<button class="btn-pagar" onclick="registrarPagamentoDivida(' + i + ')">Registrar pagamento</button>'
        + '</div>'
        + '</div>';
    }).join('');

  area.innerHTML =
    '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Total contratado</div><div class="s-val blue">' + fmt(total) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Total pago</div><div class="s-val green">' + fmt(pago) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Em aberto</div><div class="s-val red">' + fmt(aberto) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Atrasadas</div><div class="s-val yellow">' + atrasadas + '</div></div>'
    + '</div>'
    + '<div class="calc-bc">'
    + '<h3>Renegociacao / nova divida</h3>'
    + '<div class="calc-sub">Simule a taxa ou a parcela e cadastre a divida na mesma tela.</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Orgao / credor</label><input type="text" id="dv-org" placeholder="Banco, financeira..."/></div>'
    + '<div class="form-group"><label>Tipo</label><select id="dv-tipo">' + tipoOpts + '</select></div>'
    + '<div class="form-group"><label>Inicio</label><input type="date" id="dv-inicio"/></div>'
    + '</div>'
    + '<div class="form-row" style="margin-top:10px">'
    + '<div class="form-group"><label>Valor da divida</label><input type="text" id="dv-total" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group"><label>Parcelas</label><input type="number" id="dv-parcelas" min="1" step="1" placeholder="Ex: 24"/></div>'
    + '<div class="form-group"><label>Valor da parcela</label><input type="text" id="dv-vparcela" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group"><label>Taxa mensal (%)</label><input type="number" id="dv-taxa" min="0" step="0.01" placeholder="Ex: 1.5"/></div>'
    + '<div class="form-group"><label>Ja pago</label><input type="text" id="dv-pago" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" onclick="simularRenegociacaoDivida()">Simular</button><button class="btn-add" style="width:auto;margin-top:0" onclick="addDivida()">Cadastrar divida</button></div>'
    + calcHtml
    + '</div>'
    + '<div class="form-card"><h3>+ Nova dívida</h3>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Órgão / credor</label><input type="text" id="dv-org" placeholder="Banco, financeira..."/></div>'
    + '<div class="form-group"><label>Tipo</label><select id="dv-tipo">' + tipoOpts + '</select></div>'
    + '<div class="form-group"><label>Inicio</label><input type="date" id="dv-inicio"/></div>'
    + '</div>'
    + '<div class="form-row" style="margin-top:10px">'
    + '<div class="form-group"><label>Valor total</label><input type="text" id="dv-total" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group"><label>Parcelas</label><input type="number" id="dv-parcelas" min="0" step="1" placeholder="0"/></div>'
    + '<div class="form-group"><label>Valor da parcela</label><input type="text" id="dv-vparcela" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group"><label>Taxa mensal (%)</label><input type="number" id="dv-taxa" min="0" step="0.01" placeholder="0"/></div>'
    + '<div class="form-group"><label>Já pago</label><input type="text" id="dv-pago" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + '<button class="btn-add" onclick="addDivida()">Cadastrar dívida</button>'
    + '</div>'
    + '<div class="form-card"><h3>Filtros</h3>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:170px"><label>Status</label><select id="dv-filtro-status"><option value="todos"' + (_dvFiltroStatus === 'todos' ? ' selected' : '') + '>Todos</option><option value="em-dia"' + (_dvFiltroStatus === 'em-dia' ? ' selected' : '') + '>Em dia</option><option value="atrasada"' + (_dvFiltroStatus === 'atrasada' ? ' selected' : '') + '>Atrasada</option><option value="quitada"' + (_dvFiltroStatus === 'quitada' ? ' selected' : '') + '>Quitada</option></select></div>'
    + '<div class="form-group" style="max-width:210px"><label>Tipo</label><select id="dv-filtro-tipo"><option value="">Todos</option>' + filtroTipoOpts + '</select></div>'
    + '<div class="form-group"><label>Busca</label><input type="text" id="dv-filtro-busca" value="' + esc(_dvFiltroBusca) + '" placeholder="Credor ou tipo" onkeydown="if(event.key===\'Enter\')aplicarFiltrosDividas()"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="aplicarFiltrosDividas()">Aplicar filtros</button><button class="btn-sm red" onclick="limparFiltrosDividas()">Limpar</button></div>'
    + '</div>'
    + '<p class="section-title">Dívidas cadastradas</p>'
    + lista;

  initMoneyInputs(area);
  setupDividasCollapsiblePanels(area);
}

function calcularDivida() {
  simularRenegociacaoDivida();
}

async function insertDividaComFallback(payload) {
  var completo = await supabaseClient
    .from('dividas')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (!completo.error) return completo;

  var msg = String(completo.error.message || '').toLowerCase();
  var erroColuna = completo.error.code === '42703' || completo.error.code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
  if (!erroColuna) return completo;

  console.warn('Tentando salvar divida com campos basicos apos erro no payload completo:', completo.error);

  var basico = {
    cliente_id: payload.cliente_id,
    credor: payload.credor,
    tipo_divida: payload.tipo_divida,
    valor_total: payload.valor_total,
    valor_pago: payload.valor_pago,
    parcelas_total: payload.parcelas_total,
    parcelas_restantes: payload.parcelas_restantes
  };

  return supabaseClient
    .from('dividas')
    .insert([Object.assign(basico, getUserScopePayload())]);
}

async function addDivida() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var org = document.getElementById('dv-org').value.trim();
  var tipo = document.getElementById('dv-tipo').value;
  var dataInicio = document.getElementById('dv-inicio').value;

  var total = parseMoney(document.getElementById('dv-total'));
  var parcelas = parseInt(document.getElementById('dv-parcelas').value) || 0;
  var valorParcela = parseMoney(document.getElementById('dv-vparcela'));
  var taxa = parseFloat(document.getElementById('dv-taxa').value) || 0;
  var pago = parseMoney(document.getElementById('dv-pago'));

  if (!org || !total) {
    return alert('Preencha pelo menos Órgão e Valor.');
  }

  if (parcelas && (!valorParcela || !taxa)) {
    var calc = simularRenegociacaoDivida();
    if (calc) {
      valorParcela = Number(calc.pmt || valorParcela || 0);
      taxa = Number(calc.taxaMensal || taxa || 0);
      total = Number(calc.totalPago || total || 0);
    }
  }

  const payload = {
    cliente_id: activeClient,
    credor: org,
    tipo_divida: tipo,
    data_inicio: dataInicio || null,
    valor_total: total,
    parcelas_total: parcelas,
    parcelas_restantes: parcelas,
    valor_parcela: valorParcela,
    taxa: taxa,
    valor_pago: pago
  };

  const { error } = await insertDividaComFallback(payload);

  if (error) {
    console.error(error);
    alert('Erro ao salvar divida: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderDividas();
}

async function deleteDivida(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (!confirm('Excluir dívida?')) return;

  var c = data.clients[activeClient];
  var d = c.dividas[i];

  const { error } = await applyUserScope(
    supabaseClient
      .from('dividas')
      .delete()
      .eq('id', d.id)
  );

  if (error) {
    console.error(error);
    alert('Erro ao excluir');
    return;
  }

  await loadData();
  renderDividas();
}

async function registrarPagamentoDivida(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var valor = parseMoney(document.getElementById('dv-pag-inp-' + i));

  if (!valor) return alert('Informe valor');

  var c = data.clients[activeClient];
  var d = c.dividas[i];
  if (!d) return;

  var novoPago = Number(d.pago || 0) + valor;
  var valorParcela = Number(d.valorParcela || 0);
  var parcelasTotal = Number(d.parcelas || 0);
  var parcelasPagas = valorParcela > 0 ? Math.floor(novoPago / valorParcela) : 0;

  const { error } = await applyUserScope(
    supabaseClient
      .from('dividas')
      .update({
        valor_pago: novoPago,
        parcelas_restantes: Math.max(0, parcelasTotal - parcelasPagas)
      })
      .eq('id', d.id)
  );

  if (error) {
    console.error(error);
    alert('Erro ao registrar pagamento');
    return;
  }

  await loadData();
  renderDividas();
}
