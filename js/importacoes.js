// Central de importacoes: registra lotes importados e permite desfazer por lote.

var _settingsImportPreviewId = '';

function importacaoMissingSchemaError(error) {
  var msg = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
  return !!(error && (error.code === '42P01' || error.code === 'PGRST205' || msg.includes('importacao_lotes') || msg.includes('importacao_itens') || msg.includes('schema cache')));
}

function importacaoAreaLabel(area) {
  var key = String(area || '').toLowerCase();
  if (key === 'extrato') return 'Extrato';
  if (key === 'cartao') return 'Cartao';
  if (key === 'financeiro') return 'Financeiro';
  return area || 'Importacao';
}

function importacaoTabelaLabel(tabela) {
  if (tabela === 'lancamentos') return 'Extrato';
  if (tabela === 'lancamentos_cartao') return 'Cartao';
  if (tabela === 'titulos_financeiros') return 'Financeiro';
  return tabela || '-';
}

function importacaoDataHoraLabel(value) {
  if (!value) return '-';
  var parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function registrarImportacaoLote(config) {
  if (!activeClient || !config || !Array.isArray(config.registros) || !config.registros.length) return null;

  var registros = config.registros.filter(function(item) {
    return item && item.id;
  });
  if (!registros.length) return null;

  var valorTotal = registros.reduce(function(sum, item) {
    return sum + Math.abs(Number(item.valor || 0));
  }, 0);

  var lotePayload = Object.assign({
    cliente_id: activeClient,
    area: String(config.area || 'importacao'),
    arquivo_nome: String(config.arquivoNome || '').slice(0, 240) || null,
    quantidade: registros.length,
    valor_total: Number(valorTotal || 0),
    status: 'ativo'
  }, getUserScopePayload());

  var loteRes = await supabaseClient
    .from('importacao_lotes')
    .insert([lotePayload])
    .select()
    .single();

  if (loteRes.error) {
    if (!importacaoMissingSchemaError(loteRes.error)) console.warn('Nao foi possivel registrar lote de importacao:', loteRes.error);
    return null;
  }

  var loteId = loteRes.data && loteRes.data.id;
  if (!loteId) return null;

  var itensPayload = registros.map(function(item) {
    return Object.assign({
      lote_id: loteId,
      cliente_id: activeClient,
      tabela_destino: item.tabelaDestino || config.tabelaDestino || '',
      registro_id: item.id,
      resumo: item.resumo || {},
      valor: Number(item.valor || 0)
    }, getUserScopePayload());
  });

  var itensRes = await supabaseClient
    .from('importacao_itens')
    .insert(itensPayload);

  if (itensRes.error) {
    if (!importacaoMissingSchemaError(itensRes.error)) console.warn('Nao foi possivel registrar itens da importacao:', itensRes.error);
    await supabaseClient.from('importacao_lotes').delete().eq('id', loteId);
    return null;
  }

  return loteId;
}

function importacaoResumoTexto(item) {
  var resumo = item && item.resumo ? item.resumo : {};
  var partes = [];
  if (resumo.data || resumo.vencimento || resumo.fatura) partes.push(resumo.data || resumo.vencimento || resumo.fatura);
  if (resumo.pessoa) partes.push(resumo.pessoa);
  if (resumo.descricao) partes.push(resumo.descricao);
  if (resumo.categoria) partes.push(resumo.categoria);
  return partes.filter(Boolean).join(' - ') || importacaoTabelaLabel(item && item.tabelaDestino);
}

function renderImportacoesPanel() {
  var panel = document.getElementById('modal-panel-importacoes');
  if (!panel) return;
  var cliente = activeClient && data.clients ? data.clients[activeClient] : null;
  if (!cliente) {
    panel.innerHTML = '<div class="empty-state">Selecione um cliente para ver as importacoes.</div>';
    return;
  }

  var lotes = (cliente.importacoes || []).slice().sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  if (!lotes.length) {
    panel.innerHTML = '<div class="settings-section-card"><div class="settings-card-head"><div><h5>Central de Importacoes</h5><p>Nenhum lote de importacao registrado para este cliente.</p></div></div></div>';
    return;
  }

  panel.innerHTML = '<div class="settings-section-card">'
    + '<div class="settings-card-head"><div><h5>Central de Importacoes</h5><p>Revise lotes importados por aba, visualize os itens e remova um lote inteiro quando precisar desfazer uma importacao.</p></div><div class="settings-card-badges"><span class="settings-card-badge">' + lotes.length + ' lote(s)</span></div></div>'
    + '<div class="import-batch-list">'
    + lotes.map(function(lote) {
      var aberto = _settingsImportPreviewId === lote.id;
      var itens = Array.isArray(lote.itens) ? lote.itens : [];
      return '<article class="import-batch-card">'
        + '<div class="import-batch-main">'
          + '<div><span class="settings-eyebrow">' + esc(importacaoAreaLabel(lote.area)) + '</span><strong>' + esc(lote.arquivoNome || 'Importacao sem nome') + '</strong><small>' + esc(importacaoDataHoraLabel(lote.createdAt)) + ' - ' + lote.quantidade + ' item(ns) - ' + fmt(lote.valorTotal || 0) + '</small></div>'
          + '<div class="import-batch-actions">'
            + '<button class="btn-sm" type="button" onclick="toggleImportacaoPreview(\'' + esc(lote.id) + '\')">' + (aberto ? 'Ocultar' : 'Visualizar') + '</button>'
            + '<button class="btn-sm red" type="button" onclick="deleteImportacaoLote(\'' + esc(lote.id) + '\')">Excluir lote</button>'
          + '</div>'
        + '</div>'
        + (aberto ? '<div class="import-batch-preview">'
          + (itens.length ? itens.map(function(item) {
              return '<div class="import-batch-item"><span>' + esc(importacaoTabelaLabel(item.tabelaDestino)) + '</span><strong>' + esc(importacaoResumoTexto(item)) + '</strong><em>' + fmt(item.valor || 0) + '</em></div>';
            }).join('') : '<div class="empty-state compact">Sem itens registrados neste lote.</div>')
          + '</div>' : '')
        + '</article>';
    }).join('')
    + '</div></div>';
}

function toggleImportacaoPreview(loteId) {
  _settingsImportPreviewId = _settingsImportPreviewId === loteId ? '' : loteId;
  renderImportacoesPanel();
}

async function deleteImportacaoLote(loteId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var cliente = activeClient && data.clients ? data.clients[activeClient] : null;
  var lote = cliente && (cliente.importacoes || []).find(function(item) { return item.id === loteId; });
  if (!lote) return alert('Lote de importacao nao encontrado.');

  if (!(await appConfirm(
    'Excluir o lote "' + (lote.arquivoNome || importacaoAreaLabel(lote.area)) + '" com ' + (lote.quantidade || 0) + ' item(ns)? Os registros importados tambem serao removidos.',
    { title: 'Excluir lote de importacao', confirmText: 'Excluir lote', cancelText: 'Cancelar' }
  ))) return;

  var grupos = {};
  (lote.itens || []).forEach(function(item) {
    if (!item || !item.tabelaDestino || !item.registroId) return;
    if (!grupos[item.tabelaDestino]) grupos[item.tabelaDestino] = [];
    grupos[item.tabelaDestino].push(item.registroId);
  });

  for (const tabela of Object.keys(grupos)) {
    const { error } = await applyUserScope(
      supabaseClient.from(tabela).delete().in('id', grupos[tabela])
    );
    if (error) {
      console.error('Erro ao excluir registros importados:', tabela, error);
      alert('Nao foi possivel excluir todos os registros do lote. Verifique se algum item ja foi conciliado ou alterado.');
      return;
    }
  }

  var loteDelete = await applyUserScope(
    supabaseClient.from('importacao_lotes').delete().eq('id', loteId)
  );
  if (loteDelete.error) {
    console.error('Erro ao excluir lote de importacao:', loteDelete.error);
    alert('Os registros foram removidos, mas nao foi possivel remover o lote da central.');
    return;
  }

  _settingsImportPreviewId = '';
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'importacoes');
  await loadData();
  renderSettingsModal('importacoes');
  renderTab(activeTab);
}
