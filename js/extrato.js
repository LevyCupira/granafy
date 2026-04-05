// ════════════════════════════════════════════════════
// EXTRATO.JS — VERSÃO FINAL LIMPA (SUPABASE)
// ════════════════════════════════════════════════════

var _exTipo = 'credito';

function setTipoExtrato(t) {
  _exTipo = t;
}

function renderExtrato() {
  var c = data.clients[activeClient];

  if (!c) {
    document.getElementById('extrato-content').innerHTML =
      '<div class="empty-state"><div class="icon">👈</div>Selecione um cliente.</div>';
    return;
  }

  var lncs = c.extrato || [];

  var totalCredito = lncs
    .filter(l => l.tipo === 'credito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var totalDebito = lncs
    .filter(l => l.tipo === 'debito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var saldo = totalCredito - totalDebito;

  var html =
    '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Saldo</div><div class="s-val ' + (saldo >= 0 ? 'green' : 'red') + '">' + fmt(saldo) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Créditos</div><div class="s-val green">' + fmt(totalCredito) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Débitos</div><div class="s-val red">' + fmt(totalDebito) + '</div></div>'
    + '</div>'

    + '<div class="form-card"><h3>+ Novo lançamento</h3>'
    + '<div class="form-row">'
    + '<input type="date" id="ex-data"/>'
    + '<input type="text" id="ex-desc" placeholder="Descrição"/>'
    + '<input type="text" id="ex-valor" placeholder="Valor"/>'
    + '</div>'
    + '<button onclick="addExtrato()">Adicionar</button>'
    + '</div>';

  if (lncs.length === 0) {
    html += '<div class="empty-state">Nenhum lançamento</div>';
  } else {
    html += '<table class="table">';
    html += '<tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th></th></tr>';

    lncs.forEach((l, i) => {
      html += '<tr>'
        + '<td>' + (l.data || '') + '</td>'
        + '<td>' + (l.desc || '') + '</td>'
        + '<td>' + l.tipo + '</td>'
        + '<td>' + fmt(l.valor) + '</td>'
        + '<td><button onclick="deleteExtrato(' + i + ')">🗑</button></td>'
        + '</tr>';
    });

    html += '</table>';
  }

  document.getElementById('extrato-content').innerHTML = html;
}

async function addExtrato() {
  var dataLanc = document.getElementById('ex-data').value;
  var desc = document.getElementById('ex-desc').value.trim();
  var valor = parseMoney(document.getElementById('ex-valor'));

  if (!desc || !valor) {
    alert('Preencha os campos');
    return;
  }

  const payload = {
    cliente_id: activeClient,
    data: dataLanc || null,
    descricao: desc,
    tipo: _exTipo,
    valor: Number(valor)
  };

  const { error } = await supabaseClient
    .from('lancamentos')
    .insert([payload]);

  if (error) {
    console.error(error);
    alert('Erro ao salvar');
    return;
  }

  await loadData();
  renderExtrato();
}

async function deleteExtrato(i) {
  var c = data.clients[activeClient];
  var lanc = c.extrato[i];

  if (!lanc) return;

  const { error } = await supabaseClient
    .from('lancamentos')
    .delete()
    .eq('id', lanc.id);

  if (error) {
    console.error(error);
    alert('Erro ao excluir');
    return;
  }

  await loadData();
  renderExtrato();
}