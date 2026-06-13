var _chartInstances = {};
var _graficosPeriodos = null;
var _graficosFluxoModo = 'barras';
var _graficosCategoriaModo = 'despesas';

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

function graficosMesesDisponiveis(cliente, transacoes) {
  return Array.from(new Set(
    transacoes.map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean)
      .concat((cliente.cartao || []).map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean))
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
  var total = (lista || []).reduce(function(s, item) { return s + Number(item.valor || 0); }, 0);
  var principais = (lista || []).slice().sort(function(a, b) { return b.valor - a.valor; }).slice(0, limite || 8);
  var usados = principais.reduce(function(s, item) { return s + Number(item.valor || 0); }, 0);

  if (total - usados > 0.009) principais.push({ cat: 'Outros', valor: total - usados });
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
      return '<div class="charts-ranking-row">'
        + '<div><strong>' + esc(item.cat || 'Outros') + '</strong><span>' + pct + '% de ' + (tipo === 'receitas' ? 'receitas' : 'despesas') + '</span></div>'
        + '<div class="charts-ranking-bar"><span class="' + (tipo === 'receitas' ? 'income' : 'expense') + '" style="width:' + pct + '%"></span></div>'
        + '<strong>' + fmt(item.valor) + '</strong>'
        + '</div>';
    }).join('')
    + '</div>';
}

function renderGraficos() {
  var c = data.clients[activeClient];
  if (!c) return;

  var todasBase = getTransacoes(activeClient);
  var todas = todasBase.filter(function(l) { return !l.ehMovConta; });
  var mesesSet = graficosMesesDisponiveis(c, todas);
  var periodos = lerPeriodosSelecionados('graficos-periodos-sel', mesesSet, _graficosPeriodos);
  _graficosPeriodos = periodos;

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
  var faturaDatasets = graficosFaturasPorPeriodo(c, periodosGrafico, COLORS);
  var faturaTotal = faturaDatasets.reduce(function(total, ds) {
    return total + ds.data.reduce(function(s, valor) { return s + Number(valor || 0); }, 0);
  }, 0);
  var periodoTexto = periodos.length ? periodos.map(formatPeriodoLabel).join(', ') : 'Selecione um periodo';

  document.getElementById('graficos-content').innerHTML =
    '<div class="charts-filter-row charts-toolbar">'
      + '<span class="period-label">Periodo:</span>'
      + buildPeriodoMultiSelect('graficos-periodos-sel', mesesSet, periodos, 'renderGraficos()')
      + '<label class="charts-control"><span>Fluxo</span><select onchange="graficosSetFluxoModo(this.value)">'
        + '<option value="barras"' + (_graficosFluxoModo === 'barras' ? ' selected' : '') + '>Barras</option>'
        + '<option value="linha"' + (_graficosFluxoModo === 'linha' ? ' selected' : '') + '>Linha</option>'
        + '<option value="acumulado"' + (_graficosFluxoModo === 'acumulado' ? ' selected' : '') + '>Resultado acumulado</option>'
      + '</select></label>'
      + '<label class="charts-control"><span>Categorias</span><select onchange="graficosSetCategoriaModo(this.value)">'
        + '<option value="despesas"' + (_graficosCategoriaModo === 'despesas' ? ' selected' : '') + '>Despesas</option>'
        + '<option value="receitas"' + (_graficosCategoriaModo === 'receitas' ? ' selected' : '') + '>Receitas</option>'
      + '</select></label>'
      + '<span class="period-help">' + esc(periodoTexto) + '</span>'
      + '<button class="btn-pdf" onclick="exportPDF()">Exportar PDF</button>'
    + '</div>'
    + graficosResumoHtml(consolidadoPeriodo.totalReceitas, consolidadoPeriodo.totalDespesas, consolidadoPeriodo.totalReceitas - consolidadoPeriodo.totalDespesas, transacoesPeriodo.length, faturaTotal)
    + '<div class="charts-grid-main">'
      + '<div class="chart-card chart-card-wide"><h4>Fluxo financeiro</h4><div class="chart-wrap"><canvas id="chart-recdesp"></canvas></div></div>'
      + '<div class="chart-card"><h4>Ranking de categorias</h4><div class="chart-wrap"><canvas id="chart-categorias"></canvas></div></div>'
    + '</div>'
    + '<div class="charts-grid-main">'
      + '<div class="chart-card"><h4>Detalhe do ranking</h4>' + graficosRankingHtml(categorias.itens, categorias.total, _graficosCategoriaModo) + '</div>'
      + '<div class="chart-card"><h4>Fatura do cartao por mes</h4><div class="chart-wrap"><canvas id="chart-fatura"></canvas></div></div>'
    + '</div>';

  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = tickColor;

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
  _chartInstances.recdesp = new Chart(document.getElementById('chart-recdesp'), {
    type: _graficosFluxoModo === 'barras' ? 'bar' : 'line',
    data: { labels: labels, datasets: fluxoDatasets },
    options: graficosChartBaseOptions(gridColor)
  });

  destroyChart('categorias');
  if (!categorias.itens.length) {
    document.getElementById('chart-categorias').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0">Nenhuma categoria no periodo.</div>';
  } else {
    _chartInstances.categorias = new Chart(document.getElementById('chart-categorias'), {
      type: 'bar',
      data: {
        labels: categorias.itens.map(function(item) { return item.cat; }),
        datasets: [{
          label: _graficosCategoriaModo === 'receitas' ? 'Receitas' : 'Despesas',
          data: categorias.itens.map(function(item) { return item.valor; }),
          backgroundColor: categorias.itens.map(function(_, i) { return COLORS[i % COLORS.length] + 'cc'; }),
          borderColor: categorias.itens.map(function(_, i) { return COLORS[i % COLORS.length]; }),
          borderWidth: 1.5,
          borderRadius: 5
        }]
      },
      options: Object.assign(graficosChartBaseOptions(gridColor), {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.raw); } } }
        }
      })
    });
  }

  destroyChart('fatura');
  if (!faturaDatasets.length) {
    document.getElementById('chart-fatura').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0">Nenhuma fatura no periodo.</div>';
  } else {
    _chartInstances.fatura = new Chart(document.getElementById('chart-fatura'), {
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
