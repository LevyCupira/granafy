var _chartInstances = {};
var _graficosPeriodos = null;
var _graficosFluxoModo = 'barras';
var _graficosCategoriaModo = 'despesas';
var _graficosEventos = [];
var _graficosCategoriaDetalhes = {};
var _graficosView = 'geral';

function destroyChart(id) {
  if (_chartInstances[id]) {
    _chartInstances[id].destroy();
    delete _chartInstances[id];
  }
}

function graficosSetFluxoModo(valor) {
  _graficosFluxoModo = valor || 'barras';
  renderGraficos();
}

function graficosSetCategoriaModo(valor) {
  _graficosCategoriaModo = valor || 'despesas';
  renderGraficos();
}

function graficosSetView(view) {
  var views = ['geral', 'eventos', 'categorias', 'cartao', 'comparacoes'];
  _graficosView = views.includes(view) ? view : 'geral';
  renderGraficos();
}

function graficosEventosDisponiveis(cliente) {
  if (!cliente || !cliente.eventosEnabled || !Array.isArray(cliente.eventos)) return [];
  return cliente.eventos.filter(function(evento) { return evento && evento.ativo !== false; }).sort(function(a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
}

function graficosEventosSelecionados(id, eventos, atual) {
  var picker = document.querySelector('[data-event-picker="' + id + '"]');
  if (picker) {
    return Array.from(picker.querySelectorAll('input[type="checkbox"]:checked')).map(function(input) {
      return input.value;
    }).filter(Boolean);
  }
  return Array.isArray(atual) ? atual.filter(function(eventoId) {
    return eventos.some(function(evento) { return evento.id === eventoId; });
  }) : [];
}

function graficosBuildEventoMultiSelect(id, eventos, selecionados) {
  if (!eventos.length) return '';
  var selectedMap = new Set(selecionados || []);
  var label = selectedMap.size
    ? eventos.filter(function(evento) { return selectedMap.has(evento.id); }).map(function(evento) { return evento.nome; }).join(', ')
    : 'Todos os eventos';
  var checks = eventos.map(function(evento) {
    return '<label class="period-option"><input type="checkbox" value="' + esc(evento.id) + '"' + (selectedMap.has(evento.id) ? ' checked' : '') + '/><span>' + esc(evento.nome || '') + '</span></label>';
  }).join('');

  return '<div class="period-picker" data-event-picker="' + id + '">'
    + '<button type="button" class="period-picker-btn" onclick="graficosToggleEventoPicker(\'' + id + '\')">' + esc(label) + '</button>'
    + '<div class="period-picker-menu">' + checks
    + '<div class="period-picker-actions"><button type="button" class="btn-sm" onclick="graficosClearEventoPicker(\'' + id + '\')">Todos</button><button type="button" class="btn-sm" onclick="graficosAplicarEventoPicker(\'' + id + '\')">Aplicar</button></div>'
    + '</div></div>';
}

function graficosToggleEventoPicker(id) {
  document.querySelectorAll('.period-picker').forEach(function(el) {
    if (el.getAttribute('data-event-picker') !== id) el.classList.remove('open');
  });
  var picker = document.querySelector('[data-event-picker="' + id + '"]');
  if (picker) picker.classList.toggle('open');
}

function graficosClearEventoPicker(id) {
  var picker = document.querySelector('[data-event-picker="' + id + '"]');
  if (picker) picker.querySelectorAll('input[type="checkbox"]').forEach(function(input) { input.checked = false; });
  _graficosEventos = [];
  renderGraficos();
}

function graficosAplicarEventoPicker(id) {
  var picker = document.querySelector('[data-event-picker="' + id + '"]');
  _graficosEventos = picker
    ? Array.from(picker.querySelectorAll('input[type="checkbox"]:checked')).map(function(input) { return input.value; }).filter(Boolean)
    : [];
  renderGraficos();
}

function graficosLabelPeriodo(mes) {
  var parts = String(mes || '').split('-');
  return parts.length === 2 ? parts[1] + '/' + parts[0].slice(2) : mes;
}

function graficosValorCompacto(valor) {
  return 'R$' + Number(valor || 0).toLocaleString('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1
  });
}

function graficosChartBaseOptions(gridColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: function(ctx) {
            return ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw);
          }
        }
      }
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
      y: {
        grid: { color: gridColor },
        ticks: {
          font: { size: 10 },
          callback: function(v) { return graficosValorCompacto(v); }
        }
      }
    }
  };
}

function graficosHorizontalBarOptions(gridColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.raw); } } }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: {
          font: { size: 10 },
          callback: function(v) { return graficosValorCompacto(v); }
        }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          font: { size: 10 },
          callback: function(value) {
            var label = this.getLabelForValue ? this.getLabelForValue(value) : value;
            label = String(label || '');
            return label.length > 24 ? label.slice(0, 23) + '...' : label;
          }
        }
      }
    }
  };
}

function graficosMesesDisponiveis(cliente, transacoes) {
  return Array.from(new Set(
    transacoes.map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean)
      .concat((cliente.cartao || []).map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean))
      .concat((cliente.titulos || []).map(function(l) { return (l.vencimento || '').slice(0, 7); }).filter(Boolean))
  )).sort().reverse();
}

