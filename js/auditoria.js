async function buscarTodasLinhas(tabela, colunas) {
  const tamanhoPagina = 1000;
  let inicio = 0;
  let linhas = [];
  const uid = currentUserId();

  while (true) {
    let query = supabaseClient
      .from(tabela)
      .select(colunas)
      .range(inicio, inicio + tamanhoPagina - 1);

    if (userScopeEnabled) query = query.eq('user_id', uid);

    const { data: pagina, error } = await query;

    if (error) throw error;

    const recebidas = pagina || [];
    linhas = linhas.concat(recebidas);

    if (recebidas.length < tamanhoPagina) break;
    inicio += tamanhoPagina;
  }

  return linhas;
}

async function auditarCartoes() {
  const [lancamentos, clientes, cartoes] = await Promise.all([
    buscarTodasLinhas('lancamentos_cartao', 'id,cliente_id,cartao_id,data,descrição,categoria,tipo,valor'),
    buscarTodasLinhas('clientes', 'id,nome'),
    buscarTodasLinhas('cartoes', 'id,cliente_id,nome,digits')
  ]);

  const clientesMap = {};
  const cartoesMap = {};

  (clientes || []).forEach(cliente => {
    clientesMap[cliente.id] = cliente;
  });

  (cartoes || []).forEach(cartao => {
    cartoesMap[cartao.id] = cartao;
  });

  const tiposValidos = ['lancamento', 'estorno'];
  const problemas = [];
  const porTipo = {};
  const porCliente = {};
  const porCartao = {};

  function addProblema(row, tipo, detalhe) {
    const cliente = clientesMap[row.cliente_id];
    const cartao = cartoesMap[row.cartao_id];
    const item = {
      tipo,
      detalhe,
      id: row.id,
      cliente: cliente ? cliente.nome : '(cliente ausente)',
      cliente_id: row.cliente_id || null,
      cartao: cartao ? cartao.nome : '(cartão ausente)',
      cartao_id: row.cartao_id || null,
      data: row.data || '',
      descricao: row.descricao || '',
      categoria: row.categoria || '',
      tipo_lancamento: row.tipo || '',
      valor: Number(row.valor || 0)
    };

    problemas.push(item);
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    porCliente[item.cliente] = (porCliente[item.cliente] || 0) + 1;
    porCartao[item.cartao] = (porCartao[item.cartao] || 0) + 1;
  }

  (lancamentos || []).forEach(row => {
    const cartao = cartoesMap[row.cartao_id];
    const valor = Number(row.valor || 0);

    if (!row.cliente_id || !clientesMap[row.cliente_id]) {
      addProblema(row, 'cliente_invalido', 'Lançamento sem cliente valido.');
    }

    if (!row.cartao_id) {
      addProblema(row, 'cartao_vazio', 'Lançamento sem cartão vinculado.');
    } else if (!cartao) {
      addProblema(row, 'cartao_inexistente', 'Lançamento aponta para cartão que não existe.');
    } else if (row.cliente_id && cartao.cliente_id !== row.cliente_id) {
      addProblema(row, 'cartao_de_outro_cliente', 'Cartão pertence a outro cliente.');
    }

    if (!row.tipo) {
      addProblema(row, 'tipo_vazio', 'Tipo vazio; deve ser lançamento ou estorno.');
    } else if (!tiposValidos.includes(row.tipo)) {
      addProblema(row, 'tipo_invalido', 'Tipo fora do padrao esperado.');
    }

    if (row.data && !/^\d{4}-\d{2}-\d{2}/.test(row.data)) {
      addProblema(row, 'data_invalida', 'Data fora do formato ISO esperado.');
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      addProblema(row, 'valor_invalido', 'Valor zerado, negativo ou invalido.');
    }
  });

  const resultado = {
    geradoEm: new Date().toISOString(),
    totalLancamentos: (lancamentos || []).length,
    totalProblemas: problemas.length,
    porTipo,
    porCliente,
    porCartao,
    problemas
  };

  console.group('Auditoria de cartões');
  console.log('Resumo:', resultado);
  console.table(problemas);
  console.groupEnd();

  return resultado;
}

async function renderAuditoriaCartoes() {
  const output = document.getElementById('auditoria-cartoes-output');
  if (!output) return;

  output.innerHTML = '<p style="color:var(--muted);font-size:.83rem">Auditando dados...</p>';

  try {
    const resultado = await auditarCartoes();
    const tipos = Object.entries(resultado.porTipo)
      .map(([tipo, total]) => '<tr><td>' + esc(tipo) + '</td><td>' + total + '</td></tr>')
      .join('');
    const clientes = Object.entries(resultado.porCliente)
      .map(([cliente, total]) => '<tr><td>' + esc(cliente) + '</td><td>' + total + '</td></tr>')
      .join('');

    output.innerHTML =
      '<div class="summary-grid" style="margin-top:14px">'
      + '<div class="summary-card"><div class="s-label">Lançamentos</div><div class="s-val blue">' + resultado.totalLancamentos + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Problemas</div><div class="s-val red">' + resultado.totalProblemas + '</div></div>'
      + '</div>'
      + (resultado.totalProblemas
        ? '<p style="color:var(--muted);font-size:.83rem;margin:12px 0">Detalhes completos também foram enviados para o console do navegador.</p>'
          + '<p class="section-title">Problemas por tipo</p>'
          + '<table><thead><tr><th>Tipo</th><th>Total</th></tr></thead><tbody>' + tipos + '</tbody></table>'
          + '<p class="section-title" style="margin-top:14px">Problemas por cliente</p>'
          + '<table><thead><tr><th>Cliente</th><th>Total</th></tr></thead><tbody>' + clientes + '</tbody></table>'
        : '<p style="color:var(--success);font-size:.86rem;margin-top:12px">Nenhum problema encontrado nos lançamentos de cartão.</p>');
  } catch (err) {
    output.innerHTML = '<p style="color:var(--danger);font-size:.83rem">Erro ao auditar: ' + esc(err.message || String(err)) + '</p>';
  }
}

window.auditarCartoes = auditarCartoes;
window.renderAuditoriaCartoes = renderAuditoriaCartoes;
