// ════════════════════════════════════════════════════
// DIVIDAS.JS — VERSÃO FINAL LIMPA (SUPABASE)
// ════════════════════════════════════════════════════

var DV_TIPOS = ['Empréstimo','Financiamento','Cartão de crédito','Cheque especial','Consignado','Outros'];

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
    + '<div class="calc-result-item"><div class="cr-label">CET anual</div><div class="cr-val green">' + _lastCalc.cet.toFixed(2) + '%</div></div>'
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
    + '<h3>Simulador de financiamento</h3>'
    + '<div class="calc-sub">Calcule a parcela pela tabela PRICE antes de cadastrar uma dívida.</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Valor financiado</label><input type="text" id="calc-pv" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group"><label>Taxa mensal (%)</label><input type="number" id="calc-taxa" min="0" step="0.01" placeholder="Ex: 1.5"/></div>'
    + '<div class="form-group"><label>Parcelas</label><input type="number" id="calc-parcelas" min="1" step="1" placeholder="Ex: 24"/></div>'
    + '</div>'
    + '<button class="btn-add" onclick="calcularDivida()">Calcular</button>'
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
}

function calcularDivida() {
  var pv = parseMoney(document.getElementById('calc-pv'));
  var taxa = parseFloat(document.getElementById('calc-taxa').value) || 0;
  var parcelas = parseInt(document.getElementById('calc-parcelas').value) || 0;

  if (!pv || !parcelas) {
    alert('Informe valor financiado e quantidade de parcelas.');
    return;
  }

  _lastCalc = calcPrice(pv, taxa, parcelas);
  renderDividas();
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

  const { error } = await supabaseClient
    .from('dividas')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (error) {
    console.error(error);
    alert('Erro ao salvar dívida');
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