function graficosAgruparPorPeriodo(transacoes, periodos) {
  var periodoSet = new Set(periodos || []);
  var grupos = {};

  (transacoes || []).forEach(function(l) {
    var periodo = (l.data || '').slice(0, 7);
    if (!periodoSet.has(periodo)) return;
    if (!grupos[periodo]) grupos[periodo] = [];
    grupos[periodo].push(l);
  });

  return (periodos || []).slice().sort().map(function(periodo) {
    var consolidado = consolidarTransacoesAnaliticas(grupos[periodo] || []);
    return {
      periodo: periodo,
      label: graficosLabelPeriodo(periodo),
      receitas: consolidado.totalReceitas,
      despesas: consolidado.totalDespesas,
      resultado: consolidado.totalReceitas - consolidado.totalDespesas,
      consolidado: consolidado
    };
  });
}

function graficosSomarCategorias(lista, limite) {
  var agrupadas = {};
  (lista || []).forEach(function(item) {
    var cat = tfNormalizeText(item.cat || '') === 'outros' ? 'Outros' : (item.cat || 'Outros');
    agrupadas[cat] = (agrupadas[cat] || 0) + Number(item.valor || 0);
  });

  var total = Object.keys(agrupadas).reduce(function(s, cat) { return s + Number(agrupadas[cat] || 0); }, 0);
  var outrosValor = Object.keys(agrupadas).filter(function(cat) {
    return tfNormalizeText(cat) === 'outros';
  }).reduce(function(s, cat) {
    return s + Number(agrupadas[cat] || 0);
  }, 0);

  var naoOutros = Object.keys(agrupadas).filter(function(cat) {
    return tfNormalizeText(cat) !== 'outros';
  }).map(function(cat) {
    return { cat: cat, valor: agrupadas[cat] };
  }).sort(function(a, b) {
    return b.valor - a.valor;
  });

  var limiteBase = Math.max(1, (limite || 8) - (outrosValor > 0 ? 1 : 0));
  var principais = naoOutros.slice(0, limiteBase);
  if (outrosValor > 0) principais.push({ cat: 'Outros', valor: outrosValor, real: true });

  var usadosNaoOutros = principais.filter(function(item) {
    return tfNormalizeText(item.cat) !== 'outros';
  }).reduce(function(s, item) {
    return s + Number(item.valor || 0);
  }, 0);
  var totalNaoOutros = naoOutros.reduce(function(s, item) {
    return s + Number(item.valor || 0);
  }, 0);
  var demaisValor = totalNaoOutros - usadosNaoOutros;

  if (demaisValor > 0.009) {
    principais.push({ cat: 'Demais Cat.', valor: demaisValor, agrupado: true });
  }

  principais.sort(function(a, b) { return b.valor - a.valor; });
  return { total: total, itens: principais };
}

function graficosFaturasPorPeriodo(cliente, periodos, colors) {
  var cartoes = (cliente.cartoes || []).slice();
  var lancamentos = cliente.cartao || [];

  if (lancamentos.some(function(it) { return !it.cartaoId; })) {
    cartoes.push({ id: '__sem_cartao', nome: 'Sem cartao' });
  }

  return cartoes.map(function(cartao, i) {
    return {
      label: cartao.nome,
      data: periodos.map(function(periodo) {
        return lancamentos
          .filter(function(it) {
            var mesmoCartao = cartao.id === '__sem_cartao' ? !it.cartaoId : it.cartaoId === cartao.id;
            return mesmoCartao && (it.data || '').startsWith(periodo);
          })
          .reduce(function(s, it) { return s + (it.tipo === 'estorno' ? -Number(it.valor || 0) : Number(it.valor || 0)); }, 0);
      }),
      backgroundColor: colors[i % colors.length] + 'cc',
      borderColor: colors[i % colors.length],
      borderWidth: 1.5,
      borderRadius: 5
    };
  }).filter(function(ds) {
    return ds.data.some(function(v) { return Math.abs(v) > 0.009; });
  });
}

function graficosResumoHtml(totalReceitas, totalDespesas, resultado, transacoes, faturaTotal) {
  var margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0;
  return '<div class="charts-kpi-grid">'
    + '<div class="summary-card"><div class="s-label">Receitas</div><div class="s-val green">' + fmt(totalReceitas) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Despesas</div><div class="s-val red">' + fmt(totalDespesas) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Resultado</div><div class="s-val ' + (resultado >= 0 ? 'green' : 'red') + '">' + fmt(resultado) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Margem</div><div class="s-val ' + (margem >= 0 ? 'green' : 'red') + '">' + margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%</div></div>'
    + '<div class="summary-card"><div class="s-label">Transacoes</div><div class="s-val blue">' + transacoes + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Fatura cartao</div><div class="s-val yellow">' + fmt(faturaTotal) + '</div></div>'
    + '</div>';
}

