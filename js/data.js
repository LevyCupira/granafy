// ════════════════════════════════════════════════════
// DATA.JS — SUPABASE (VERSÃO LIMPA)
// ════════════════════════════════════════════════════

var data = { clients: {} };
var activeClient = null;
var activeTab = 'cartao';

async function loadData() {
  data = { clients: {} };

  const [
    { data: clientesRows },
    { data: dividasRows },
    { data: lancRows },
    { data: cartoesRows },
    { data: lancCartaoRows }
  ] = await Promise.all([
    supabaseClient.from('clientes').select('*').order('nome', { ascending: true }),
    supabaseClient.from('dividas').select('*'),
    supabaseClient.from('lancamentos').select('*'),
    supabaseClient.from('cartoes').select('*'),
    supabaseClient.from('lancamentos_cartao').select('*')
  ]);

  const dividasPorCliente = {};
  (dividasRows || []).forEach(d => {
    if (!dividasPorCliente[d.cliente_id]) dividasPorCliente[d.cliente_id] = [];
    dividasPorCliente[d.cliente_id].push({
      id: d.id,
      org: d.credor || '',
      tipo: d.tipo_divida || '',
      dataInicio: d.data_inicio || null,
      total: Number(d.valor_total || 0),
      parcelas: Number(d.parcelas_total || 0),
      valorParcela: Number(d.valor_parcela || 0),
      taxa: Number(d.taxa || 0),
      pago: Number(d.valor_pago || 0),
      restantes: Number(d.parcelas_restantes || 0),
      pagamentos: []
    });
  });

  const extratoPorCliente = {};
  (lancRows || []).forEach(l => {
    if (!extratoPorCliente[l.cliente_id]) extratoPorCliente[l.cliente_id] = [];
    extratoPorCliente[l.cliente_id].push({
      id: l.id,
      data: l.data || null,
      desc: l.descricao || '',
      cat: l.categoria || '',
      tipo: l.tipo || '',
      valor: Number(l.valor || 0)
    });
  });

  const cartoesPorCliente = {};
  (cartoesRows || []).forEach(cc => {
    if (!cartoesPorCliente[cc.cliente_id]) cartoesPorCliente[cc.cliente_id] = [];
    cartoesPorCliente[cc.cliente_id].push(cc);
  });

  const lancCartaoPorCliente = {};
  (lancCartaoRows || []).forEach(l => {
    if (!lancCartaoPorCliente[l.cliente_id]) lancCartaoPorCliente[l.cliente_id] = [];
    lancCartaoPorCliente[l.cliente_id].push(l);
  });

  (clientesRows || []).forEach(c => {
    data.clients[c.id] = {
      id: c.id,
      name: c.nome || '',
      cartoes: cartoesPorCliente[c.id] || [],
      cartao: lancCartaoPorCliente[c.id] || [],
      contas: [],
      dividas: dividasPorCliente[c.id] || [],
      extrato: extratoPorCliente[c.id] || []
    };
  });
}

function saveData() {
  // Não usamos mais localStorage
}