// EXTRATO.JS - Conta corrente (Supabase)

var _exTipo = 'credito';
var _exFiltroTipo = 'todos';
var _exFiltroCat = '';
var _exFiltroMes = getPreviousMonthKey();
var _exFiltroBusca = '';
var _exMostrarDuplicados = false;
var _exManterDuplicado = {};
var _exDuplicadosResolvidos = carregarDuplicadosResolvidosExtrato();

function getPreviousMonthKey() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

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

function toggleDuplicadosExtrato() {
  _exMostrarDuplicados = !_exMostrarDuplicados;
  renderExtrato();
}

function carregarDuplicadosResolvidosExtrato() {
  try {
    return JSON.parse(localStorage.getItem('granafy_extrato_duplicados_resolvidos') || '{}') || {};
  } catch (e) {
    return {};
  }
}

function salvarDuplicadosResolvidosExtrato() {
  localStorage.setItem('granafy_extrato_duplicados_resolvidos', JSON.stringify(_exDuplicadosResolvidos || {}));
}

function chaveResolucaoDuplicadoExtrato(chave) {
  return String(activeClient || '') + '::' + chave;
}

function duplicadoResolvidoExtrato(chave) {
  return !!_exDuplicadosResolvidos[chaveResolucaoDuplicadoExtrato(chave)];
}

function resolverDuplicadoExtrato(chave) {
  _exDuplicadosResolvidos[chaveResolucaoDuplicadoExtrato(chave)] = true;
  salvarDuplicadosResolvidosExtrato();
}

function manterTodosDuplicadoExtrato(chave) {
  resolverDuplicadoExtrato(decodeURIComponent(chave));
  renderExtrato();
}

function chaveDuplicidadeExtrato(l) {
  var data = l.data || l.data_lancamento || '';
  var desc = String(l.desc || l.descricao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  var tipo = String(l.tipo || '').trim().toLowerCase();
  var centavos = Math.round(Number(l.valor || 0) * 100);

  return [
    data,
    desc,
    tipo,
    centavos
  ].join('|');
}

function encontrarDuplicadosExtratoClienteAtivo() {
  var c = data.clients[activeClient];
  if (!c || !Array.isArray(c.extrato)) return [];

  var vistos = new Map();
  var duplicados = [];

  c.extrato.forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (vistos.has(chave)) duplicados.push(l);
    else vistos.set(chave, l);
  });

  return duplicados.filter(l => l && l.id);
}

function deduplicarExtratoLista(lista) {
  var vistos = new Map();
  var unicos = [];
  var duplicados = [];

  (lista || []).forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (vistos.has(chave)) duplicados.push(l);
    else {
      vistos.set(chave, l);
      unicos.push(l);
    }
  });

  return { unicos, duplicados };
}

function agruparDuplicadosExtrato(lista) {
  var grupos = new Map();

  (lista || []).forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(l);
  });

  return Array.from(grupos.entries())
    .filter(([, linhas]) => linhas.length > 1)
    .map(([chave, linhas]) => ({ chave, linhas }));
}

function setManterDuplicadoExtrato(chave, id) {
  _exManterDuplicado[decodeURIComponent(chave)] = decodeURIComponent(id);
}

