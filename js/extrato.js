// EXTRATO.JS - Conta corrente (Supabase)

var _exTipo = 'credito';
var _exFiltroTipo = 'todos';
var _exFiltroCat = '';
var _exFiltroMes = '';
var _exFiltroBusca = '';

function setTipoExtrato(t) {
  _exTipo = t;
  var cred = document.getElementById('ex-tipo-credito');
  var deb = document.getElementById('ex-tipo-debito');
  if (cred) cred.classList.toggle('active', t === 'credito');
  if (deb) deb.classList.toggle('active', t === 'debito');
}

function aplicarFiltrosExtrato() {
  var tipo = document.getElementById('ex-filtro-tipo');
  var cat = document.getElementById('ex-filtro-cat');
  var mes = document.getElementById('ex-filtro-mes');
  var busca = document.getElementById('ex-filtro-busca');

  _exFiltroTipo = tipo ? tipo.value : 'todos';
  _exFiltroCat = cat ? cat.value : '';
  _exFiltroMes = mes ? mes.value : '';
  _exFiltroBusca = busca ? busca.value.trim().toLowerCase() : '';

  renderExtrato();
}

function limparFiltrosExtrato() {
  _exFiltroTipo = 'todos';
  _exFiltroCat = '';
  _exFiltroMes = '';
  _exFiltroBusca = '';
  renderExtrato();
}

