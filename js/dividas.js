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

async function addDivida() {
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
    .insert([payload]);

  if (error) {
    console.error(error);
    alert('Erro ao salvar dívida');
    return;
  }

  await loadData();
  renderDividas();
}

async function deleteDivida(i) {
  if (!confirm('Excluir dívida?')) return;

  var c = data.clients[activeClient];
  var d = c.dividas[i];

  const { error } = await supabaseClient
    .from('dividas')
    .delete()
    .eq('id', d.id);

  if (error) {
    console.error(error);
    alert('Erro ao excluir');
    return;
  }

  await loadData();
  renderDividas();
}

async function registrarPagamentoDivida(i) {
  var valor = parseMoney(document.getElementById('dv-pag-inp-' + i));

  if (!valor) return alert('Informe valor');

  var c = data.clients[activeClient];
  var d = c.dividas[i];

  const { error } = await supabaseClient
    .from('dividas')
    .update({
      valor_pago: Number(d.pago || 0) + valor
    })
    .eq('id', d.id);

  if (error) {
    console.error(error);
    alert('Erro ao registrar pagamento');
    return;
  }

  await loadData();
  renderDividas();
}