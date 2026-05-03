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

function isCategoriaMovContas(nome) {
  return normalizarNomeCategoria(nome) === normalizarNomeCategoria(CATEGORIA_MOV_CONTAS.nome);
}

function sincronizarCatsCC(lista) {
  var cats = Array.isArray(lista) ? lista.map(function(cat) {
    if (typeof cat === 'string') return { nome: cat, tipo: 'variavel' };
    return {
      nome: cat && cat.nome ? cat.nome : '',
      tipo: cat && cat.tipo ? cat.tipo : 'variavel',
      fixa: !!(cat && cat.fixa)
    };
  }).filter(function(cat) {
    return String(cat.nome || '').trim();
  }) : [];

  var mov = cats.find(isCategoriaMovContas);
  if (mov) {
    mov.nome = CATEGORIA_MOV_CONTAS.nome;
    mov.tipo = CATEGORIA_MOV_CONTAS.tipo;
    mov.fixa = true;
  } else {
    cats.push(Object.assign({}, CATEGORIA_MOV_CONTAS));
  }

  return cats;
}

function loadCatsCC() {
  try {
    return sincronizarCatsCC(JSON.parse(localStorage.getItem('fb_cats_cc')) || DC_CC.map(function(c) { return Object.assign({}, c); }));
  } catch (e) {
    return sincronizarCatsCC(DC_CC.map(function(c) { return Object.assign({}, c); }));
  }
}

function saveCatsCC(a) {
  localStorage.setItem('fb_cats_cc', JSON.stringify(sincronizarCatsCC(a)));
}

function loadCatsCartao() {
  try { return JSON.parse(localStorage.getItem('fb_cats_cartao')) || [].concat(DC_CART); }
  catch (e) { return [].concat(DC_CART); }
}

function saveCatsCartao(a) {
  localStorage.setItem('fb_cats_cartao', JSON.stringify(a));
}

function nomesCC() {
  return loadCatsCC().map(function(c) { return c.nome || c; });
}

function tipoCat(nomeCategoria) {
  var cats = loadCatsCC();
  var found = cats.find(function(c) {
    return normalizarNomeCategoria(c.nome || c) === normalizarNomeCategoria(nomeCategoria);
  });
  if (!found) return 'variavel';
  return found.tipo || 'variavel';
}