function renderExtrato() {
  var c = data.clients[activeClient];
  var area = document.getElementById('extrato-content');
  if (!area) return;

  if (!c) {
    area.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    return;
  }

  var lncs = c.extrato || [];
  var meses = [...new Set(lncs.map(l => (l.data || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  var catsLanc = [...new Set(lncs.map(l => l.cat || '').filter(Boolean))].sort();
  var filtrados = lncs.filter(l => {
    var texto = ((l.desc || '') + ' ' + (l.cat || '')).toLowerCase();
    if (_exFiltroTipo !== 'todos' && l.tipo !== _exFiltroTipo) return false;
    if (_exFiltroCat && l.cat !== _exFiltroCat) return false;
    if (_exFiltroMes && !(l.data || '').startsWith(_exFiltroMes)) return false;
    if (_exFiltroBusca && !texto.includes(_exFiltroBusca)) return false;
    return true;
  });

  var totalCredito = filtrados
    .filter(l => l.tipo === 'credito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var totalDebito = filtrados
    .filter(l => l.tipo === 'debito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var saldo = totalCredito - totalDebito;
  var catOpts = nomesCC().map(cat => '<option value="' + esc(cat) + '">' + esc(cat) + '</option>').join('');
  var filtroCatOpts = catsLanc.map(cat => '<option value="' + esc(cat) + '"' + (_exFiltroCat === cat ? ' selected' : '') + '>' + esc(cat) + '</option>').join('');
  var filtroMesOpts = meses.map(m => {
    var parts = m.split('-');
    return '<option value="' + m + '"' + (_exFiltroMes === m ? ' selected' : '') + '>' + parts[1] + '/' + parts[0] + '</option>';
  }).join('');

  var html =
    '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Saldo</div><div class="s-val ' + (saldo >= 0 ? 'green' : 'red') + '">' + fmt(saldo) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Créditos</div><div class="s-val green">' + fmt(totalCredito) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Débitos</div><div class="s-val red">' + fmt(totalDebito) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Lançamentos</div><div class="s-val blue">' + filtrados.length + '</div></div>'
    + '</div>'
    + '<div class="form-card"><h3>+ Novo lançamento</h3>'
    + '<div class="tipo-toggle" style="margin-bottom:12px">'
    + '<button class="tipo-btn credito" id="ex-tipo-credito" onclick="setTipoExtrato(\'credito\')">Crédito</button>'
    + '<button class="tipo-btn debito" id="ex-tipo-debito" onclick="setTipoExtrato(\'debito\')">Débito</button>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Data</label><input type="date" id="ex-data"/></div>'
    + '<div class="form-group"><label>Descrição</label><input type="text" id="ex-desc" placeholder="Ex: salário, aluguel..."/></div>'
    + '<div class="form-group" style="max-width:180px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cc\')">(+ gerir)</span></label><select id="ex-cat">' + catOpts + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Valor (R$)</label><input type="text" id="ex-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + '<button class="btn-add" onclick="addExtrato()">Adicionar</button>'
    + '</div>'
    + '<div class="form-card"><h3>Filtros</h3>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Tipo</label><select id="ex-filtro-tipo"><option value="todos"' + (_exFiltroTipo === 'todos' ? ' selected' : '') + '>Todos</option><option value="credito"' + (_exFiltroTipo === 'credito' ? ' selected' : '') + '>Crédito</option><option value="debito"' + (_exFiltroTipo === 'debito' ? ' selected' : '') + '>Débito</option></select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Categoria</label><select id="ex-filtro-cat"><option value="">Todas</option>' + filtroCatOpts + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Período</label><select id="ex-filtro-mes"><option value="">Todos</option>' + filtroMesOpts + '</select></div>'
    + '<div class="form-group"><label>Busca</label><input type="text" id="ex-filtro-busca" value="' + esc(_exFiltroBusca) + '" placeholder="Descrição ou categoria" onkeydown="if(event.key===\'Enter\')aplicarFiltrosExtrato()"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="aplicarFiltrosExtrato()">Aplicar filtros</button><button class="btn-sm red" onclick="limparFiltrosExtrato()">Limpar</button></div>'
    + '</div>';

  if (lncs.length === 0) {
    html += '<div class="empty-state">Nenhum lançamento</div>';
  } else if (filtrados.length === 0) {
    html += '<div class="empty-state">Nenhum lançamento encontrado com os filtros atuais.</div>';
  } else {
    html += '<table class="data-table">';
    html += '<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>';

    [...filtrados].sort((a, b) => (b.data || '').localeCompare(a.data || '')).forEach(l => {
      var realIdx = lncs.indexOf(l);
      html += '<tr class="row-' + l.tipo + '">'
        + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
        + '<td>' + esc(l.desc || '') + '</td>'
        + '<td><span class="badge badge-cat">' + esc(l.cat || '-') + '</span></td>'
        + '<td><span style="font-size:.79rem;color:' + (l.tipo === 'credito' ? 'var(--success)' : 'var(--danger)') + '">' + (l.tipo === 'credito' ? 'Receita' : 'Despesa') + '</span></td>'
        + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+ ' : '- ') + fmt(l.valor) + '</span></td>'
        + '<td><button class="btn-delete" onclick="deleteExtrato(' + realIdx + ')">X</button></td>'
        + '</tr>';
    });

    html += '</tbody></table>';
  }

  area.innerHTML = html;

  var dataInput = document.getElementById('ex-data');
  if (dataInput) dataInput.value = new Date().toISOString().slice(0, 10);

  setTipoExtrato(_exTipo);
  initMoneyInputs(area);
}

async function addExtrato() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var dataLanc = document.getElementById('ex-data').value;
  var desc = document.getElementById('ex-desc').value.trim();
  var cat = document.getElementById('ex-cat').value;
  var valor = parseMoney(document.getElementById('ex-valor'));

  if (!desc || !valor) {
    alert('Preencha os campos');
    return;
  }

  const payload = {
    cliente_id: activeClient,
    data_lancamento: dataLanc || null,
    descricao: desc,
    categoria: cat || null,
    tipo: _exTipo,
    valor: Number(valor)
  };

  const { error } = await supabaseClient
    .from('lancamentos')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (error) {
    console.error(error);
    alert('Erro ao salvar');
    return;
  }

  await loadData();
  renderExtrato();
}

async function deleteExtrato(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var c = data.clients[activeClient];
  var lanc = c.extrato[i];

  if (!lanc) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .eq('id', lanc.id)
  );

  if (error) {
    console.error(error);
    alert('Erro ao excluir');
    return;
  }

  await loadData();
  renderExtrato();
}
