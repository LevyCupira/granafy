var _chartInstances = {};
var _graficosPeriodos = null;

function destroyChart(id) {
  if (_chartInstances[id]) {
    _chartInstances[id].destroy();
    delete _chartInstances[id];
  }
}

function renderGraficos() {
  var c = data.clients[activeClient];
  var todasBase = getTransacoes(activeClient);
  var todas = todasBase.filter(function(l) { return !l.ehMovConta; });
  var mesesSet = Array.from(new Set(
    todas.map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean)
      .concat((c.cartao || []).map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean))
  )).sort().reverse();

  var periodos = lerPeriodosSelecionados('graficos-periodos-sel', mesesSet, _graficosPeriodos);
  _graficosPeriodos = periodos;

  var periodoSet = new Set(periodos);
  var periodosGrafico = periodos.slice().sort();
  var periodoTexto = periodos.length ? periodos.map(formatPeriodoLabel).join(', ') : 'Selecione um periodo';
  var mesFiltro = periodos.length === 1 ? periodos[0] : '';

  document.getElementById('graficos-content').innerHTML =
    '<div class="charts-filter-row">'
    + '<span class="period-label">Selecionar periodo:</span>'
    + buildPeriodoMultiSelect('graficos-periodos-sel', mesesSet, periodos, 'renderGraficos()')
    + '<span class="period-help">' + esc(periodoTexto) + ' &bull; escolha um ou mais meses.</span>'
    + '<button class="btn-pdf" onclick="exportPDF()">&#128196; Exportar PDF</button>'
    + '</div>'
    + '<div class="charts-grid-top">'
    + '<div class="chart-card"><h4>&#128202; Receitas vs Despesas por mes</h4><div class="chart-wrap"><canvas id="chart-recdesp"></canvas></div></div>'
    + '<div class="chart-card"><h4>Gastos por categoria' + (mesFiltro ? ' (mes selecionado)' : ' (todos os meses)') + '</h4><div class="chart-wrap"><canvas id="chart-pizza"></canvas></div></div>'
    + '</div>'
    + '<div class="charts-grid-bottom"><div class="chart-card"><h4>Fatura do cartao por mes</h4><div class="chart-wrap-tall"><canvas id="chart-fatura"></canvas></div></div></div>';

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var gridColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
  var tickColor = isDark ? '#7a80a0' : '#5a607a';
  var COLORS = ['#5b8cff','#3ecfb0','#ff6b6b','#ffc86b','#a78bfa','#f472b6','#34d399','#fb923c','#60a5fa','#e879f9'];

  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = tickColor;

  destroyChart('recdesp');
  var labels1 = periodosGrafico.map(function(m) { var parts = m.split('-'); return parts[1] + '/' + parts[0].slice(2); });
  var receitas1 = periodosGrafico.map(function(m) {
    return consolidarTransacoesAnaliticas(todas.filter(function(l) { return (l.data || '').startsWith(m); })).totalReceitas;
  });
  var despesas1 = periodosGrafico.map(function(m) {
    return consolidarTransacoesAnaliticas(todas.filter(function(l) { return (l.data || '').startsWith(m); })).totalDespesas;
  });
  _chartInstances.recdesp = new Chart(document.getElementById('chart-recdesp'), {
    type: 'bar',
    data: {
      labels: labels1,
      datasets: [
        { label: 'Receitas', data: receitas1, backgroundColor: 'rgba(62,207,176,.75)', borderColor: 'rgba(62,207,176,1)', borderWidth: 1.5, borderRadius: 5 },
        { label: 'Despesas', data: despesas1, backgroundColor: 'rgba(255,107,107,.75)', borderColor: 'rgba(255,107,107,1)', borderWidth: 1.5, borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.raw); } } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
        y: { grid: { color: gridColor }, ticks: { font: { size: 10 }, callback: function(v) { return 'R$' + Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }); } } }
      }
    }
  });

  destroyChart('pizza');
  var filtradas = consolidarTransacoesAnaliticas(todas.filter(function(l) {
    return periodoSet.has((l.data || '').slice(0, 7));
  })).despesas;
  var catMap = {};
  filtradas.forEach(function(l) { var k = l.cat || 'Outros'; catMap[k] = (catMap[k] || 0) + l.valor; });
  var pizzaEntries = Object.entries(catMap).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
  if (pizzaEntries.length === 0) {
    document.getElementById('chart-pizza').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="icon">&#128172;</div>Nenhuma despesa no periodo.</div>';
  } else {
    _chartInstances.pizza = new Chart(document.getElementById('chart-pizza'), {
      type: 'doughnut',
      data: { labels: pizzaEntries.map(function(e) { return e[0]; }), datasets: [{ data: pizzaEntries.map(function(e) { return e[1]; }), backgroundColor: COLORS, borderColor: isDark ? '#1e2336' : '#e8eaf4', borderWidth: 2, hoverOffset: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 10 }, padding: 10 } }, tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.raw) + ' (' + Math.round(ctx.parsed / pizzaEntries.reduce(function(s, e) { return s + e[1]; }, 0) * 100) + '%)'; } } } } }
    });
  }

  destroyChart('fatura');
  var cartoes = c.cartoes || [];
  if (cartoes.length === 0 || !c.cartao || c.cartao.length === 0) {
    document.getElementById('chart-fatura').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="icon">&#128179;</div>Nenhum lancamento de cartao.</div>';
  } else {
    var mesesFatura = periodosGrafico;
    var labels3 = mesesFatura.map(function(m) { var parts = m.split('-'); return parts[1] + '/' + parts[0].slice(2); });
    var cartoesComSemVinculo = cartoes.slice();
    if ((c.cartao || []).some(function(it) { return !it.cartaoId; })) cartoesComSemVinculo.push({ id: '__sem_cartao', nome: 'Sem cartao' });
    var datasets3 = cartoesComSemVinculo.map(function(cc, i) {
      return {
        label: cc.nome,
        data: mesesFatura.map(function(m) {
          return c.cartao
            .filter(function(it) { return (cc.id === '__sem_cartao' ? !it.cartaoId : it.cartaoId === cc.id) && (it.data || '').startsWith(m); })
            .reduce(function(s, it) { return s + (it.tipo === 'estorno' ? -Number(it.valor || 0) : Number(it.valor || 0)); }, 0);
        }),
        backgroundColor: COLORS[i % COLORS.length] + 'cc',
        borderColor: COLORS[i % COLORS.length],
        borderWidth: 1.5,
        borderRadius: 5
      };
    }).filter(function(ds) { return ds.data.some(function(v) { return v !== 0; }); });

    if (datasets3.every(function(d) { return d.data.every(function(v) { return v === 0; }); })) {
      document.getElementById('chart-fatura').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="icon">&#128172;</div>Sem dados de fatura no periodo.</div>';
    } else {
      _chartInstances.fatura = new Chart(document.getElementById('chart-fatura'), {
        type: 'bar',
        data: { labels: labels3, datasets: datasets3 },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.raw); } } } },
          scales: {
            x: { stacked: false, grid: { color: gridColor }, ticks: { font: { size: 10 } } },
            y: { stacked: false, grid: { color: gridColor }, ticks: { font: { size: 10 }, callback: function(v) { return 'R$' + Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }); } } }
          }
        }
      });
    }
  }
}
