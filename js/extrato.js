// EXTRATO.JS - Conta corrente (Supabase)

var _exTipo = 'credito';
var _exFiltroTipo = 'todos';
var _exFiltroCat = '';
var _exFiltroMes = getPreviousMonthKey();
var _exFiltroConta = '';
var _exFiltroBusca = '';
var _exMostrarDuplicados = false;
var _exManterDuplicado = {};
var _exDuplicadosResolvidos = carregarDuplicadosResolvidosExtrato();

function contasClienteAtivo() {
  var c = data.clients[activeClient];
  return c && Array.isArray(c.contas) ? c.contas : [];
}

function nomeContaCliente(conta) {
  if (!conta) return 'Nao informada';
  var tipo = String(conta.tipo || '').toLowerCase() === 'poupanca' ? 'CP' : 'CC';
  var banco = conta.banco || 'Banco';
  var dados = [conta.agencia, conta.numero].filter(Boolean).join('/');
  return tipo + ' ' + banco + (dados ? ' ' + dados : '');
}

function nomeContaPorId(cliente, contaId) {
  if (!cliente || !contaId) return 'Nao informada';
  var conta = (cliente.contas || []).find(item => item.id === contaId);
  return nomeContaCliente(conta);
}

function contasOptionsCliente(contaIdAtual) {
  var contas = contasClienteAtivo();
  if (!contas.length) return '<option value="">Sem conta cadastrada</option>';

  return '<option value="">Sem conta</option>' + contas.map(conta =>
    '<option value="' + esc(conta.id) + '"' + (conta.id === contaIdAtual ? ' selected' : '') + '>' +
    esc(nomeContaCliente(conta)) +
    '</option>'
  ).join('');
}

function isMissingContaSchemaError(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return error.code === '42703' || error.code === '42P01' || error.code === 'PGRST204' || error.code === 'PGRST205' || msg.includes('conta_id') || msg.includes('contas') || msg.includes('schema cache');
}

var BANCOS_COMUNS = [
  'Banco do Brasil',
  'Bradesco',
  'Caixa',
  'Inter',
  'Itau',
  'Nubank',
  'Santander',
  'Sicredi',
  'Sicoob',
  'Outro'
];

async function insertLancamentoComFallback(payload) {
  var completo = await supabaseClient
    .from('lancamentos')
    .insert([Object.assign({}, payload, getUserScopePayload())]);

  if (!completo.error || !payload.conta_id || !isMissingContaSchemaError(completo.error)) return completo;

  var basico = Object.assign({}, payload);
  delete basico.conta_id;
  console.warn('Tentando salvar lancamento sem conta_id apos erro no schema:', completo.error);
  return supabaseClient
    .from('lancamentos')
    .insert([Object.assign(basico, getUserScopePayload())]);
}

