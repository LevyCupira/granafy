window.migrarDadosCompletos = async function () {
  const bruto = localStorage.getItem('fb_data');
  if (!bruto) {
    console.log('Sem dados no localStorage.');
    return;
  }

  const json = JSON.parse(bruto);
  const clientes = json.clients || {};
  const resumo = [];

  for (const [idLocal, cliente] of Object.entries(clientes)) {
    const nome = cliente.name || '';

    const { data: clienteDB, error: erroCliente } = await supabaseClient
      .from('clientes')
      .select('id,nome')
      .eq('nome', nome)
      .single();

    if (erroCliente || !clienteDB) {
      console.warn('Cliente não encontrado no banco:', nome, erroCliente);
      resumo.push({
        cliente: nome,
        dividas: 0,
        lancamentos: 0,
        ok: false
      });
      continue;
    }

    const clienteId = clienteDB.id;
    let dividasOk = 0;
    let lancamentosOk = 0;

     for (const d of (cliente.dividas || [])) {
      const payloadDivida = {
       cliente_id: clienteId,
        credor: d.org || null,
        tipo_divida: d.tipo || null,
        valor_total: Number(d.total || 0),
        valor_pago: Number(d.pago || 0),
        parcelas_total: Number(d.parcelas || 0),
        parcelas_restantes: Number(d.restantes || d.parcelas || 0),
        observacoes: null
  };

  const { error } = await supabaseClient
    .from('dividas')
    .insert([payloadDivida]);

  if (error) {
    console.error('Erro ao migrar dívida de', nome, d, error);
  } else {
    dividasOk++;
  }
}

    for (const l of (cliente.extrato || [])) {
      const payloadLancamento = {
        cliente_id: clienteId,
        data_lancamento: l.data || null,
        descricao: l.desc || null,
        categoria: l.cat || null,
        tipo: l.tipo || null,
        valor: Number(l.valor || 0),
      };

      const { error } = await supabaseClient
        .from('lancamentos')
        .insert([payloadLancamento]);

      if (error) {
        console.error('Erro ao migrar lançamento de', nome, l, error);
      } else {
        lancamentosOk++;
      }
    }

    console.log(`Migrado completo: ${nome}`);
    resumo.push({
      cliente: nome,
      dividas: dividasOk,
      lancamentos: lancamentosOk,
      ok: true
    });
  }

  console.table(resumo);
  console.log('Migração completa finalizada.');
};