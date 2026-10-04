/* ════════════════════════════════════════════════════
   FINANCEIRO.JS — Dashboard Financeiro Completo
   ════════════════════════════════════════════════════ */

let financeiroDashboard = {
  currentData: null,
  currentMonth: new Date(),
  charts: {},

  async init() {
    this.renderLoading();
    try {
      await this.loadData();
      this.renderDashboard();
      this.setupEventListeners();
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      this.renderError();
    }
  },

  renderLoading() {
    document.getElementById('financeiro-content').innerHTML = `
      <div class="dashboard-loading">
        <div class="spinner"></div>
        <p>Carregando dashboard...</p>
      </div>
    `;
  },

  renderError() {
    document.getElementById('financeiro-content').innerHTML = `
      <div class="empty-state">
        <p>❌ Erro ao carregar dashboard. Tente novamente.</p>
      </div>
    `;
  },

  async loadData() {
    const clientId = window.currentClientId;
    if (!clientId) throw new Error('Nenhum cliente selecionado');

    const monthStart = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const monthEnd = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    const lastMonthStart = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    const lastMonthEnd = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 0);

    // Buscar dados do mês atual
    const [extratos, cartoes, dividas] = await Promise.all([
      supabaseClient
        .from('extrato')
        .select('*')
        .eq('cliente_id', clientId)
        .gte('data', monthStart.toISOString().split('T')[0])
        .lte('data', monthEnd.toISOString().split('T')[0]),
      supabaseClient
        .from('cartao')
        .select('*')
        .eq('cliente_id', clientId)
        .gte('data_transacao', monthStart.toISOString().split('T')[0])
        .lte('data_transacao', monthEnd.toISOString().split('T')[0]),
      supabaseClient
        .from('dividas')
        .select('*')
        .eq('cliente_id', clientId)
        .is('data_pagamento', null)
    ]);

    // Buscar dados do mês anterior
    const lastMonthExtratos = await supabaseClient
      .from('extrato')
      .select('*')
      .eq('cliente_id', clientId)
      .gte('data', lastMonthStart.toISOString().split('T')[0])
      .lte('data', lastMonthEnd.toISOString().split('T')[0]);

    this.currentData = {
      extratos: extratos.data || [],
      cartoes: cartoes.data || [],
      dividas: dividas.data || [],
      lastMonthExtratos: lastMonthExtratos.data || []
    };
  },

  renderDashboard() {
    const metrics = this.calculateMetrics();

    document.getElementById('financeiro-content').innerHTML = `
      <div class="financeiro-dashboard">
        <!-- Header com filtro de período -->
        <div class="dashboard-header">
          <h3>Dashboard Financeiro</h3>
          <div class="period-selector">
            <button class="period-btn" onclick="financeiroDashboard.previousMonth()">← Anterior</button>
            <span class="period-display" id="periodDisplay">${this.getMonthDisplay()}</span>
            <button class="period-btn" onclick="financeiroDashboard.nextMonth()">Próximo →</button>
          </div>
        </div>

        <!-- KPIs (Métricas Principais) -->
        <div class="kpi-grid">
          <div class="kpi-card kpi-despesa">
            <div class="kpi-label">Despesas (Mês)</div>
            <div class="kpi-value">R$ ${metrics.totalDespesas.toFixed(2)}</div>
            <div class="kpi-change ${metrics.despesasChange >= 0 ? 'negative' : 'positive'}">
              ${metrics.despesasChange >= 0 ? '↑' : '↓'} ${Math.abs(metrics.despesasChange).toFixed(1)}% vs mês anterior
            </div>
          </div>

          <div class="kpi-card kpi-receita">
            <div class="kpi-label">Receitas (Mês)</div>
            <div class="kpi-value">R$ ${metrics.totalReceitas.toFixed(2)}</div>
            <div class="kpi-change ${metrics.receitasChange <= 0 ? 'negative' : 'positive'}">
              ${metrics.receitasChange <= 0 ? '↓' : '↑'} ${Math.abs(metrics.receitasChange).toFixed(1)}% vs mês anterior
            </div>
          </div>

          <div class="kpi-card kpi-saldo">
            <div class="kpi-label">Saldo (Mês)</div>
            <div class="kpi-value ${metrics.saldo >= 0 ? 'positive' : 'negative'}">
              R$ ${metrics.saldo.toFixed(2)}
            </div>
            <div class="kpi-info">Receitas - Despesas</div>
          </div>

          <div class="kpi-card kpi-divida">
            <div class="kpi-label">Dívidas em Aberto</div>
            <div class="kpi-value">R$ ${metrics.totalDividas.toFixed(2)}</div>
            <div class="kpi-info">${metrics.totalDividasCount} dívida(s)</div>
          </div>
        </div>

        <!-- Gráficos -->
        <div class="charts-grid">
          <!-- Gráfico Pizza: Despesas por Categoria -->
          <div class="chart-container">
            <h4>Despesas por Categoria</h4>
            <canvas id="categoryChart"></canvas>
          </div>

          <!-- Gráfico Linha: Fluxo Mês a Mês -->
          <div class="chart-container">
            <h4>Fluxo de Caixa</h4>
            <canvas id="flowChart"></canvas>
          </div>
        </div>

        <!-- Top 5 Categorias -->
        <div class="top-categories">
          <h4>Top 5 Categorias</h4>
          <div class="categories-list">
            ${metrics.topCategories.map(cat => `
              <div class="category-item">
                <div class="category-info">
                  <span class="category-name">${cat.name}</span>
                  <span class="category-percentage">${cat.percentage.toFixed(1)}%</span>
                </div>
                <div class="category-bar">
                  <div class="category-fill" style="width: ${cat.percentage}%"></div>
                </div>
                <span class="category-value">R$ ${cat.value.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.drawCharts(metrics);
  },

  calculateMetrics() {
    const extratos = this.currentData.extratos;
    const cartoes = this.currentData.cartoes;
    const dividas = this.currentData.dividas;
    const lastMonthExtratos = this.currentData.lastMonthExtratos;

    // Total de despesas (mês atual)
    const totalDespesas = extratos
      .filter(e => e.tipo === 'despesa')
      .reduce((sum, e) => sum + (e.valor || 0), 0);

    const totalCartaoDespesas = cartoes
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    // Total de receitas (mês atual)
    const totalReceitas = extratos
      .filter(e => e.tipo === 'receita')
      .reduce((sum, e) => sum + (e.valor || 0), 0);

    // Dívidas
    const totalDividas = dividas.reduce((sum, d) => sum + (d.valor || 0), 0);
    const totalDividasCount = dividas.length;

    // Saldo
    const saldo = totalReceitas - totalDespesas - totalCartaoDespesas;

    // Comparativos com mês anterior
    const lastMonthDespesas = lastMonthExtratos
      .filter(e => e.tipo === 'despesa')
      .reduce((sum, e) => sum + (e.valor || 0), 0);

    const lastMonthReceitas = lastMonthExtratos
      .filter(e => e.tipo === 'receita')
      .reduce((sum, e) => sum + (e.valor || 0), 0);

    const despesasChange = lastMonthDespesas > 0
      ? ((totalDespesas - lastMonthDespesas) / lastMonthDespesas) * 100
      : 0;

    const receitasChange = lastMonthReceitas > 0
      ? ((totalReceitas - lastMonthReceitas) / lastMonthReceitas) * 100
      : 0;

    // Top categorias
    const categoriesByValue = {};
    extratos.forEach(e => {
      if (e.tipo === 'despesa' && e.categoria) {
        categoriesByValue[e.categoria] = (categoriesByValue[e.categoria] || 0) + (e.valor || 0);
      }
    });

    cartoes.forEach(c => {
      const cat = c.categoria || 'Cartão';
      categoriesByValue[cat] = (categoriesByValue[cat] || 0) + (c.valor || 0);
    });

    const topCategories = Object.entries(categoriesByValue)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalDespesas > 0 ? (value / (totalDespesas + totalCartaoDespesas)) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalDespesas: totalDespesas + totalCartaoDespesas,
      totalReceitas,
      saldo,
      totalDividas,
      totalDividasCount,
      despesasChange,
      receitasChange,
      topCategories,
      categoriesByValue
    };
  },

  drawCharts(metrics) {
    this.drawCategoryChart(metrics);
    this.drawFlowChart(metrics);
  },

  drawCategoryChart(metrics) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;

    if (this.charts.category) this.charts.category.destroy();

    const labels = metrics.topCategories.map(c => c.name);
    const data = metrics.topCategories.map(c => c.value);

    this.charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            'rgba(91, 140, 255, 0.8)',
            'rgba(62, 207, 176, 0.8)',
            'rgba(255, 107, 107, 0.8)',
            'rgba(255, 200, 107, 0.8)',
            'rgba(200, 107, 255, 0.8)'
          ],
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--text)',
              font: { family: "'DM Sans', sans-serif" }
            }
          }
        }
      }
    });
  },

  drawFlowChart(metrics) {
    const ctx = document.getElementById('flowChart')?.getContext('2d');
    if (!ctx) return;

    if (this.charts.flow) this.charts.flow.destroy();

    const days = [];
    const revenues = [];
    const expenses = [];

    const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const monthEnd = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);

    while (date <= monthEnd) {
      const dateStr = date.toISOString().split('T')[0];
      days.push(date.getDate());

      const dayRevenue = this.currentData.extratos
        .filter(e => e.data === dateStr && e.tipo === 'receita')
        .reduce((sum, e) => sum + (e.valor || 0), 0);

      const dayExpense = this.currentData.extratos
        .filter(e => e.data === dateStr && e.tipo === 'despesa')
        .reduce((sum, e) => sum + (e.valor || 0), 0);

      revenues.push(dayRevenue);
      expenses.push(dayExpense);

      date.setDate(date.getDate() + 1);
    }

    this.charts.flow = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Receitas',
            data: revenues,
            borderColor: 'rgba(62, 207, 176, 1)',
            backgroundColor: 'rgba(62, 207, 176, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Despesas',
            data: expenses,
            borderColor: 'rgba(255, 107, 107, 1)',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: {
              color: 'var(--text)',
              font: { family: "'DM Sans', sans-serif" }
            }
          }
        },
        scales: {
          y: {
            ticks: { color: 'var(--muted)' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            ticks: { color: 'var(--muted)' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  },

  getMonthDisplay() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  },

  previousMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.init();
  },

  nextMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.init();
  },

  setupEventListeners() {
    // Event listeners adicionais podem ser adicionados aqui
  }
};

// Integração com o sistema de abas
window.addEventListener('tab-changed', (e) => {
  if (e.detail.tabId === 'tab-financeiro') {
    financeiroDashboard.init();
  }
});
