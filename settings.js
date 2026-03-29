// ════════════════════════════════════════════════════
// SETTINGS.JS — Modal Configurações e Backup
// ════════════════════════════════════════════════════

function openModal(section, tab) {
  document.getElementById('modalOverlay').classList.add('open');
  section === 'settings' ? renderSettingsModal(tab) : renderBackupModal();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function renderBackupModal() {
  document.getElementById('modalTitle').textContent = '💾 Backup';
  document.getElementById('modalBody').innerHTML =
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:18px">Exporte todos os dados como JSON ou restaure a partir de um arquivo salvo.</p>'
    + '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<button class="btn-add" style="margin-top:0;padding:10px 18px" onclick="exportData()">⬇ Exportar dados (JSON)</button>'
    + '<button class="btn-sm" style="padding:9px 18px;font-size:.83rem" onclick="document.getElementById(\'importFileInput\').click()">⬆ Importar dados (JSON)</button>'
    + '</div>';
}

function exportData() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
  a.download = 'granafy_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importData(event) {
  var file = event.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var imp = JSON.parse(e.target.result);
      if (!imp.clients) throw new Error('Estrutura inválida.');
      if (!confirm('Importar? Substituirá os dados atuais.')) return;
      data = imp; saveData(); activeClient = null;
      document.getElementById('clientTitle').textContent = 'Selecione um cliente';
      document.getElementById('toggleLabel').textContent = 'Selecionar cliente…';
      document.getElementById('toggleAvatar').style.display = 'none';
      renderClientList();
      ['cartao-content','dividas-content','extrato-content','resumo-content','dre-content','graficos-content'].forEach(id => {
        document.getElementById(id).innerHTML = '<div class="empty-state"><div class="icon">👈</div>Selecione um cliente.</div>';
      });
      closeModal(); alert('Dados importados com sucesso!');
    } catch(err) { alert('Erro ao importar: ' + err.message); }
  };
  reader.readAsText(file); event.target.value = '';
}

function renderSettingsModal(activeTabKey) {
  document.getElementById('modalTitle').textContent = '⚙️ Configurações';
  document.getElementById('modalBody').innerHTML =
    '<div class="modal-tabs" id="settingsTabs">'
    + '<button class="modal-tab" data-stab="cats_cc"     onclick="switchSettingsTab(\'cats_cc\')">🏦 Categorias Conta Corrente</button>'
    + '<button class="modal-tab" data-stab="cats_cartao" onclick="switchSettingsTab(\'cats_cartao\')">💳 Categorias Cartão</button>'
    + '<button class="modal-tab" data-stab="tema"        onclick="switchSettingsTab(\'tema\')">🎨 Tema</button>'
    + '</div>'
    + '<div id="modal-panel-cats_cc"     class="modal-panel"></div>'
    + '<div id="modal-panel-cats_cartao" class="modal-panel"></div>'
    + '<div id="modal-panel-tema"        class="modal-panel"></div>';
  switchSettingsTab(activeTabKey || 'cats_cc');
}

function switchSettingsTab(tab) {
  document.querySelectorAll('#settingsTabs .modal-tab').forEach(b => b.classList.toggle('active', b.dataset.stab === tab));
  document.querySelectorAll('#modalBody .modal-panel').forEach(p => p.classList.remove('active'));
  var panel = document.getElementById('modal-panel-' + tab); if (!panel) return;
  panel.classList.add('active');
  if (tab === 'cats_cc')     renderCatsPanel('cc');
  if (tab === 'cats_cartao') renderCatsPanel('cartao');
  if (tab === 'tema')        renderTemaPanel();
}