function graficosRankingHtml(categorias, total, tipo) {
  if (!categorias.length) {
    return '<div class="empty-state" style="padding:24px 12px">Nenhuma categoria no periodo.</div>';
  }

  return '<div class="charts-ranking">'
    + categorias.map(function(item) {
      var pct = total > 0 ? Math.round((Number(item.valor || 0) / total) * 100) : 0;
      var key = graficosCategoriaKey(item.cat || 'Outros');
      return '<button type="button" class="charts-ranking-row charts-ranking-action" onclick="graficosAbrirCategoriaDetalhes(\'' + esc(key) + '\')">'
        + '<div><strong>' + esc(item.cat || 'Outros') + '</strong><span>' + pct + '% de ' + (tipo === 'receitas' ? 'receitas' : 'despesas') + '</span></div>'
        + '<div class="charts-ranking-bar"><span class="' + (tipo === 'receitas' ? 'income' : 'expense') + '" style="width:' + pct + '%"></span></div>'
        + '<strong>' + fmt(item.valor) + '</strong>'
        + '</button>';
    }).join('')
    + '</div>';
}

function graficosCategoriaKey(cat) {
  return tfNormalizeText(cat || 'Outros').replace(/[^a-z0-9]+/g, '_') || 'outros';
}

function graficosDestinoCategoria(cat, categoriasGrafico) {
  var nome = cat || 'Outros';
  var norm = tfNormalizeText(nome);
  if (norm === 'outros') return 'Outros';

  var visiveis = {};
  (categoriasGrafico.itens || []).forEach(function(item) {
    var label = item.cat || 'Outros';
    visiveis[tfNormalizeText(label)] = label;
  });

  return visiveis[norm] || 'Demais Cat.';
}

function graficosDataItem(item) {
  return item.data || item.vencimento || '';
}

function graficosDetalheItemHtml(item) {
  var valorClass = Number(item.valor || 0) >= 0 ? 'val-pos' : 'val-neg';
  return '<tr>'
    + '<td>' + esc(item.data ? formatDate(item.data) : '-') + '</td>'
    + '<td>' + esc(item.origem || '-') + '</td>'
    + '<td><span class="settings-card-badge subtle">' + esc(item.categoria || 'Outros') + '</span></td>'
    + '<td><strong>' + esc(item.pessoa || item.descricao || '-') + '</strong>' + (item.descricao && item.pessoa ? '<div class="installment-note">' + esc(item.descricao) + '</div>' : '') + '</td>'
    + '<td>' + esc(item.evento || '') + '</td>'
    + '<td><span class="val ' + valorClass + '">' + fmt(Math.abs(Number(item.valor || 0))) + '</span></td>'
    + '</tr>';
}

function graficosCategoriasDoDetalheHtml(detalhe) {
  var map = {};
  (detalhe.itens || []).forEach(function(item) {
    var cat = item.categoria || 'Outros';
    map[cat] = (map[cat] || 0) + Math.abs(Number(item.valor || 0));
  });
  var categorias = Object.keys(map).map(function(cat) {
    return { cat: cat, valor: map[cat] };
  }).sort(function(a, b) { return b.valor - a.valor; });

  if (detalhe.nome !== 'Demais Cat.' || categorias.length <= 1) return '';

  return '<div class="charts-minor-categories">'
    + '<div class="charts-minor-title">Categorias minoritarias neste grupo</div>'
    + '<div class="charts-minor-list">'
      + categorias.map(function(item) {
        return '<span><strong>' + esc(item.cat) + '</strong>' + fmt(item.valor) + '</span>';
      }).join('')
    + '</div>'
    + '</div>';
}

function graficosAbrirCategoriaDetalhes(key) {
  var detalhe = _graficosCategoriaDetalhes[key];
  if (!detalhe) return;
  var itens = (detalhe.itens || []).slice().sort(function(a, b) {
    return String(graficosDataItem(b)).localeCompare(String(graficosDataItem(a)));
  });
  document.getElementById('modalTitle').textContent = detalhe.nome || 'Categoria';
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-card-badges" style="margin:0 0 14px 0">'
      + '<span class="settings-card-badge">' + esc(detalhe.tipo || 'Categoria') + '</span>'
      + '<span class="settings-card-badge subtle">' + itens.length + ' lancamento(s)</span>'
      + '<span class="settings-card-badge subtle">Total ' + fmt(detalhe.total || 0) + '</span>'
    + '</div>'
    + graficosCategoriasDoDetalheHtml(detalhe)
    + (itens.length
      ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Data transacao</th><th>Origem</th><th>Categoria</th><th>Descricao</th><th>Evento</th><th>Valor</th></tr></thead><tbody>' + itens.map(graficosDetalheItemHtml).join('') + '</tbody></table></div>'
      : '<div class="empty-state" style="padding:24px">Nenhum lancamento encontrado.</div>')
    + '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button></div>';
  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
}

function graficosTitulosPeriodo(cliente, periodos, eventoIds) {
  var periodoSet = new Set(periodos || []);
  var eventoSet = new Set(eventoIds || []);
  return (cliente.titulos || []).filter(function(item) {
    if (eventoSet.size && !eventoSet.has(item.eventoId || '')) return false;
    if (periodoSet.size && !periodoSet.has(String(item.vencimento || '').slice(0, 7))) return false;
    return !!item.eventoId;
  });
}