async function removerDuplicadosSelecionadosExtrato() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var c = data.clients[activeClient];
  if (!c || !Array.isArray(c.extrato)) return;

  var grupos = agruparDuplicadosExtrato(c.extrato).filter(grupo => !duplicadoResolvidoExtrato(grupo.chave));
  var idsParaExcluir = [];
  var chavesResolvidas = [];

  grupos.forEach(grupo => {
    var manterId = _exManterDuplicado[grupo.chave] || (grupo.linhas[0] && grupo.linhas[0].id);
    var temExclusao = false;
    grupo.linhas.forEach(l => {
      if (l.id && l.id !== manterId) {
        idsParaExcluir.push(l.id);
        temExclusao = true;
      }
    });
    if (temExclusao) chavesResolvidas.push(grupo.chave);
  });

  if (!idsParaExcluir.length) return alert('Nenhum duplicado selecionado para exclusao.');
  if (!confirm('Excluir ' + idsParaExcluir.length + ' lancamento(s) duplicado(s), mantendo os marcados como "Manter"?')) return;

  const { data: removidos, error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .in('id', idsParaExcluir)
      .select('id')
  );

  if (error) {
    console.error('Erro ao excluir duplicados selecionados:', error);
    alert('Nao foi possivel excluir duplicados: ' + (error.message || 'erro desconhecido'));
    return;
  }

  if (!removidos || removidos.length === 0) {
    alert('Nenhuma linha foi removida. O Supabase pode estar bloqueando a exclusao por permissao/RLS deste login.');
    return;
  }

  chavesResolvidas.forEach(resolverDuplicadoExtrato);
  await loadData();
  renderExtrato();
  alert(removidos.length + ' lancamento(s) duplicado(s) removido(s).');
}

async function removerDuplicadoGrupoExtrato(chaveCodificada) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var chave = decodeURIComponent(chaveCodificada);
  var c = data.clients[activeClient];
  if (!c || !Array.isArray(c.extrato)) return;

  var grupo = agruparDuplicadosExtrato(c.extrato).find(g => g.chave === chave);
  if (!grupo) {
    resolverDuplicadoExtrato(chave);
    renderExtrato();
    return;
  }

  var manterId = _exManterDuplicado[chave] || (grupo.linhas[0] && grupo.linhas[0].id);
  var idsParaExcluir = grupo.linhas
    .filter(l => l.id && l.id !== manterId)
    .map(l => l.id);

  if (!idsParaExcluir.length) {
    resolverDuplicadoExtrato(chave);
    renderExtrato();
    return;
  }

  if (!confirm('Excluir ' + idsParaExcluir.length + ' lancamento(s) deste grupo e manter o marcado?')) return;

  const { data: removidos, error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .in('id', idsParaExcluir)
      .select('id')
  );

  if (error) {
    console.error('Erro ao excluir duplicados do grupo:', error);
    alert('Nao foi possivel excluir duplicados: ' + (error.message || 'erro desconhecido'));
    return;
  }

  if (!removidos || removidos.length === 0) {
    alert('Nenhuma linha foi removida. O Supabase pode estar bloqueando a exclusao por permissao/RLS deste login.');
    return;
  }

  resolverDuplicadoExtrato(chave);
  await loadData();
  renderExtrato();
  alert(removidos.length + ' lancamento(s) removido(s).');
}

