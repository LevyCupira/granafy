// ════════════════════════════════════════════════════
// DRE.JS — Demonstração do Resultado do Exercício
// ════════════════════════════════════════════════════

function renderDRE() {
  const todas = getTransacoes(activeClient);
  const meses = [...new Set(todas.map(l => (l.data || '').slice(0, 7)).filter(Boolean))].sort().reverse();

  const selEl   = document.getElementById('dre-mes-sel');
  const mesAtual = selEl ? selEl.value : (meses[0] || '');

  const filtered = mesAtual ? todas.filter(l => (l.data || '').startsWith(mesAtual)) : todas;

  // ── Classifica cada lançamento pelo tipo da categoria ──
  const receitas  = filtered.filter(l => l.tipo === 'credito');
  const fixas     = filtered.filter(l => l.tipo === 'debito' && tipoCat(l.cat) === 'fixa');
  const variaveis = filtered.filter(l => l.tipo === 'debito' && tipoCat(l.cat) !== 'fixa');

  const tReceita  = receitas.reduce((s, l)  => s + l.valor, 0);
  const tFixas    = fixas.reduce((s, l)     => s + l.valor, 0);
  const tVariavel = variaveis.reduce((s, l) => s + l.valor, 0);
  const tDesp     = tFixas + tVariavel;
  const resultado = tReceita - tDesp;
  const txPoupanca = tReceita > 0 ? (resultado / tReceita * 100) : 0;

  const mesOpts = meses.map(m => {
    const [y, mo] = m.split('-');
    return '<option value="' + m + '"' + (m === mesAtual ? ' selected' : '') + '>' + mo + '/' + y + '</option>';
  }).join('');

  // ── Agrupa por categoria ──
  function groupByCat(arr) {
    const m = {};
    arr.forEach(l => { m[l.cat || 'Outros'] = (m[l.cat || 'Outros'] || 0) + l.valor; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  function dreRow(label, valor, cls, indent) {
    const pad = indent ? 'padding-left:20px' : '';
    return '<tr>'
      + '<td style="' + pad + ';font-size:.84rem;color:' + (indent ? 'var(--text)' : 'var(--muted)') + ';font-weight:' + (indent ? '400' : '600') + '">' + esc(label) + '</td>'
      + '<td style="text-align:right;font-size:.84rem" class="' + cls + '">' + (indent ? '(' + fmt(valor) + ')' : fmt(valor)) + '</td>'
      + '</tr>';
  }

  function dreTotal(label, valor, cls, border) {
    const borderStyle = border ? 'border-top:2px solid var(--border);border-bottom:2px solid var(--border)' : 'border-top:1px solid var(--border)';
    return '<tr style="' + borderStyle + '">'
      + '<td style="font-size:.86rem;font-weight:700;padding:10px 12px">' + esc(label) + '</td>'
      + '<td style="text-align:right;font-size:.86rem;font-weight:700;padding:10px 12px" class="' + cls + '">' + fmt(valor) + '</td>'
      + '</tr>';
  }

  // ── Monta linhas das categorias ──
  const grRec = groupByCat(receitas);
  const grFix = groupByCat(fixas);
  const grVar = groupByCat(variaveis);

  let recRows  = grRec.map(([cat, val]) => dreRow(cat, val, 'val-pos', true)).join('');
  let fixRows  = grFix.map(([cat, val]) => dreRow(cat, val, 'val-neg', true)).join('');
  let varRows  = grVar.map(([cat, val]) => dreRow(cat, val, 'val-neg', true)).join('');

  const resClass = resultado >= 0 ? 'val-pos' : 'val-neg';

  const html = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
      <span style="font-size:.7rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Período:</span>
      <select id="dre-mes-sel" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:.83rem;padding:6px 10px;border-radius:7px;outline:none" onchange="renderDRE()">
        <option value=""${mesAtual === '' ? ' selected' : ''}>Todos os meses</option>${mesOpts}
      </select>
    </div>

    <!-- Cards de resumo -->
    <div class="summary-grid" style="margin-bottom:24px">
      <div class="summary-card"><div class="s-label">Receita total</div><div class="s-val green">${fmt(tReceita)}</div></div>
      <div class="summary-card"><div class="s-label">Despesas fixas</div><div class="s-val red">${fmt(tFixas)}</div></div>
      <div class="summary-card"><div class="s-label">Despesas variáveis</div><div class="s-val red">${fmt(tVariavel)}</div></div>
      <div class="summary-card"><div class="s-label">Resultado líquido</div><div class="s-val ${resClass}">${fmt(resultado)}</div></div>
      <div class="summary-card"><div class="s-label">Taxa de poupança</div><div class="s-val ${txPoupanca >= 0 ? 'green' : 'red'}">${txPoupanca.toFixed(1)}%</div></div>
    </div>

    <!-- Tabela DRE -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--surface)">
            <th style="padding:10px 12px;text-align:left;font-size:.69rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border)">Descrição</th>
            <th style="padding:10px 12px;text-align:right;font-size:.69rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border)">Valor</th>
          </tr>
        </thead>
        <tbody>
          <!-- RECEITAS -->
          <tr style="background:rgba(62,207,176,.06)">
            <td colspan="2" style="padding:8px 12px;font-size:.72rem;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.8px">📈 Receitas</td>
          </tr>
          ${recRows || '<tr><td colspan="2" style="padding:8px 12px 8px 20px;font-size:.82rem;color:var(--muted)">Nenhuma receita no período.</td></tr>'}
          ${dreTotal('(=) Total de Receitas', tReceita, 'val-pos', false)}

          <!-- DESPESAS FIXAS -->
          <tr style="background:rgba(255,107,107,.05)">
            <td colspan="2" style="padding:8px 12px;font-size:.72rem;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.8px">🔒 Despesas Fixas</td>
          </tr>
          ${fixRows || '<tr><td colspan="2" style="padding:8px 12px 8px 20px;font-size:.82rem;color:var(--muted)">Nenhuma despesa fixa no período.</td></tr>'}
          ${dreTotal('(−) Total de Despesas Fixas', tFixas, 'val-neg', false)}

          <!-- DESPESAS VARIÁVEIS -->
          <tr style="background:rgba(255,198,107,.05)">
            <td colspan="2" style="padding:8px 12px;font-size:.72rem;font-weight:700;color:var(--warning);text-transform:uppercase;letter-spacing:.8px">📊 Despesas Variáveis</td>
          </tr>
          ${varRows || '<tr><td colspan="2" style="padding:8px 12px 8px 20px;font-size:.82rem;color:var(--muted)">Nenhuma despesa variável no período.</td></tr>'}
          ${dreTotal('(−) Total de Despesas Variáveis', tVariavel, 'val-neg', false)}

          <!-- RESULTADO -->
          ${dreTotal('(=) Resultado Líquido', resultado, resClass, true)}

          <!-- TAXA DE POUPANÇA -->
          <tr>
            <td style="padding:8px 12px;font-size:.82rem;color:var(--muted)">Taxa de poupança</td>
            <td style="text-align:right;padding:8px 12px;font-size:.84rem;font-weight:600" class="${txPoupanca >= 0 ? 'val-pos' : 'val-neg'}">${txPoupanca.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Nota sobre categorias -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;font-size:.8rem;color:var(--muted)">
      💡 <strong style="color:var(--text)">Como o DRE classifica as categorias:</strong><br>
      As categorias são classificadas como <strong style="color:var(--success)">Receita</strong>, 
      <strong style="color:var(--danger)">Despesa Fixa</strong> ou 
      <strong style="color:var(--warning)">Despesa Variável</strong> nas configurações.
      Lançamentos do cartão de crédito entram como Despesa Variável.
      <br><span style="margin-top:6px;display:inline-block">
        <button class="btn-sm" onclick="openModal('settings','cats_cc')" style="font-size:.75rem">⚙ Gerenciar classificação das categorias</button>
      </span>
    </div>`;

  document.getElementById('dre-content').innerHTML = html;
}