function graficosEventosResumo(cliente, periodos, eventoIds) {
  var eventos = graficosEventosDisponiveis(cliente);
  var eventoSet = new Set(eventoIds || []);
  var eventosBase = eventoSet.size ? eventos.filter(function(evento) { return eventoSet.has(evento.id); }) : eventos;
  var titulos = graficosTitulosPeriodo(cliente, periodos, eventosBase.map(function(evento) { return evento.id; }));

  return eventosBase.map(function(evento) {
    var itens = titulos.filter(function(item) { return item.eventoId === evento.id; });
    var receber = itens.filter(function(item) { return item.natureza === 'receber'; });
    var pagar = itens.filter(function(item) { return item.natureza === 'pagar'; });
    var receita = receber.reduce(function(s, item) { return s + Number(item.valorTotal || 0); }, 0);
    var custo = pagar.reduce(function(s, item) { return s + Number(item.valorTotal || 0); }, 0);
    var recebido = receber.reduce(function(s, item) { return s + tfTotalBaixado(item); }, 0);
    var pago = pagar.reduce(function(s, item) { return s + tfTotalBaixado(item); }, 0);
    return {
      id: evento.id,
      nome: evento.nome || 'Sem nome',
      receita: receita,
      custo: custo,
      resultado: receita - custo,
      recebido: recebido,
      pago: pago,
      realizado: recebido - pago,
      titulos: itens.length
    };
  }).filter(function(item) {
    return item.titulos || item.receita || item.custo || item.recebido || item.pago;
  });
}

function graficosCategoriasEventos(cliente, periodos, eventoIds, incluirNaoVinculados) {
  var map = {};
  graficosLancamentosExtratoEventos(cliente, periodos, eventoIds, incluirNaoVinculados).forEach(function(item) {
    var key = item.categoria || 'Outros';
    map[key] = (map[key] || 0) + Number(item.valor || 0);
  });
  return Object.entries(map).map(function(entry) {
    return { cat: entry[0], valor: entry[1] };
  }).sort(function(a, b) { return b.valor - a.valor; });
}

function graficosLancamentosExtratoEventos(cliente, periodos, eventoIds, incluirNaoVinculados) {
  var periodoSet = new Set(periodos || []);
  var eventoSet = new Set(eventoIds || []);
  var extratoPorId = {};
  (cliente.extrato || []).forEach(function(lanc) {
    if (lanc && lanc.id) extratoPorId[lanc.id] = lanc;
  });

  var itens = [];
  var lancamentosUsados = new Set();
  var lancamentosComEvento = new Set();
  (cliente.titulos || []).filter(function(titulo) {
    return titulo && titulo.natureza === 'pagar' && titulo.eventoId;
  }).forEach(function(titulo) {
    (titulo.baixas || []).forEach(function(baixa) {
      if (baixa && baixa.lancamentoId) lancamentosComEvento.add(baixa.lancamentoId);
    });
  });

  (cliente.titulos || []).filter(function(titulo) {
    if (!titulo || titulo.natureza !== 'pagar' || !titulo.eventoId) return false;
    return !eventoSet.size || eventoSet.has(titulo.eventoId);
  }).forEach(function(titulo) {
    (titulo.baixas || []).forEach(function(baixa) {
      if (!baixa || !baixa.lancamentoId) return;
      var lanc = extratoPorId[baixa.lancamentoId];
      if (!lanc) return;
      lancamentosUsados.add(lanc.id);
      var dataLanc = String(lanc.data || '').slice(0, 10);
      if (periodoSet.size && !periodoSet.has(dataLanc.slice(0, 7))) return;

      var valorBaixa = Math.abs(Number(baixa.valor || lanc.valor || 0));
      var rateios = typeof normalizarRateiosCategorias === 'function' ? normalizarRateiosCategorias(lanc.rateios || []) : [];
      var totalRateio = rateios.reduce(function(sum, rateio) { return sum + Number(rateio.valor || 0); }, 0);

      if (rateios.length && totalRateio > 0) {
        rateios.forEach(function(rateio) {
          itens.push({
            categoria: rateio.categoria || lanc.cat || 'Outros',
            data: dataLanc,
            origem: 'Extrato',
            pessoa: titulo.pessoaNome || '',
            descricao: lanc.desc || titulo.descricao || '',
            eventoId: titulo.eventoId,
            evento: titulo.evento || (typeof tfNomeEventoById === 'function' ? tfNomeEventoById(titulo.eventoId) : ''),
            valor: valorBaixa * (Number(rateio.valor || 0) / totalRateio)
          });
        });
        return;
      }

      itens.push({
        categoria: lanc.cat || 'Outros',
        data: dataLanc,
        origem: 'Extrato',
        pessoa: titulo.pessoaNome || '',
        descricao: lanc.desc || titulo.descricao || '',
        eventoId: titulo.eventoId,
        evento: titulo.evento || (typeof tfNomeEventoById === 'function' ? tfNomeEventoById(titulo.eventoId) : ''),
        valor: valorBaixa
      });
    });
  });

  if (incluirNaoVinculados) {
    (cliente.extrato || []).forEach(function(lanc) {
      if (!lanc || !lanc.id || lancamentosUsados.has(lanc.id) || lancamentosComEvento.has(lanc.id)) return;
      if (typeof resumoEhDebito === 'function' && !resumoEhDebito(lanc.tipo)) return;
      if (lanc.ehMovConta || (typeof isCategoriaMovContas === 'function' && isCategoriaMovContas(lanc.cat))) return;
      var dataLanc = String(lanc.data || '').slice(0, 10);
      if (periodoSet.size && !periodoSet.has(dataLanc.slice(0, 7))) return;

      var rateios = typeof normalizarRateiosCategorias === 'function' ? normalizarRateiosCategorias(lanc.rateios || []) : [];
      if (rateios.length) {
        rateios.forEach(function(rateio) {
          itens.push({
            categoria: rateio.categoria || lanc.cat || 'Outros',
            data: dataLanc,
            origem: 'Extrato sem evento',
            pessoa: '',
            descricao: lanc.desc || '',
            eventoId: '',
            evento: 'Sem vínculo no Financeiro',
            valor: Number(rateio.valor || 0)
          });
        });
        return;
      }

      itens.push({
        categoria: lanc.cat || 'Outros',
        data: dataLanc,
        origem: 'Extrato sem evento',
        pessoa: '',
        descricao: lanc.desc || '',
        eventoId: '',
        evento: 'Sem vínculo no Financeiro',
        valor: Math.abs(Number(lanc.valor || 0))
      });
    });
  }

  return itens;
}