function renderCatsPanel(tipo) {
  var cats = tipo === 'cc' ? loadCatsCC() : loadCatsCartao();
  var pid  = 'modal-panel-cats_' + (tipo === 'cc' ? 'cc' : 'cartao');
  var TIPOS_DRE = { receita: '🟢 Receita', fixa: '🔴 Fixa', variavel: '🟡 Variável' };

  var tagHtml;
  if (tipo === 'cc') {
    // Categorias CC têm tipo DRE editável
    tagHtml = cats.map((c, i) => {
      var nome = c.nome || c, tipoCatVal = c.tipo || 'variavel';
      return '<div class="tag-item" style="gap:8px">'
        + '<span>' + esc(nome) + '</span>'
        + '<select onchange="setCatTipo(\'cc\',' + i + ',this.value)" style="background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.72rem;padding:2px 5px;border-radius:5px;outline:none">'
        + Object.entries(TIPOS_DRE).map(([k,v]) => '<option value="' + k + '"' + (tipoCatVal===k?' selected':'') + '>' + v + '</option>').join('')
        + '</select>'
        + '<button class="tag-del" onclick="deleteCategory(\'cc\',' + i + ')">✕</button>'
        + '</div>';
    }).join('');
  } else {
    tagHtml = (cats).map((c, i) => '<div class="tag-item">' + esc(c) + '<button class="tag-del" onclick="deleteCategory(\'cartao\',' + i + ')">✕</button></div>').join('');
  }

  var desc = tipo === 'cc'
    ? 'Categorias da <strong style="color:var(--text)">Conta Corrente</strong>. Defina o tipo para classificar corretamente no <strong style="color:var(--text)">DRE</strong>.'
    : 'Categorias dos lançamentos do <strong style="color:var(--text)">Cartão de Crédito</strong>. Entram como Despesa Variável no DRE.';

  document.getElementById(pid).innerHTML =
    '<p style="color:var(--muted);font-size:.83rem;margin-bottom:13px">' + desc + '</p>'
    + '<div class="tag-list" id="tagList-' + tipo + '">' + tagHtml + '</div>'
    + '<div class="tag-input-row">'
    + '<input type="text" id="newCatInput-' + tipo + '" placeholder="Nova categoria…" onkeydown="if(event.key===\'Enter\')addCategory(\'' + tipo + '\')"/>'
    + '<button onclick="addCategory(\'' + tipo + '\')">Adicionar</button>'
    + '</div>'
    + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">'
    + '<button class="btn-sm red" onclick="resetCategories(\'' + tipo + '\')">↺ Restaurar padrão</button>'
    + '</div>';
}

function setCatTipo(tipo, i, novoTipo) {
  var cats = loadCatsCC();
  if (!cats[i] || typeof cats[i] === 'string') cats[i] = { nome: cats[i] || '', tipo: novoTipo };
  else cats[i].tipo = novoTipo;
  saveCatsCC(cats);
}

function addCategory(tipo) {
  var inp = document.getElementById('newCatInput-' + tipo), val = inp.value.trim(); if (!val) return;
  if (tipo === 'cc') {
    var cats = loadCatsCC();
    if (cats.find(c => (c.nome||c) === val)) return alert('Categoria já existe.');
    cats.push({ nome: val, tipo: 'variavel' });
    saveCatsCC(cats);
  } else {
    var carts = loadCatsCartao();
    if (carts.includes(val)) return alert('Categoria já existe.');
    carts.push(val); saveCatsCartao(carts);
  }
  inp.value = ''; renderCatsPanel(tipo);
}

function deleteCategory(tipo, i) {
  if (tipo === 'cc') { var cats = loadCatsCC(); cats.splice(i,1); saveCatsCC(cats); }
  else { var carts = loadCatsCartao(); carts.splice(i,1); saveCatsCartao(carts); }
  renderCatsPanel(tipo);
}

function resetCategories(tipo) {
  if (!confirm('Restaurar categorias padrão?')) return;
  if (tipo === 'cc') saveCatsCC(DC_CC.map(c => ({...c})));
  else saveCatsCartao([...DC_CART]);
  renderCatsPanel(tipo);
}

function renderTemaPanel() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.getElementById('modal-panel-tema').innerHTML =
    '<div style="padding:4px 0">'
    + '<div class="theme-toggle-row">'
    + '<div class="ttr-info"><span>Tema escuro</span><small>Alterne entre tema escuro e claro</small></div>'
    + '<label class="toggle-switch">'
    + '<input type="checkbox" id="themeToggle" ' + (isDark ? 'checked' : '') + ' onchange="toggleTheme(this.checked)"/>'
    + '<span class="toggle-track"></span>'
    + '</label></div>'
    + '<div style="margin-top:14px;padding:12px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border)">'
    + '<p style="font-size:.82rem;color:var(--muted)">A preferência é salva automaticamente.</p>'
    + '</div></div>';
}

function toggleTheme(isDark) {
  var theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fb_theme', theme);
}
