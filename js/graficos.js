// ════════════════════════════════════════════════════
// GRAFICOS.JS — Aba Gráficos
// ════════════════════════════════════════════════════

var _chartInstances = {};

function destroyChart(id) {
  if (_chartInstances[id]) { _chartInstances[id].destroy(); delete _chartInstances[id]; }
}

function renderGraficos() {
  var c     = data.clients[activeClient];
  var todas = getTransacoes(activeClient);
  var mesesSet = [...new Set(todas.map(l => (l.data || '').slice(0,7)).filter(Boolean))].sort();
  var ultimos6 = mesesSet.slice(-6);
  var selEl    = document.getElementById('graficos-mes-sel');
  var mesFiltro = selEl ? selEl.value : '';
  var mesOpts  = mesesSet.map(m => { var [y,mo] = m.split('-'); return '<option value="' + m + '"' + (m === mesFiltro ? 'selected' : '') + '>' + mo + '/' + y + '</option>'; }).join('');

  document.getElementById('graficos-content').innerHTML =
    '<div class="charts-filter-row">'
    + '<span style="font-size:.7rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Período (categorias/pizza):</span>'
    + '<select id="graficos-mes-sel" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.83rem;padding:6px 10px;border-radius:7px;outline:none" onchange="renderGraficos()">'
    + '<option value=""' + (!mesFiltro ? ' selected' : '') + '>Todos os meses</option>' + mesOpts + '</select>'
    + '<button class="btn-pdf" onclick="exportPDF()">📄 Exportar PDF</button>'
    + '</div>'
    + '<div class="charts-grid-top">'
    + '<div class="chart-card"><h4>📊 Receitas vs Despesas por Mês</h4><div class="chart-wrap"><canvas id="chart-recdesp"></canvas></div></div>'
    + '<div class="chart-card"><h4>🍕 Gastos por Categoria' + (mesFiltro ? ' (mês selecionado)' : ' (todos os meses)') + '</h4><div class="chart-wrap"><canvas id="chart-pizza"></canvas></div></div>'
    + '</div>'
    + '<div class="charts-grid-bottom"><div class="chart-card"><h4>💳 Fatura do Cartão por Mês</h4><div class="chart-wrap-tall"><canvas id="chart-fatura"></canvas></div></div></div>';

  var isDark     = document.documentElement.getAttribute('data-theme') === 'dark';
  var gridColor  = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
  var tickColor  = isDark ? '#7a80a0' : '#5a607a';
  var COLORS     = ['#5b8cff','#3ecfb0','#ff6b6b','#ffc86b','#a78bfa','#f472b6','#34d399','#fb923c','#60a5fa','#e879f9'];

  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = tickColor;

  // Chart 1: Receitas vs Despesas
  destroyChart('recdesp');
  var labels1   = ultimos6.map(m => { var [y,mo] = m.split('-'); return mo + '/' + y.slice(2); });
  var receitas1 = ultimos6.map(m => todas.filter(l => l.tipo === 'credito' && (l.data||'').startsWith(m)).reduce((s,l) => s+l.valor, 0));
  var despesas1 = ultimos6.map(m => todas.filter(l => l.tipo === 'debito'  && (l.data||'').startsWith(m)).reduce((s,l) => s+l.valor, 0));
  _chartInstances['recdesp'] = new Chart(document.getElementById('chart-recdesp'), {
    type: 'bar',
    data: { labels: labels1, datasets: [
      { label:'Receitas', data: receitas1, backgroundColor:'rgba(62,207,176,.75)', borderColor:'rgba(62,207,176,1)', borderWidth:1.5, borderRadius:5 },
      { label:'Despesas', data: despesas1, backgroundColor:'rgba(255,107,107,.75)', borderColor:'rgba(255,107,107,1)', borderWidth:1.5, borderRadius:5 }
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{boxWidth:12,font:{size:11}}}, tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}} }, scales:{ x:{grid:{color:gridColor},ticks:{font:{size:10}}}, y:{grid:{color:gridColor},ticks:{font:{size:10},callback:v=>'R$'+Number(v).toLocaleString('pt-BR',{notation:'compact',maximumFractionDigits:1})}} } }
  });

  // Chart 2: Pizza categorias
  destroyChart('pizza');
  var filtradas = (mesFiltro ? todas.filter(l => (l.data||'').startsWith(mesFiltro)) : todas).filter(l => l.tipo === 'debito');
  var catMap = {}; filtradas.forEach(l => { var k = l.cat||'Outros'; catMap[k] = (catMap[k]||0)+l.valor; });
  var pizzaEntries = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,10);
  if (pizzaEntries.length === 0) {
    document.getElementById('chart-pizza').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="icon">📭</div>Nenhuma despesa no período.</div>';
  } else {
    _chartInstances['pizza'] = new Chart(document.getElementById('chart-pizza'), {
      type: 'doughnut',
      data: { labels: pizzaEntries.map(e=>e[0]), datasets:[{ data:pizzaEntries.map(e=>e[1]), backgroundColor:COLORS, borderColor:isDark?'#1e2336':'#e8eaf4', borderWidth:2, hoverOffset:6 }] },
      options: { responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{position:'right',labels:{boxWidth:11,font:{size:10},padding:10}}, tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)+' ('+Math.round(ctx.parsed/pizzaEntries.reduce((s,e)=>s+e[1],0)*100)+'%)'}} } }
    });
  }

  // Chart 3: Fatura por cartão
  destroyChart('fatura');
  var cartoes = c.cartoes || [];
  if (cartoes.length === 0 || !c.cartao || c.cartao.length === 0) {
    document.getElementById('chart-fatura').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="icon">💳</div>Nenhum lançamento de cartão.</div>';
  } else {
    var labels3   = ultimos6.map(m => { var [y,mo] = m.split('-'); return mo + '/' + y.slice(2); });
    var datasets3 = cartoes.slice(0,6).map((cc,i) => ({
      label: cc.nome,
      data:  ultimos6.map(m => c.cartao.filter(it => it.cartaoId===cc.id && it.tipo!=='estorno' && (it.data||'').startsWith(m)).reduce((s,it) => s+Number(it.valor),0)),
      backgroundColor: COLORS[i%COLORS.length]+'cc', borderColor: COLORS[i%COLORS.length], borderWidth:1.5, borderRadius:5
    }));
    if (datasets3.every(d => d.data.every(v => v===0))) {
      document.getElementById('chart-fatura').parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="icon">📭</div>Sem dados de fatura no período.</div>';
    } else {
      _chartInstances['fatura'] = new Chart(document.getElementById('chart-fatura'), {
        type: 'bar',
        data: { labels: labels3, datasets: datasets3 },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{boxWidth:12,font:{size:11}}}, tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}} }, scales:{ x:{stacked:true,grid:{color:gridColor},ticks:{font:{size:10}}}, y:{stacked:true,grid:{color:gridColor},ticks:{font:{size:10},callback:v=>'R$'+Number(v).toLocaleString('pt-BR',{notation:'compact',maximumFractionDigits:1})}} } }
      });
    }
  }
}