async function removerDuplicadosExtratoClienteAtivo() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var linhas = null;
  var query = applyUserScope(
    supabaseClient
      .from('lancamentos')
      .select('id,cliente_id,data_lancamento,descricao,categoria,tipo,valor')
      .eq('cliente_id', activeClient)
  );

  var resposta = await query;
  if (resposta.error) {
    console.error('Erro ao consultar duplicados:', resposta.error);
    alert('Nao foi possivel consultar duplicados: ' + (resposta.error.message || 'erro desconhecido'));
    return;
  }

  linhas = (resposta.data || []).map(row => ({
    id: row.id,
    data: row.data_lancamento || '',
    desc: row.descricao || '',
    cat: row.categoria || '',
    tipo: row.tipo || '',
    valor: Number(row.valor || 0)
  }));

  var vistos = new Map();
  var duplicados = [];
  linhas.forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (vistos.has(chave)) duplicados.push(l);
    else vistos.set(chave, l);
  });

  if (duplicados.length === 0) {
    alert('Nenhum duplicado encontrado no extrato deste cliente.');
    return;
  }

  if (!confirm('Foram encontrados ' + duplicados.length + ' lancamento(s) duplicado(s). Deseja remover os repetidos e manter apenas um de cada?')) {
    return;
  }

  var ids = duplicados.map(l => l.id);
  const { data: removidos, error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .in('id', ids)
      .select('id')
  );

  if (error) {
    console.error('Erro ao remover duplicados:', error);
    alert('Nao foi possivel remover duplicados: ' + (error.message || 'erro desconhecido'));
    return;
  }

  if (!removidos || removidos.length === 0) {
    alert('Nenhuma linha foi removida. O Supabase pode estar bloqueando a exclusao por permissao/RLS deste login.');
    return;
  }

  await loadData();
  renderExtrato();
  alert(removidos.length + ' lancamento(s) duplicado(s) removido(s).');
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
  var filtradosBrutos = lncs.filter(l => {
    var texto = ((l.desc || '') + ' ' + (l.cat || '')).toLowerCase();
    if (_exFiltroTipo !== 'todos' && l.tipo !== _exFiltroTipo) return false;
    if (_exFiltroCat && l.cat !== _exFiltroCat) return false;
    if (_exFiltroMes && !(l.data || '').startsWith(_exFiltroMes)) return false;
    if (_exFiltroBusca && !texto.includes(_exFiltroBusca)) return false;
    return true;
  });
  var gruposDuplicados = agruparDuplicadosExtrato(filtradosBrutos).filter(grupo => !duplicadoResolvidoExtrato(grupo.chave));
  var qtdDuplicadosPendentes = gruposDuplicados.reduce((total, grupo) => total + Math.max(grupo.linhas.length - 1, 0), 0);
  var filtrados = filtradosBrutos;

  var totalCredito = filtrados
    .filter(l => l.tipo === 'credito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var totalDebito = filtrados
    .filter(l => l.tipo === 'debito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var saldo = totalCredito - totalDebito;
  var catOpts = nomesCC().map(cat => '<option value="' + esc(cat) + '">' + esc(cat) + '</option>').join('');
  var filtroCatOpts = catsLanc.map(cat => '<option value="' + esc(cat) + '"' + (_exFiltroCat === cat ? ' selected' : '') + '>' + esc(cat) + '</option>').join('');
  var mesesFiltro = meses.slice();
  if (_exFiltroMes && !mesesFiltro.includes(_exFiltroMes)) mesesFiltro.unshift(_exFiltroMes);

  var filtroMesOpts = mesesFiltro.map(m => {
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
    + '</div>'
    + (qtdDuplicadosPendentes
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:-6px 0 12px;color:var(--warning);font-size:.78rem"><span>' + qtdDuplicadosPendentes + ' duplicado(s) pendente(s) de conferencia. Eles continuam aparecendo no extrato e nos totais.</span><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" onclick="toggleDuplicadosExtrato()">' + (_exMostrarDuplicados ? 'Ocultar duplicados' : 'Ver duplicados') + '</button></span></div>'
      : '<div style="display:flex;justify-content:flex-end;margin:-6px 0 12px;color:var(--muted);font-size:.78rem">Nenhuma duplicidade pendente de conferencia.</div>');

  if (_exMostrarDuplicados && gruposDuplicados.length) {
    html += '<p class="section-title">Duplicidades para conferencia</p>'
      + '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;color:var(--muted);font-size:.78rem">Resolva um grupo por vez.</div>';

    gruposDuplicados.forEach((grupo, gi) => {
      if (!_exManterDuplicado[grupo.chave] && grupo.linhas[0]) _exManterDuplicado[grupo.chave] = grupo.linhas[0].id;

      html += '<div class="form-card" style="padding:12px 14px;margin-bottom:12px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px"><p class="section-title" style="margin-bottom:0">Grupo ' + (gi + 1) + ' - ' + grupo.linhas.length + ' registros iguais</p><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" onclick="manterTodosDuplicadoExtrato(\'' + encodeURIComponent(grupo.chave) + '\')">Manter todos</button><button class="btn-sm red" onclick="removerDuplicadoGrupoExtrato(\'' + encodeURIComponent(grupo.chave) + '\')">Excluir nao mantidos</button></span></div>'
        + '<table class="data-table"><thead><tr><th>Manter</th><th>Data</th><th>Descricao</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>';

      grupo.linhas.forEach(l => {
        var realIdx = lncs.indexOf(l);
        var checked = _exManterDuplicado[grupo.chave] === l.id ? ' checked' : '';
        html += '<tr class="row-' + l.tipo + '">'
          + '<td><input type="radio" name="dup-' + gi + '" onchange="setManterDuplicadoExtrato(\'' + encodeURIComponent(grupo.chave) + '\',\'' + encodeURIComponent(l.id) + '\')" ' + checked + '/></td>'
          + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
          + '<td>' + esc(l.desc || '') + '</td>'
          + '<td><span class="badge badge-cat">' + esc(l.cat || '-') + '</span></td>'
          + '<td><span style="font-size:.79rem;color:' + (l.tipo === 'credito' ? 'var(--success)' : 'var(--danger)') + '">' + (l.tipo === 'credito' ? 'Receita' : 'Despesa') + '</span></td>'
          + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+ ' : '- ') + fmt(l.valor) + '</span></td>'
          + '<td><div class="row-actions"><button class="btn-icon" onclick="editExtrato(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteExtrato(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
          + '</tr>';
      });

      html += '</tbody></table></div>';
    });
  }

  if (false && _exMostrarDuplicados && dedupe.duplicados.length) {
    html += '<p class="section-title">Duplicados ocultos</p>'
      + '<table class="data-table" style="margin-bottom:18px">'
      + '<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>';

    [...dedupe.duplicados].sort((a, b) => (b.data || '').localeCompare(a.data || '')).forEach(l => {
      var realIdx = lncs.indexOf(l);
      html += '<tr class="row-' + l.tipo + '">'
        + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
        + '<td>' + esc(l.desc || '') + '</td>'
        + '<td><span class="badge badge-cat">' + esc(l.cat || '-') + '</span></td>'
        + '<td><span style="font-size:.79rem;color:' + (l.tipo === 'credito' ? 'var(--success)' : 'var(--danger)') + '">' + (l.tipo === 'credito' ? 'Receita' : 'Despesa') + '</span></td>'
        + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+ ' : '- ') + fmt(l.valor) + '</span></td>'
        + '<td><div class="row-actions"><button class="btn-icon" onclick="editExtrato(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteExtrato(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
        + '</tr>';
    });

    html += '</tbody></table>';
  }

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
        + '<td><div class="row-actions"><button class="btn-icon" onclick="editExtrato(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteExtrato(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
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

async function editExtrato(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var c = data.clients[activeClient];
  var lanc = c.extrato[i];
  if (!lanc || !lanc.id) return;

  var novaData = prompt('Data do lancamento (AAAA-MM-DD):', lanc.data || '');
  if (novaData === null) return;
  var novaDesc = prompt('Descricao:', lanc.desc || '');
  if (novaDesc === null) return;
  novaDesc = novaDesc.trim();
  var novaCat = prompt('Categoria:', lanc.cat || '');
  if (novaCat === null) return;
  var novoTipo = prompt('Tipo (credito ou debito):', lanc.tipo || 'debito');
  if (novoTipo === null) return;
  novoTipo = novoTipo === 'credito' ? 'credito' : 'debito';
  var novoValorTxt = prompt('Valor:', String(Number(lanc.valor || 0)).replace('.', ','));
  if (novoValorTxt === null) return;
  var novoValor = parseFloat(String(novoValorTxt).replace(/\./g, '').replace(',', '.')) || 0;

  if (!novaDesc || !novoValor) return alert('Descricao e valor sao obrigatorios.');

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .update({
        data_lancamento: novaData || null,
        descricao: novaDesc,
        categoria: novaCat || null,
        tipo: novoTipo,
        valor: Number(novoValor || 0)
      })
      .eq('id', lanc.id)
  );

  if (error) {
    console.error('Erro ao editar lancamento:', error);
    alert('Nao foi possivel editar o lancamento: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}