async function cadastrarContaCliente() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var conta = await abrirFormularioContaCliente(null);
  if (!conta) return;

  const payload = {
    cliente_id: activeClient,
    tipo: conta.tipo,
    banco: conta.banco,
    agencia: conta.agencia || null,
    numero: conta.numero || null
  };

  const { error } = await supabaseClient
    .from('contas')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (error) {
    console.error('Erro ao cadastrar conta:', error);
    if (isMissingContaSchemaError(error)) {
      alert('A tabela de contas ainda nao existe no Supabase. Rode o arquivo sql/20260419_contas_clientes.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel cadastrar a conta: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

async function editarContaCliente(contaId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var conta = contasClienteAtivo().find(item => item.id === contaId);
  if (!conta) return alert('Conta nao encontrada.');

  var dados = await abrirFormularioContaCliente(conta);
  if (!dados) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('contas')
      .update({
        tipo: dados.tipo,
        banco: dados.banco,
        agencia: dados.agencia || null,
        numero: dados.numero || null
      })
      .eq('id', conta.id)
  );

  if (error) {
    console.error('Erro ao editar conta:', error);
    if (isMissingContaSchemaError(error)) {
      alert('A tabela de contas ainda nao existe no Supabase. Rode o arquivo sql/20260419_contas_clientes.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel editar a conta: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

function abrirFormularioContaCliente(conta) {
  return new Promise(resolve => {
    var overlay = appDialogEnsure();
    var titleEl = document.getElementById('appDialogTitle');
    var messageEl = document.getElementById('appDialogMessage');
    var actionsEl = document.getElementById('appDialogActions');
    var tipoAtual = (conta && conta.tipo) || 'corrente';
    var bancoAtual = (conta && conta.banco) || '';
    var bancoConhecido = BANCOS_COMUNS.includes(bancoAtual) ? bancoAtual : (bancoAtual ? 'Outro' : 'Banco do Brasil');

    overlay.classList.add('account-dialog-overlay');
    titleEl.textContent = conta ? 'Editar conta' : 'Cadastrar conta';
    messageEl.innerHTML =
      '<div class="account-form">' +
      '<div class="account-type-row" role="group" aria-label="Tipo de conta">' +
      '<button type="button" class="account-type-btn' + (tipoAtual !== 'poupanca' ? ' active' : '') + '" data-type="corrente">Conta corrente</button>' +
      '<button type="button" class="account-type-btn' + (tipoAtual === 'poupanca' ? ' active' : '') + '" data-type="poupanca">Poupanca</button>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Banco</label><select id="contaBanco">' +
      BANCOS_COMUNS.map(banco => '<option value="' + esc(banco) + '"' + (bancoConhecido === banco ? ' selected' : '') + '>' + esc(banco) + '</option>').join('') +
      '</select></div>' +
      '<div class="form-group account-other-bank" id="contaOutroWrap"><label>Nome do banco</label><input type="text" id="contaBancoOutro" value="' + esc(bancoConhecido === 'Outro' ? bancoAtual : '') + '" placeholder="Digite o banco"/></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Agencia</label><input type="text" id="contaAgencia" value="' + esc((conta && conta.agencia) || '') + '" inputmode="numeric" placeholder="Ex: 1234"/></div>' +
      '<div class="form-group"><label>Conta</label><input type="text" id="contaNumero" value="' + esc((conta && conta.numero) || '') + '" inputmode="numeric" placeholder="Ex: 000123-4"/></div>' +
      '</div>' +
      '<div class="account-form-error" id="contaFormError"></div>' +
      '</div>';
    actionsEl.innerHTML =
      '<button class="app-dialog-btn ghost" type="button" id="contaCancelar">Cancelar</button>' +
      '<button class="app-dialog-btn primary" type="button" id="contaSalvar">' + (conta ? 'Salvar' : 'Cadastrar') + '</button>';

    var tipoSelecionado = tipoAtual === 'poupanca' ? 'poupanca' : 'corrente';
    var bancoSelect = document.getElementById('contaBanco');
    var outroWrap = document.getElementById('contaOutroWrap');
    var outroInput = document.getElementById('contaBancoOutro');
    var agenciaInput = document.getElementById('contaAgencia');
    var numeroInput = document.getElementById('contaNumero');
    var errorEl = document.getElementById('contaFormError');
    var cancelar = document.getElementById('contaCancelar');
    var salvar = document.getElementById('contaSalvar');
    var typeBtns = Array.from(messageEl.querySelectorAll('.account-type-btn'));

    function syncOutro() {
      outroWrap.style.display = bancoSelect.value === 'Outro' ? 'flex' : 'none';
    }

    function close(value) {
      overlay.classList.remove('open');
      overlay.classList.remove('account-dialog-overlay');
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }

    function onKey(event) {
      if (event.key === 'Escape') close(null);
    }

    typeBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        tipoSelecionado = btn.dataset.type;
        typeBtns.forEach(item => item.classList.toggle('active', item === btn));
      });
    });

    bancoSelect.addEventListener('change', syncOutro);
    cancelar.addEventListener('click', () => close(null));
    salvar.addEventListener('click', function() {
      var banco = bancoSelect.value === 'Outro' ? outroInput.value.trim() : bancoSelect.value;
      if (!banco) {
        errorEl.textContent = 'Informe o banco da conta.';
        if (bancoSelect.value === 'Outro') outroInput.focus();
        return;
      }

      close({
        tipo: tipoSelecionado,
        banco: banco,
        agencia: agenciaInput.value.trim(),
        numero: numeroInput.value.trim()
      });
    });
    document.addEventListener('keydown', onKey);

    syncOutro();
    overlay.classList.add('open');
    setTimeout(() => bancoSelect.focus(), 0);
  });
}

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
  var conta = document.getElementById('ex-filtro-conta');
  var busca = document.getElementById('ex-filtro-busca');

  _exFiltroTipo = tipo ? tipo.value : 'todos';
  _exFiltroCat = cat ? cat.value : '';
  _exFiltroMes = mes ? mes.value : '';
  _exFiltroConta = conta ? conta.value : '';
  _exFiltroBusca = busca ? busca.value.trim().toLowerCase() : '';

  renderExtrato();
}

function limparFiltrosExtrato() {
  _exFiltroTipo = 'todos';
  _exFiltroCat = '';
  _exFiltroMes = '';
  _exFiltroConta = '';
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
  if (!(await appConfirm('Excluir ' + idsParaExcluir.length + ' lancamento(s) duplicado(s), mantendo os marcados como "Manter"?', { title: 'Excluir duplicados', confirmText: 'Excluir' }))) return;

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

  if (!(await appConfirm('Excluir ' + idsParaExcluir.length + ' lancamento(s) deste grupo e manter o marcado?', { title: 'Excluir duplicados', confirmText: 'Excluir' }))) return;

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

  if (!(await appConfirm('Foram encontrados ' + duplicados.length + ' lancamento(s) duplicado(s). Deseja remover os repetidos e manter apenas um de cada?', { title: 'Duplicados encontrados', confirmText: 'Remover repetidos' }))) {
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
    if (_exFiltroConta && l.contaId !== _exFiltroConta) return false;
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
  var contas = contasClienteAtivo();
  var contasResumoHtml = contas.length
    ? contas.map(conta =>
      '<span class="account-pill">'
      + '<span>' + esc(nomeContaCliente(conta)) + '</span>'
      + '<button class="btn-icon" onclick="editarContaCliente(\'' + esc(conta.id) + '\')" title="Editar conta">&#9998;</button>'
      + '</span>'
    ).join(' ')
    : '<span style="color:var(--muted);font-size:.85rem">Nenhuma conta cadastrada para este cliente.</span>';
  var filtroContaOpts = contas.map(conta =>
    '<option value="' + esc(conta.id) + '"' + (_exFiltroConta === conta.id ? ' selected' : '') + '>' +
    esc(nomeContaCliente(conta)) +
    '</option>'
  ).join('');
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
    + '<div class="form-card"><h3>Contas do cliente</h3>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + contasResumoHtml + '</div>'
    + '<button class="btn-sm" onclick="cadastrarContaCliente()">+ Cadastrar conta</button>'
    + '</div>'
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
    + '<div class="form-group" style="max-width:260px"><label>Conta <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="cadastrarContaCliente()">(+ nova)</span></label><select id="ex-conta">' + contasOptionsCliente('') + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Valor (R$)</label><input type="text" id="ex-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + '<button class="btn-add" onclick="addExtrato()">Adicionar</button>'
    + '</div>'
    + '<div class="form-card"><h3>Filtros</h3>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Tipo</label><select id="ex-filtro-tipo"><option value="todos"' + (_exFiltroTipo === 'todos' ? ' selected' : '') + '>Todos</option><option value="credito"' + (_exFiltroTipo === 'credito' ? ' selected' : '') + '>Crédito</option><option value="debito"' + (_exFiltroTipo === 'debito' ? ' selected' : '') + '>Débito</option></select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Categoria</label><select id="ex-filtro-cat"><option value="">Todas</option>' + filtroCatOpts + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Período</label><select id="ex-filtro-mes"><option value="">Todos</option>' + filtroMesOpts + '</select></div>'
    + '<div class="form-group" style="max-width:260px"><label>Conta</label><select id="ex-filtro-conta"><option value="">Todas</option>' + filtroContaOpts + '</select></div>'
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
    html += '<thead><tr><th>Data</th><th>Conta</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>';

    [...filtrados].sort((a, b) => (b.data || '').localeCompare(a.data || '')).forEach(l => {
      var realIdx = lncs.indexOf(l);
      html += '<tr class="row-' + l.tipo + '">'
        + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
        + '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeContaPorId(c, l.contaId)) + '</td>'
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
  var contaId = ((document.getElementById('ex-conta') || {}).value) || null;
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
    valor: Number(valor),
    conta_id: contaId || null
  };

  const { error } = await insertLancamentoComFallback(payload);

  if (error) {
    console.error(error);
    alert('Erro ao salvar: ' + (error.message || 'erro desconhecido'));
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

  if (typeof dividaReferenteAoPagamento === 'function' && typeof recalcularDividaPorHistorico === 'function') {
    var divida = dividaReferenteAoPagamento(c, lanc);
    if (divida) await recalcularDividaPorHistorico(c, divida, lanc.id);
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
