window.migrarCartaoSemDuplicar = async function () {
  const uid = currentUserId();
  if (!uid) {
    alert('Entre com um usuario antes de migrar os cartoes.');
    return;
  }

  const bruto = localStorage.getItem('fb_data');
  if (!bruto) {
    console.log('Nenhum fb_data encontrado no localStorage.');
    return;
  }

  const json = JSON.parse(bruto);
  const clientesJson = json.clients || {};
  const resumo = [];

  for (const [, cliente] of Object.entries(clientesJson)) {
    const nomeCliente = (cliente.name || '').trim();
    if (!nomeCliente) continue;

    const { data: clienteDB, error: erroCliente } = await applyUserScope(supabaseClient
      .from('clientes')
      .select('id,nome')
      .eq('nome', nomeCliente)
    ).maybeSingle();

    if (erroCliente) {
      console.error('Erro ao buscar cliente:', nomeCliente, erroCliente);
      continue;
    }

    if (!clienteDB) {
      console.warn('Cliente não encontrado no Supabase:', nomeCliente);
      continue;
    }

    const clienteId = clienteDB.id;
    const mapaCartoes = {};
    let cartoesInseridos = 0;
    let lancamentosInseridos = 0;

    // 1) Migrar cartões sem duplicar
    for (const cc of (cliente.cartoes || [])) {
      const nome = (cc.nome || '').trim() || null;
      const digits = (cc.digits || '').trim() || null;

      const { data: cartaoExistente, error: erroBuscaCartao } = await applyUserScope(supabaseClient
        .from('cartoes')
        .select('id,nome,digits')
        .eq('cliente_id', clienteId)
        .eq('nome', nome)
        .eq('digits', digits)
      ).maybeSingle();

      if (erroBuscaCartao) {
        console.error('Erro ao buscar cartão:', nomeCliente, cc, erroBuscaCartao);
        continue;
      }

      if (cartaoExistente) {
        mapaCartoes[cc.id] = cartaoExistente.id;
      } else {
        const { data: novoCartao, error: erroNovoCartao } = await supabaseClient
          .from('cartoes')
          .insert([Object.assign({
            cliente_id: clienteId,
            nome: nome,
            digits: digits,
            bandeira: cc.bandeira || null,
            limite: Number(cc.limite || 0),
            venc: Number(cc.venc || 0)
          }, getUserScopePayload())])
          .select('id')
          .single();

        if (erroNovoCartao) {
          console.error('Erro ao inserir cartão:', nomeCliente, cc, erroNovoCartao);
          continue;
        }

        mapaCartoes[cc.id] = novoCartao.id;
        cartoesInseridos++;
      }
    }

    // 2) Migrar lançamentos/estornos do cartão sem duplicar
    for (const it of (cliente.cartao || [])) {
      const cartaoIdNovo = it.cartaoId ? mapaCartoes[it.cartaoId] || null : null;
      if (!cartaoIdNovo) {
        console.warn('Lancamento de cartao ignorado sem cartao vinculado:', nomeCliente, it);
        continue;
      }

      const payloadBusca = {
        cliente_id: clienteId,
        cartao_id: cartaoIdNovo,
        data: it.data || null,
        descricao: it.desc || null,
        categoria: it.cat || null,
        tipo: it.tipo === 'estorno' ? 'estorno' : 'lancamento',
        valor: Number(it.valor || 0)
      };

      let query = applyUserScope(supabaseClient
        .from('lancamentos_cartao')
        .select('id')
         .eq('cliente_id', payloadBusca.cliente_id)
         .eq('descricao', payloadBusca.descricao)
         .eq('tipo', payloadBusca.tipo)
        .eq('valor', payloadBusca.valor));

// tratamento do cartão
      query = query.eq('cartao_id', payloadBusca.cartao_id);

// 🔥 tratamento da DATA (correção do erro)
      if (payloadBusca.data) {
        query = query.eq('data', payloadBusca.data);
      } else {
        query = query.is('data', null);
      }

      const { data: itemExistente, error: erroBuscaItem } = await query.maybeSingle();

      if (erroBuscaItem) {
        console.error('Erro ao buscar lançamento de cartão:', nomeCliente, it, erroBuscaItem);
        continue;
      }

      if (!itemExistente) {
        const { error: erroInsertItem } = await supabaseClient
          .from('lancamentos_cartao')
          .insert([Object.assign(payloadBusca, getUserScopePayload())]);

        if (erroInsertItem) {
          console.error('Erro ao inserir lançamento de cartão:', nomeCliente, it, erroInsertItem);
        } else {
          lancamentosInseridos++;
        }
      }
    }

    resumo.push({
      cliente: nomeCliente,
      cartoes_inseridos: cartoesInseridos,
      lanc_cartao_inseridos: lancamentosInseridos
    });
  }

  console.table(resumo);
  console.log('Migração segura do cartão concluída.');
};