function graficosEventosDetalheHtml(eventosResumo) {
  if (!eventosResumo.length) return '<div class="empty-state" style="padding:24px 12px">Nenhum titulo vinculado aos eventos no periodo.</div>';
  return '<div class="charts-ranking">'
    + eventosResumo.slice().sort(function(a, b) { return b.resultado - a.resultado; }).map(function(item) {
      var margem = item.receita > 0 ? Math.round((item.resultado / item.receita) * 100) : 0;
      return '<div class="charts-ranking-row">'
        + '<div><strong>' + esc(item.nome) + '</strong><span>Margem ' + margem + '% · realizado ' + fmt(item.realizado) + '</span></div>'
        + '<div class="charts-ranking-bar"><span class="' + (item.resultado >= 0 ? 'income' : 'expense') + '" style="width:' + Math.min(100, Math.abs(margem)) + '%"></span></div>'
        + '<strong class="' + (item.resultado >= 0 ? 'val-pos' : 'val-neg') + '">' + fmt(item.resultado) + '</strong>'
        + '</div>';
    }).join('')
    + '</div>';
}

function graficosMontarDetalhesCategoriaGeral(transacoes, categoriasGrafico, tipo) {
  var detalhes = {};
  var ehReceita = tipo === 'receitas';

  (transacoes || []).forEach(function(l) {
    if (ehReceita && !resumoEhCredito(l.tipo)) return;
    if (!ehReceita && !resumoEhDebito(l.tipo)) return;
    var cat = l.cat || 'Outros';
    var destino = graficosDestinoCategoria(cat, categoriasGrafico);
    var key = graficosCategoriaKey(destino);
    if (!detalhes[key]) detalhes[key] = { nome: destino, tipo: ehReceita ? 'Receitas' : 'Despesas', total: 0, itens: [] };
    detalhes[key].total += Number(l.valor || 0);
    detalhes[key].itens.push({
      categoria: cat,
      data: l.data || '',
      origem: l.fonte || '',
      pessoa: '',
      descricao: l.desc || '',
      evento: '',
      valor: Number(l.valor || 0)
    });
  });

  return detalhes;
}

function graficosMontarDetalhesCategoriaEventos(cliente, periodos, eventoIds, categoriasGrafico, incluirNaoVinculados) {
  var detalhes = {};
  graficosLancamentosExtratoEventos(cliente, periodos, eventoIds, incluirNaoVinculados).forEach(function(item) {
    var cat = item.categoria || 'Outros';
    var destino = graficosDestinoCategoria(cat, categoriasGrafico);
    var key = graficosCategoriaKey(destino);
    if (!detalhes[key]) detalhes[key] = { nome: destino, tipo: 'Categoria do Extrato', total: 0, itens: [] };
    detalhes[key].total += Number(item.valor || 0);
    detalhes[key].itens.push({
      categoria: cat,
      data: item.data || '',
      origem: item.origem || 'Extrato',
      pessoa: item.pessoa || '',
      descricao: item.descricao || '',
      evento: item.evento || '',
      valor: Number(item.valor || 0)
    });
  });

  return detalhes;
}

