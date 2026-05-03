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

function loadCatsCC() {
  try {
    return sincronizarCatsCC(JSON.parse(localStorage.getItem('fb_cats_cc')));
  } catch (e) {
    return sincronizarCatsCC(DC_CC.map(function(c) { return Object.assign({}, c); }));
  }
}

function saveCatsCC(lista) {
  localStorage.setItem('fb_cats_cc', JSON.stringify(sincronizarCatsCC(lista)));
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

function loadCatsCartao() {
  try {
    return sincronizarCatsCartao(JSON.parse(localStorage.getItem('fb_cats_cartao')));
  } catch (e) {
    return sincronizarCatsCartao(DC_CART.slice());
  }
}

function saveCatsCartao(lista) {
  localStorage.setItem('fb_cats_cartao', JSON.stringify(sincronizarCatsCartao(lista)));
}

function nomesCC() {
  return loadCatsCC().map(function(c) { return c.nome; });
}

function nomesCartao() {
  return loadCatsCartao().slice();
}

function tipoCat(nomeCategoria) {
  if (isCategoriaMovContas(nomeCategoria)) return 'transferencia';
  var cats = loadCatsCC();
  var found = cats.find(function(c) {
    return normalizarNomeCategoria(c.nome) === normalizarNomeCategoria(nomeCategoria);
  });
  return found ? (found.tipo || 'variavel') : 'variavel';
}
