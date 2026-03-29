// ════════════════════════════════════════════════════
// CATEGORIAS.JS — Listas de categorias com tipo (Fixa/Variável)
// Usado por: extrato, resumo, dre, settings
// ════════════════════════════════════════════════════

// Categorias da Conta Corrente com tipo para o DRE
var DC_CC = [
  // Receitas
  { nome: 'Salário',                tipo: 'receita' },
  { nome: 'Freelance',              tipo: 'receita' },
  { nome: 'Transferência recebida', tipo: 'receita' },
  { nome: 'Investimento',           tipo: 'receita' },
  { nome: 'Dividendos',             tipo: 'receita' },
  // Despesas Fixas
  { nome: 'Aluguel',                tipo: 'fixa' },
  { nome: 'Água',                   tipo: 'fixa' },
  { nome: 'Energia',                tipo: 'fixa' },
  { nome: 'Telefone/Internet',      tipo: 'fixa' },
  { nome: 'Empréstimo / Financiamento', tipo: 'fixa' },
  // Despesas Variáveis
  { nome: 'Alimentação',            tipo: 'variavel' },
  { nome: 'Transporte',             tipo: 'variavel' },
  { nome: 'Saúde',                  tipo: 'variavel' },
  { nome: 'Educação',               tipo: 'variavel' },
  { nome: 'Lazer',                  tipo: 'variavel' },
  { nome: 'Vestuário',              tipo: 'variavel' },
  { nome: 'Outros',                 tipo: 'variavel' },
];

// Categorias do Cartão (sem tipo DRE — entram como "variável" no DRE)
var DC_CART = [
  'Alimentação','Farmácia','Mercado','Transporte','Lazer',
  'Vestuário','Saúde','Educação','Streaming','Assinatura',
  'Viagem','Restaurante','Combustível','Outros'
];

function loadCatsCC() {
  try { return JSON.parse(localStorage.getItem('fb_cats_cc')) || DC_CC.map(c => ({ ...c })); }
  catch { return DC_CC.map(c => ({ ...c })); }
}

function saveCatsCC(a) {
  localStorage.setItem('fb_cats_cc', JSON.stringify(a));
}

function loadCatsCartao() {
  try { return JSON.parse(localStorage.getItem('fb_cats_cartao')) || [...DC_CART]; }
  catch { return [...DC_CART]; }
}

function saveCatsCartao(a) {
  localStorage.setItem('fb_cats_cartao', JSON.stringify(a));
}

// Retorna só os nomes (para selects)
function nomesCC() {
  return loadCatsCC().map(c => c.nome || c);
}

// Retorna o tipo de uma categoria CC ('receita' | 'fixa' | 'variavel')
function tipoCat(nomeCategoria) {
  const cats = loadCatsCC();
  const found = cats.find(c => (c.nome || c) === nomeCategoria);
  if (!found) return 'variavel';
  return found.tipo || 'variavel';
}
