// Categorias da conta corrente e do cartao.
// A categoria "Mov. Contas" e fixa e representa transferencia interna.

var CATEGORIA_MOV_CONTAS = { nome: 'Mov. Contas', tipo: 'transferencia', fixa: true };

var DC_CC = [
  { nome: 'Salario', tipo: 'receita' },
  { nome: 'Freelance', tipo: 'receita' },
  { nome: 'Transferencia recebida', tipo: 'receita' },
  { nome: 'Investimento', tipo: 'receita' },
  { nome: 'Dividendos', tipo: 'receita' },
  { nome: 'Aluguel', tipo: 'fixa' },
  { nome: 'Agua', tipo: 'fixa' },
  { nome: 'Energia', tipo: 'fixa' },
  { nome: 'Telefone/Internet', tipo: 'fixa' },
  { nome: 'Emprestimo / Financiamento', tipo: 'fixa' },
  { nome: 'Alimentacao', tipo: 'variavel' },
  { nome: 'Transporte', tipo: 'variavel' },
  { nome: 'Saude', tipo: 'variavel' },
  { nome: 'Educacao', tipo: 'variavel' },
  { nome: 'Lazer', tipo: 'variavel' },
  { nome: 'Vestuario', tipo: 'variavel' },
  { nome: 'Outros', tipo: 'variavel' },
  CATEGORIA_MOV_CONTAS
];

var DC_CART = [
  'Alimentacao', 'Farmacia', 'Mercado', 'Transporte', 'Lazer',
  'Vestuario', 'Saude', 'Educacao', 'Streaming', 'Assinatura',
  'Viagem', 'Restaurante', 'Combustivel', 'Outros'
];

var DC_FINANCEIRO = [
  'Mensalidade', 'Servicos', 'Produtos', 'Eventos', 'Honorarios',
  'Impostos', 'Fornecedores', 'Aluguel', 'Marketing', 'Salarios', 'Outros'
];