function renderGraficos() {
  var c = data.clients[activeClient];
  if (!c) return;

  var todasBase = getTransacoes(activeClient);
  var todas = todasBase.filter(function(l) { return !l.ehMovConta; });
  var mesesSet = graficosMesesDisponiveis(c, todas);
  var periodos = lerPeriodosSelecionados('graficos-periodos-sel', mesesSet, _graficosPeriodos);
  _graficosPeriodos = periodos;
  var eventosDisponiveis = graficosEventosDisponiveis(c);
  var eventosSelecionados = graficosEventosSelecionados('graficos-eventos-sel', eventosDisponiveis, _graficosEventos);
  _graficosEventos = eventosSelecionados;

  var periodoSet = new Set(periodos);
  var transacoesPeriodo = periodos.length
    ? todas.filter(function(l) { return periodoSet.has((l.data || '').slice(0, 7)); })
    : [];
  var consolidadoPeriodo = consolidarTransacoesAnaliticas(transacoesPeriodo);
  var series = graficosAgruparPorPeriodo(todas, periodos);
  var periodosGrafico = series.map(function(item) { return item.periodo; });
  var labels = series.map(function(item) { return item.label; });
  var receitas = series.map(function(item) { return item.receitas; });
  var despesas = series.map(function(item) { return item.despesas; });
  var resultado = series.map(function(item) { return item.resultado; });
  var acumulado = [];

  resultado.reduce(function(s, valor) {
    var novo = s + valor;
    acumulado.push(novo);
    return novo;
  }, 0);

  var COLORS = ['#5b8cff', '#3ecfb0', '#ff6b6b', '#ffc86b', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#60a5fa', '#e879f9'];
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var gridColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
  var tickColor = isDark ? '#7a80a0' : '#5a607a';
  var categoriaBase = _graficosCategoriaModo === 'receitas' ? consolidadoPeriodo.receitas : consolidadoPeriodo.despesas;
  var categorias = graficosSomarCategorias(categoriaBase, 8);
  var eventosResumo = graficosEventosResumo(c, periodos, eventosSelecionados);
  var eventosCategoriaIds = eventosSelecionados.length ? eventosSelecionados : eventosDisponiveis.map(function(evento) { return evento.id; });
  var incluirExtratoSemEvento = eventosSelecionados.length > 0;
  var categoriasEventos = graficosSomarCategorias(graficosCategoriasEventos(c, periodos, eventosCategoriaIds, incluirExtratoSemEvento), 8);
  var eventosReceita = eventosResumo.reduce(function(s, item) { return s + Number(item.receita || 0); }, 0);
  var eventosCusto = eventosResumo.reduce(function(s, item) { return s + Number(item.custo || 0); }, 0);
  var eventosResultado = eventosReceita - eventosCusto;
  var eventosTitulos = eventosResumo.reduce(function(s, item) { return s + Number(item.titulos || 0); }, 0);
  var faturaDatasets = graficosFaturasPorPeriodo(c, periodosGrafico, COLORS);
  var faturaTotal = faturaDatasets.reduce(function(total, ds) {
    return total + ds.data.reduce(function(s, valor) { return s + Number(valor || 0); }, 0);
  }, 0);
  var periodoTexto = periodos.length ? periodos.map(formatPeriodoLabel).join(', ') : 'Selecione um periodo';

  if (_graficosView === 'eventos' && !eventosDisponiveis.length) _graficosView = 'geral';
  var controlsHtml =
    '<div class="charts-workbench-controls">'
      + '<label class="charts-control"><span>Periodo</span>' + buildPeriodoMultiSelect('graficos-periodos-sel', mesesSet, periodos, 'renderGraficos()') + '</label>'
      + (eventosDisponiveis.length ? '<label class="charts-control"><span>' + esc((c.eventosLabel || 'Eventos')) + '</span>' + graficosBuildEventoMultiSelect('graficos-eventos-sel', eventosDisponiveis, eventosSelecionados) + '</label>' : '')
      + '<label class="charts-control"><span>Fluxo</span><select onchange="graficosSetFluxoModo(this.value)">'
        + '<option value="barras"' + (_graficosFluxoModo === 'barras' ? ' selected' : '') + '>Barras</option>'
        + '<option value="linha"' + (_graficosFluxoModo === 'linha' ? ' selected' : '') + '>Linha</option>'
        + '<option value="acumulado"' + (_graficosFluxoModo === 'acumulado' ? ' selected' : '') + '>Resultado acumulado</option>'
      + '</select></label>'
      + '<label class="charts-control"><span>Categorias</span><select onchange="graficosSetCategoriaModo(this.value)">'
        + '<option value="despesas"' + (_graficosCategoriaModo === 'despesas' ? ' selected' : '') + '>Despesas</option>'
        + '<option value="receitas"' + (_graficosCategoriaModo === 'receitas' ? ' selected' : '') + '>Receitas</option>'
      + '</select></label>'
      + '<button class="btn-pdf" onclick="exportPDF()">Exportar PDF</button>'
    + '</div>';
  var headerHtml =
    '<div class="charts-workbench-hero">'
      + '<div class="charts-workbench-head">'
        + '<div><h3>Graficos</h3><p class="cartao-helper-text">Analise fluxo, categorias, eventos e cartoes por periodo.</p></div>'
        + controlsHtml
      + '</div>'
      + '<div class="charts-period-note">' + esc(periodoTexto) + '</div>'
    + '</div>';
  var tabsHtml =
    '<div class="charts-workbench-tabs">'
      + '<button type="button" class="charts-workbench-tab' + (_graficosView === 'geral' ? ' active' : '') + '" onclick="graficosSetView(\'geral\')"><span>Geral</span><strong>' + transacoesPeriodo.length + '</strong></button>'
      + (eventosDisponiveis.length ? '<button type="button" class="charts-workbench-tab' + (_graficosView === 'eventos' ? ' active' : '') + '" onclick="graficosSetView(\'eventos\')"><span>' + esc(c.eventosLabel || 'Eventos') + '</span><strong>' + eventosResumo.length + '</strong></button>' : '')
      + '<button type="button" class="charts-workbench-tab' + (_graficosView === 'categorias' ? ' active' : '') + '" onclick="graficosSetView(\'categorias\')"><span>Categorias</span><strong>' + (eventosDisponiveis.length ? categoriasEventos.itens.length : categorias.itens.length) + '</strong></button>'
      + '<button type="button" class="charts-workbench-tab' + (_graficosView === 'cartao' ? ' active' : '') + '" onclick="graficosSetView(\'cartao\')"><span>Cartao</span><strong>' + faturaDatasets.length + '</strong></button>'
      + '<button type="button" class="charts-workbench-tab' + (_graficosView === 'comparacoes' ? ' active' : '') + '" onclick="graficosSetView(\'comparacoes\')"><span>Comparacoes</span><strong>' + periodosGrafico.length + '</strong></button>'
    + '</div>';
  var rankingHtml = graficosRankingHtml(eventosDisponiveis.length ? categoriasEventos.itens : categorias.itens, eventosDisponiveis.length ? categoriasEventos.total : categorias.total, eventosDisponiveis.length ? 'despesas' : _graficosCategoriaModo);
  var activeHtml =
    '<div class="charts-grid-main">'
      + '<div class="chart-card chart-card-wide"><h4>Fluxo financeiro</h4><div class="chart-wrap"><canvas id="chart-recdesp"></canvas></div></div>'
      + '<div class="chart-card"><h4>Ranking de categorias</h4><div class="chart-wrap"><canvas id="chart-categorias"></canvas></div></div>'
    + '</div>';
  if (_graficosView === 'eventos') {
    activeHtml = '<div class="charts-grid-main">'
      + '<div class="chart-card chart-card-wide"><h4>Comparacao de eventos</h4><div class="chart-wrap"><canvas id="chart-eventos"></canvas></div></div>'
      + '<div class="chart-card"><h4>Resultado por evento</h4>' + graficosEventosDetalheHtml(eventosResumo) + '</div>'
    + '</div>'
    + '<div class="charts-grid-main">'
      + '<div class="chart-card chart-card-wide"><h4>Custos por categoria nos eventos</h4><div class="chart-wrap"><canvas id="chart-categorias"></canvas></div></div>'
      + '<div class="chart-card"><h4>Detalhe do ranking</h4>' + rankingHtml + '</div>'
    + '</div>';
  } else if (_graficosView === 'categorias') {
    activeHtml = '<div class="charts-grid-main">'
      + '<div class="chart-card chart-card-wide"><h4>Ranking de categorias</h4><div class="chart-wrap-tall"><canvas id="chart-categorias"></canvas></div></div>'
      + '<div class="chart-card"><h4>Detalhe do ranking</h4>' + rankingHtml + '</div>'
    + '</div>';
  } else if (_graficosView === 'cartao') {
    activeHtml = '<div class="chart-card"><h4>Fatura do cartao por mes</h4><div class="chart-wrap-tall"><canvas id="chart-fatura"></canvas></div></div>';
  } else if (_graficosView === 'comparacoes') {
    activeHtml = '<div class="charts-grid-main">'
      + '<div class="chart-card chart-card-wide"><h4>Fluxo financeiro</h4><div class="chart-wrap"><canvas id="chart-recdesp"></canvas></div></div>'
      + (eventosDisponiveis.length ? '<div class="chart-card"><h4>Comparacao de eventos</h4><div class="chart-wrap"><canvas id="chart-eventos"></canvas></div></div>' : '<div class="chart-card"><h4>Comparacoes</h4><div class="empty-state" style="padding:40px 0">Habilite eventos para comparar resultados por evento.</div></div>')
    + '</div>';
  }

  document.getElementById('graficos-content').innerHTML =
    headerHtml
    + graficosResumoHtml(eventosDisponiveis.length ? eventosReceita : consolidadoPeriodo.totalReceitas, eventosDisponiveis.length ? eventosCusto : consolidadoPeriodo.totalDespesas, eventosDisponiveis.length ? eventosResultado : (consolidadoPeriodo.totalReceitas - consolidadoPeriodo.totalDespesas), eventosDisponiveis.length ? eventosTitulos : transacoesPeriodo.length, faturaTotal)
    + tabsHtml
    + '<div class="charts-workbench-view">' + activeHtml + '</div>';

  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = tickColor;

  destroyChart('eventos');
  var eventosCanvas = document.getElementById('chart-eventos');
  if (eventosDisponiveis.length && eventosCanvas) {
    if (!eventosResumo.length) {
      eventosCanvas.parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0">Nenhum titulo vinculado aos eventos no periodo.</div>';
    } else {
      _chartInstances.eventos = new Chart(eventosCanvas, {
        type: 'bar',
        data: {
          labels: eventosResumo.map(function(item) { return item.nome; }),
          datasets: [
            { label: 'Receitas', data: eventosResumo.map(function(item) { return item.receita; }), backgroundColor: 'rgba(62,207,176,.72)', borderColor: 'rgba(62,207,176,1)', borderWidth: 1.5, borderRadius: 5 },
            { label: 'Custos', data: eventosResumo.map(function(item) { return item.custo; }), backgroundColor: 'rgba(255,107,107,.72)', borderColor: 'rgba(255,107,107,1)', borderWidth: 1.5, borderRadius: 5 },
            { label: 'Resultado', data: eventosResumo.map(function(item) { return item.resultado; }), backgroundColor: 'rgba(255,200,107,.28)', borderColor: 'rgba(255,200,107,1)', borderWidth: 2, borderRadius: 5 }
          ]
        },
        options: Object.assign(graficosHorizontalBarOptions(gridColor), {
          plugins: {
            legend: { labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw); } } }
          }
        })
      });
    }
  }

  destroyChart('recdesp');
  var fluxoDatasets = _graficosFluxoModo === 'acumulado'
    ? [
        { label: 'Resultado acumulado', data: acumulado, borderColor: COLORS[0], backgroundColor: 'rgba(91,140,255,.16)', borderWidth: 2, tension: .32, fill: true },
        { label: 'Resultado mensal', data: resultado, borderColor: COLORS[3], backgroundColor: 'rgba(255,200,107,.22)', borderWidth: 2, tension: .32 }
      ]
    : [
        { label: 'Receitas', data: receitas, backgroundColor: 'rgba(62,207,176,.72)', borderColor: 'rgba(62,207,176,1)', borderWidth: 1.5, borderRadius: 5, tension: .32 },
        { label: 'Despesas', data: despesas, backgroundColor: 'rgba(255,107,107,.72)', borderColor: 'rgba(255,107,107,1)', borderWidth: 1.5, borderRadius: 5, tension: .32 },
        { label: 'Resultado', data: resultado, backgroundColor: 'rgba(255,200,107,.22)', borderColor: 'rgba(255,200,107,1)', borderWidth: 2, type: 'line', tension: .32 }
      ];
  var recdespCanvas = document.getElementById('chart-recdesp');
  if (recdespCanvas) {
    _chartInstances.recdesp = new Chart(recdespCanvas, {
      type: _graficosFluxoModo === 'barras' ? 'bar' : 'line',
      data: { labels: labels, datasets: fluxoDatasets },
      options: graficosChartBaseOptions(gridColor)
    });
  }

  destroyChart('categorias');
  var categoriasGrafico = eventosDisponiveis.length ? categoriasEventos : categorias;
  _graficosCategoriaDetalhes = eventosDisponiveis.length
    ? graficosMontarDetalhesCategoriaEventos(c, periodos, eventosCategoriaIds, categoriasGrafico, incluirExtratoSemEvento)
    : graficosMontarDetalhesCategoriaGeral(transacoesPeriodo, categoriasGrafico, _graficosCategoriaModo);
  var categoriasCanvas = document.getElementById('chart-categorias');
  if (categoriasCanvas && !categoriasGrafico.itens.length) {
    categoriasCanvas.parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0">Nenhuma categoria no periodo.</div>';
  } else if (categoriasCanvas) {
    _chartInstances.categorias = new Chart(categoriasCanvas, {
      type: 'bar',
      data: {
        labels: categoriasGrafico.itens.map(function(item) { return item.cat; }),
        datasets: [{
          label: eventosDisponiveis.length ? 'Categorias' : (_graficosCategoriaModo === 'receitas' ? 'Receitas' : 'Despesas'),
          data: categoriasGrafico.itens.map(function(item) { return item.valor; }),
          backgroundColor: categoriasGrafico.itens.map(function(_, i) { return COLORS[i % COLORS.length] + 'cc'; }),
          borderColor: categoriasGrafico.itens.map(function(_, i) { return COLORS[i % COLORS.length]; }),
          borderWidth: 1.5,
          borderRadius: 5
        }]
      },
      options: Object.assign(graficosHorizontalBarOptions(gridColor), {
        onClick: function(evt, elements) {
          if (!elements || !elements.length) return;
          var idx = elements[0].index;
          var cat = categoriasGrafico.itens[idx] && categoriasGrafico.itens[idx].cat;
          if (cat) graficosAbrirCategoriaDetalhes(graficosCategoriaKey(cat));
        }
      })
    });
  }

  destroyChart('fatura');
  var faturaCanvas = document.getElementById('chart-fatura');
  if (faturaCanvas && !faturaDatasets.length) {
    faturaCanvas.parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0">Nenhuma fatura no periodo.</div>';
  } else if (faturaCanvas) {
    _chartInstances.fatura = new Chart(faturaCanvas, {
      type: 'bar',
      data: { labels: labels, datasets: faturaDatasets },
      options: Object.assign(graficosChartBaseOptions(gridColor), {
        scales: {
          x: { stacked: true, grid: { color: gridColor }, ticks: { font: { size: 10 } } },
          y: {
            stacked: true,
            grid: { color: gridColor },
            ticks: {
              font: { size: 10 },
              callback: function(v) { return graficosValorCompacto(v); }
            }
          }
        }
      })
    });
  }
}