function normalizarNomeCategoria(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function compararCategoriaNome(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

function isCategoriaMovContas(nome) {
  return normalizarNomeCategoria(nome) === normalizarNomeCategoria(CATEGORIA_MOV_CONTAS.nome);
}

function isCategoriaFixaCC(cat) {
  var nome = typeof cat === 'string' ? cat : (cat && cat.nome);
  return isCategoriaMovContas(nome);
}

function ordenarCategoriasCC(lista) {
  return (lista || []).slice().sort(function(a, b) {
    return compararCategoriaNome(a && a.nome, b && b.nome);
  });
}

function ordenarCategoriasCartao(lista) {
  return (lista || []).slice().sort(compararCategoriaNome);
}

function getCategoryClientId(clientId) {
  var alvo = clientId || activeClient || '';
  return String(alvo || '').trim();
}

function catsCCStorageKey(clientId) {
  var id = getCategoryClientId(clientId);
  return id ? ('fb_cats_cc__' + id) : 'fb_cats_cc';
}

function catsCartaoStorageKey(clientId) {
  var id = getCategoryClientId(clientId);
  return id ? ('fb_cats_cartao__' + id) : 'fb_cats_cartao';
}

function catsFinanceiroStorageKey(clientId) {
  var id = getCategoryClientId(clientId);
  return id ? ('fb_cats_financeiro__' + id) : 'fb_cats_financeiro';
}

function isCategoriasClienteTableMissing(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || (msg.includes('categorias_cliente') && (msg.includes('relation') || msg.includes('schema cache')));
}

async function persistirCategoriasClienteNoSupabase(escopo, lista, clientId) {
  var alvo = getCategoryClientId(clientId);
  if (!alvo || typeof supabaseClient === 'undefined' || !supabaseClient || typeof currentUserId !== 'function' || !currentUserId()) return;

  var linhas = escopo === 'cc'
    ? sincronizarCatsCC(lista).map(function(cat) {
        return Object.assign({
          cliente_id: alvo,
          escopo: 'cc',
          nome: cat.nome,
          tipo: cat.tipo || 'variavel',
          fixa: !!cat.fixa
        }, getUserScopePayload());
      })
    : sincronizarCatsCartao(lista).map(function(nome) {
        return Object.assign({
          cliente_id: alvo,
          escopo: 'cartao',
          nome: nome,
          tipo: 'variavel',
          fixa: false
        }, getUserScopePayload());
      });

  var deleteQuery = supabaseClient
    .from('categorias_cliente')
    .delete()
    .eq('cliente_id', alvo)
    .eq('escopo', escopo);
  deleteQuery = typeof applyUserScope === 'function' ? applyUserScope(deleteQuery) : deleteQuery;
  var deleteRes = await deleteQuery;
  if (deleteRes && deleteRes.error) {
    if (isCategoriasClienteTableMissing(deleteRes.error)) {
      console.warn('Tabela categorias_cliente ainda nao existe no Supabase. Rode a migracao 20260508_categorias_por_cliente.sql.');
      return;
    }
    throw new Error(deleteRes.error.message || 'Erro ao limpar categorias do cliente.');
  }

  if (!linhas.length) return;

  var insertRes = await supabaseClient.from('categorias_cliente').insert(linhas);
  if (insertRes && insertRes.error) {
    if (isCategoriasClienteTableMissing(insertRes.error)) {
      console.warn('Tabela categorias_cliente ainda nao existe no Supabase. Rode a migracao 20260508_categorias_por_cliente.sql.');
      return;
    }
    throw new Error(insertRes.error.message || 'Erro ao salvar categorias do cliente.');
  }
}

function sincronizarCatsCC(lista) {
  var padroes = new Map(
    DC_CC.map(function(cat) {
      return [normalizarNomeCategoria(cat.nome), { nome: cat.nome, tipo: cat.tipo, fixa: !!cat.fixa }];
    })
  );

  var mapa = new Map();
  var origem = Array.isArray(lista) && lista.length
    ? lista
    : DC_CC.map(function(cat) { return Object.assign({}, cat); });

  origem.forEach(function(cat) {
    var nome = typeof cat === 'string' ? cat : (cat && cat.nome);
    nome = String(nome || '').trim();
    if (!nome) return;

    var chave = normalizarNomeCategoria(nome);
    if (mapa.has(chave)) return;

    var padrao = padroes.get(chave);
    var tipo = typeof cat === 'string'
      ? (padrao ? padrao.tipo : 'variavel')
      : (cat && cat.tipo ? cat.tipo : (padrao ? padrao.tipo : 'variavel'));

    mapa.set(chave, {
      nome: padrao && padrao.fixa ? padrao.nome : nome,
      tipo: padrao && padrao.fixa ? padrao.tipo : tipo,
      fixa: !!(padrao && padrao.fixa)
    });
  });

  if (!mapa.has(normalizarNomeCategoria(CATEGORIA_MOV_CONTAS.nome))) {
    mapa.set(normalizarNomeCategoria(CATEGORIA_MOV_CONTAS.nome), Object.assign({}, CATEGORIA_MOV_CONTAS));
  } else {
    mapa.set(normalizarNomeCategoria(CATEGORIA_MOV_CONTAS.nome), Object.assign({}, CATEGORIA_MOV_CONTAS));
  }

  return ordenarCategoriasCC(Array.from(mapa.values()));
}

function loadCatsCC(clientId) {
  var alvo = getCategoryClientId(clientId);
  if (!alvo) return sincronizarCatsCC(DC_CC.map(function(c) { return Object.assign({}, c); }));

  try {
    var cliente = data && data.clients ? data.clients[alvo] : null;
    var emMemoria = cliente && Array.isArray(cliente.catsCC) ? cliente.catsCC : null;
    if (emMemoria && emMemoria.length) return sincronizarCatsCC(emMemoria);

    var salvo = JSON.parse(localStorage.getItem(catsCCStorageKey(alvo)));
    var lista = sincronizarCatsCC(salvo);
    if (cliente) cliente.catsCC = lista.slice();
    return lista;
  } catch (e) {
    return sincronizarCatsCC(DC_CC.map(function(c) { return Object.assign({}, c); }));
  }
}

function saveCatsCC(lista, clientId) {
  var alvo = getCategoryClientId(clientId);
  var normalizada = sincronizarCatsCC(lista);
  if (alvo && data && data.clients && data.clients[alvo]) data.clients[alvo].catsCC = normalizada.slice();
  localStorage.setItem(catsCCStorageKey(alvo), JSON.stringify(normalizada));
  var syncPromise = persistirCategoriasClienteNoSupabase('cc', normalizada, alvo);
  syncPromise.catch(function(err) {
    console.error('Nao foi possivel sincronizar categorias CC no Supabase:', err);
  });
  return syncPromise;
}

function sincronizarCatsCartao(lista) {
  var mapa = new Map();
  var origem = Array.isArray(lista) && lista.length ? lista : DC_CART.slice();

  origem.forEach(function(cat) {
    var nome = String(cat || '').trim();
    if (!nome) return;
    var chave = normalizarNomeCategoria(nome);
    if (mapa.has(chave)) return;
    mapa.set(chave, nome);
  });

  return ordenarCategoriasCartao(Array.from(mapa.values()));
}

function sincronizarCatsFinanceiro(lista) {
  var mapa = new Map();
  var origem = Array.isArray(lista) && lista.length ? lista : DC_FINANCEIRO.slice();

  origem.forEach(function(cat) {
    var nome = String(cat || '').trim();
    if (!nome) return;
    var chave = normalizarNomeCategoria(nome);
    if (mapa.has(chave)) return;
    mapa.set(chave, nome);
  });

  return ordenarCategoriasCartao(Array.from(mapa.values()));
}

function loadCatsCartao(clientId) {
  var alvo = getCategoryClientId(clientId);
  if (!alvo) return sincronizarCatsCartao(DC_CART.slice());

  try {
    var cliente = data && data.clients ? data.clients[alvo] : null;
    var emMemoria = cliente && Array.isArray(cliente.catsCartao) ? cliente.catsCartao : null;
    if (emMemoria && emMemoria.length) return sincronizarCatsCartao(emMemoria);

    var salvo = JSON.parse(localStorage.getItem(catsCartaoStorageKey(alvo)));
    var lista = sincronizarCatsCartao(salvo);
    if (cliente) cliente.catsCartao = lista.slice();
    return lista;
  } catch (e) {
    return sincronizarCatsCartao(DC_CART.slice());
  }
}

function loadCatsFinanceiro(clientId) {
  var alvo = getCategoryClientId(clientId);
  if (!alvo) return sincronizarCatsFinanceiro(DC_FINANCEIRO.slice());

  try {
    var cliente = data && data.clients ? data.clients[alvo] : null;
    var emMemoria = cliente && Array.isArray(cliente.catsFinanceiro) ? cliente.catsFinanceiro : null;
    if (emMemoria && emMemoria.length) return sincronizarCatsFinanceiro(emMemoria);

    var salvo = JSON.parse(localStorage.getItem(catsFinanceiroStorageKey(alvo)));
    var lista = sincronizarCatsFinanceiro(salvo);
    if (cliente) cliente.catsFinanceiro = lista.slice();
    return lista;
  } catch (e) {
    return sincronizarCatsFinanceiro(DC_FINANCEIRO.slice());
  }
}

function saveCatsCartao(lista, clientId) {
  var alvo = getCategoryClientId(clientId);
  var normalizada = sincronizarCatsCartao(lista);
  if (alvo && data && data.clients && data.clients[alvo]) data.clients[alvo].catsCartao = normalizada.slice();
  localStorage.setItem(catsCartaoStorageKey(alvo), JSON.stringify(normalizada));
  var syncPromise = persistirCategoriasClienteNoSupabase('cartao', normalizada, alvo);
  syncPromise.catch(function(err) {
    console.error('Nao foi possivel sincronizar categorias de cartao no Supabase:', err);
  });
  return syncPromise;
}

function saveCatsFinanceiro(lista, clientId) {
  var alvo = getCategoryClientId(clientId);
  var normalizada = sincronizarCatsFinanceiro(lista);
  if (alvo && data && data.clients && data.clients[alvo]) data.clients[alvo].catsFinanceiro = normalizada.slice();
  localStorage.setItem(catsFinanceiroStorageKey(alvo), JSON.stringify(normalizada));
  var linhas = normalizada.map(function(nome) {
    return Object.assign({
      cliente_id: alvo,
      escopo: 'financeiro',
      nome: nome,
      tipo: 'receita',
      fixa: false
    }, getUserScopePayload());
  });
  var syncPromise = (async function() {
    if (!alvo || typeof supabaseClient === 'undefined' || !supabaseClient || typeof currentUserId !== 'function' || !currentUserId()) return;
    var deleteQuery = supabaseClient.from('categorias_cliente').delete().eq('cliente_id', alvo).eq('escopo', 'financeiro');
    deleteQuery = typeof applyUserScope === 'function' ? applyUserScope(deleteQuery) : deleteQuery;
    var deleteRes = await deleteQuery;
    if (deleteRes && deleteRes.error) {
      if (isCategoriasClienteTableMissing(deleteRes.error)) return;
      throw new Error(deleteRes.error.message || 'Erro ao limpar categorias financeiras.');
    }
    if (!linhas.length) return;
    var insertRes = await supabaseClient.from('categorias_cliente').insert(linhas);
    if (insertRes && insertRes.error) {
      if (isCategoriasClienteTableMissing(insertRes.error)) return;
      throw new Error(insertRes.error.message || 'Erro ao salvar categorias financeiras.');
    }
  })();
  syncPromise.catch(function(err) {
    console.error('Nao foi possivel sincronizar categorias financeiras no Supabase:', err);
  });
  return syncPromise;
}

function nomesCC(clientId) {
  return loadCatsCC(clientId).map(function(c) { return c.nome; });
}

function nomesCartao(clientId) {
  return loadCatsCartao(clientId).slice();
}

function nomesFinanceiro(clientId) {
  return loadCatsFinanceiro(clientId).slice();
}

function tipoCat(nomeCategoria, clientId) {
  if (isCategoriaMovContas(nomeCategoria)) return 'transferencia';
  var cats = loadCatsCC(clientId);
  var found = cats.find(function(c) {
    return normalizarNomeCategoria(c.nome) === normalizarNomeCategoria(nomeCategoria);
  });
  return found ? (found.tipo || 'variavel') : 'variavel';
}
