var authUser = null;
var authProfile = null;
var _authResolver = null;
var userScopeEnabled = true;
var ADMIN_EMAIL = 'levy_lima@icloud.com';

function authEsc(value) {
  return String(value || '').replace(/[&<>"']/g, function(match) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[match];
  });
}

function authEmail() {
  var el = document.getElementById('auth-email');
  return el ? el.value.trim() : '';
}

function authPassword() {
  var el = document.getElementById('auth-password');
  return el ? el.value : '';
}

function authName() {
  var el = document.getElementById('auth-name');
  return el ? el.value.trim() : '';
}

function authPhone() {
  var el = document.getElementById('auth-phone');
  return el ? el.value.trim() : '';
}

function authUsageType() {
  var el = document.getElementById('auth-usage-type');
  return el ? el.value.trim() : 'pf';
}

function authDocument() {
  var el = document.getElementById('auth-document');
  return el ? el.value.trim() : '';
}

function authCompany() {
  var el = document.getElementById('auth-company');
  return el ? el.value.trim() : '';
}

function authTermsAccepted() {
  var el = document.getElementById('auth-terms');
  return !!(el && el.checked);
}

function currentUserId() {
  return authUser && authUser.id ? authUser.id : null;
}

function activeClientStorageKey() {
  return 'fb_activeClient_' + (currentUserId() || 'anon');
}

function isAdminUser() {
  if (authProfile && authProfile.tipo_acesso === 'admin') return true;
  return !!(authUser && authUser.email && authUser.email.toLowerCase() === ADMIN_EMAIL);
}

function getClientLimit() {
  if (isAdminUser()) return Infinity;
  if (authProfile && Number.isFinite(Number(authProfile.limite_clientes))) return Number(authProfile.limite_clientes);
  return 1;
}

function isBlockedUser() {
  return !!(authProfile && authProfile.status && authProfile.status !== 'ativo');
}

function isOwnClient(clientId) {
  var c = data && data.clients ? data.clients[clientId] : null;
  return !c || !c.userId || c.userId === currentUserId();
}

function canEditActiveClient() {
  return !!activeClient && isOwnClient(activeClient);
}

function isMissingUserScopeError(error) {
  if (!error) return false;
  var msg = ((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return msg.includes('user_id') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column'));
}

function setUserScopeEnabled(enabled) {
  userScopeEnabled = !!enabled;
}

function getUserScopePayload() {
  return userScopeEnabled ? { user_id: currentUserId() } : {};
}

function applyUserScope(query) {
  return userScopeEnabled ? query.eq('user_id', currentUserId()) : query;
}

function statusSegurancaUsuario() {
  return {
    usuario: authUser ? authUser.email : null,
    userId: currentUserId(),
    perfil: authProfile,
    isolamentoPorUsuario: userScopeEnabled ? 'ativo' : 'modo compatibilidade'
  };
}

function setAuthMessage(message, type) {
  var el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = message || '';
  el.className = type === 'error' ? 'auth-message error' : 'auth-message';
}

function setAuthLoading(isLoading) {
  document.querySelectorAll('.auth-panel button, .auth-panel input, .auth-panel select').forEach(function(el) {
    el.disabled = !!isLoading;
  });
}

function supabaseAuthReady() {
  if (window.supabaseClient && window.supabaseClient.auth) return true;
  setAuthMessage('Nao foi possivel carregar o Supabase. Recarregue a pagina com Ctrl + F5.', 'error');
  return false;
}

function renderAuthScreen() {
  renderAuthUser();
  var root = document.getElementById('auth-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'auth-root';
    document.body.appendChild(root);
  }

  root.innerHTML =
    '<section class="auth-screen">'
      + '<div class="auth-panel">'
        + '<div class="auth-brand">Granafy</div>'
        + '<h1 id="auth-title">Entrar</h1>'
        + '<p id="auth-subtitle">Use seu e-mail e senha para acessar a gestao financeira.</p>'
        + '<div class="form-group auth-signup-only" style="display:none"><label>Nome completo</label><input id="auth-name" type="text" autocomplete="name" placeholder="Seu nome"/></div>'
        + '<div class="form-group auth-signup-only" style="display:none"><label>WhatsApp</label><input id="auth-phone" type="tel" autocomplete="tel" placeholder="(00) 00000-0000"/></div>'
        + '<div class="form-group auth-signup-only" style="display:none"><label>Perfil de uso</label><select id="auth-usage-type"><option value="pf">Pessoa fisica</option><option value="pj">Pessoa juridica</option><option value="consultor">Consultor / escritorio</option></select></div>'
        + '<div class="form-group auth-signup-only" style="display:none"><label>CPF ou CNPJ</label><input id="auth-document" type="text" autocomplete="off" placeholder="Documento principal"/></div>'
        + '<div class="form-group auth-signup-only" style="display:none"><label>Empresa ou razao social</label><input id="auth-company" type="text" autocomplete="organization" placeholder="Obrigatorio para PJ/consultor"/></div>'
        + '<div class="form-group"><label>E-mail</label><input id="auth-email" type="email" autocomplete="email" placeholder="voce@email.com"/></div>'
        + '<div class="form-group"><label>Senha</label><input id="auth-password" type="password" autocomplete="current-password" placeholder="Sua senha"/></div>'
        + '<label class="auth-check auth-signup-only" style="display:none"><input id="auth-terms" type="checkbox"/>Confirmo que li e aceito os termos de uso e politica de privacidade.</label>'
        + '<div id="auth-message" class="auth-message"></div>'
        + '<button class="auth-primary" onclick="loginUsuario()">Entrar</button>'
        + '<button class="auth-secondary" id="auth-create-btn" onclick="mostrarCadastro()">Criar acesso</button>'
        + '<button class="auth-secondary auth-signup-only" style="display:none" onclick="criarUsuario()">Salvar cadastro</button>'
        + '<button class="auth-link auth-signup-only" style="display:none" onclick="mostrarLogin()">Voltar para entrar</button>'
        + '<button class="auth-link" onclick="enviarResetSenha()">Esqueci minha senha</button>'
      + '</div>'
    + '</section>';

  document.body.classList.add('auth-locked');

  var password = document.getElementById('auth-password');
  if (password) {
    password.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') loginUsuario();
    });
  }
}

function mostrarCadastro() {
  var title = document.getElementById('auth-title');
  var subtitle = document.getElementById('auth-subtitle');
  var loginBtn = document.querySelector('.auth-primary');
  var createBtn = document.getElementById('auth-create-btn');

  if (title) title.textContent = 'Criar acesso';
  if (subtitle) subtitle.textContent = 'Cadastre o responsavel pela conta para acessar o Granafy com mais seguranca.';
  if (loginBtn) loginBtn.style.display = 'none';
  if (createBtn) createBtn.style.display = 'none';

  document.querySelectorAll('.auth-signup-only').forEach(function(el) {
    el.style.display = el.classList.contains('form-group') ? 'flex' : 'block';
  });

  setAuthMessage('');
}

function mostrarLogin() {
  renderAuthScreen();
}

function renderNewPasswordScreen() {
  var root = document.getElementById('auth-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'auth-root';
    document.body.appendChild(root);
  }

  root.innerHTML =
    '<section class="auth-screen">'
      + '<div class="auth-panel">'
        + '<div class="auth-brand">Granafy</div>'
        + '<h1>Nova senha</h1>'
        + '<p>Digite uma nova senha para continuar.</p>'
        + '<div class="form-group"><label>Nova senha</label><input id="auth-new-password" type="password" autocomplete="new-password" placeholder="Minimo 6 caracteres"/></div>'
        + '<div id="auth-message" class="auth-message"></div>'
        + '<button class="auth-primary" onclick="atualizarSenha()">Salvar nova senha</button>'
      + '</div>'
    + '</section>';

  document.body.classList.add('auth-locked');
}

function hideAuthScreen() {
  var root = document.getElementById('auth-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('auth-locked');
}

function renderAuthUser() {
  var box = document.getElementById('auth-user-box');
  if (!box) {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    box = document.createElement('div');
    box.id = 'auth-user-box';
    box.className = 'auth-user-box';
    nav.appendChild(box);
  }

  box.innerHTML = authUser
    ? '<span>' + authEsc((authProfile && authProfile.nome) || authUser.email || 'Usuario conectado') + '</span><button type="button" onclick="logoutUsuario()">Sair</button>'
    : '<span>Sem login</span><button type="button" onclick="forcarLogin()">Entrar</button>';
}

async function forcarLogin() {
  await supabaseClient.auth.signOut();
  authUser = null;
  authProfile = null;
  activeClient = null;
  if (typeof clearActiveClientView === 'function') clearActiveClientView();
  renderAuthScreen();
  renderAuthUser();
}

function fallbackAuthProfile() {
  var email = authUser && authUser.email ? authUser.email : '';
  var admin = email.toLowerCase() === ADMIN_EMAIL;
  return {
    id: currentUserId(),
    email: email,
    nome: email,
    tipo_acesso: admin ? 'admin' : 'cliente',
    limite_clientes: admin ? 999999 : 1,
    status: 'ativo',
    telefone: null,
    empresa: null,
    documento: null,
    perfil_uso: 'pf',
    aceitou_termos_em: null,
    plano: admin ? 'admin' : 'gratuito',
    origem_cadastro: null,
    responsavel_atendimento: null,
    observacoes: null
  };
}

function isMissingProfileError(error) {
  var msg = ((error && error.message) || '').toLowerCase();
  return msg.includes('perfis') || msg.includes('schema cache') || msg.includes('does not exist');
}

function isMissingEnhancedProfileError(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return msg.includes('perfil_uso') || msg.includes('aceitou_termos_em');
}

async function saveAuthProfilePayload(perfil) {
  var response = await supabaseClient
    .from('perfis')
    .upsert([perfil], { onConflict: 'id' })
    .select()
    .single();

  if (!response.error || !isMissingEnhancedProfileError(response.error)) return response;

  var fallbackPerfil = Object.assign({}, perfil);
  delete fallbackPerfil.perfil_uso;
  delete fallbackPerfil.aceitou_termos_em;

  return supabaseClient
    .from('perfis')
    .upsert([fallbackPerfil], { onConflict: 'id' })
    .select()
    .single();
}

async function ensureAuthProfile(extra) {
  if (!authUser || !authUser.id) return null;

  var email = authUser.email || '';
  var metadata = authUser.user_metadata || {};
  var perfil = Object.assign(fallbackAuthProfile(), {
    nome: (extra && extra.nome) || metadata.nome || email,
    telefone: (extra && extra.telefone) || metadata.telefone || null,
    empresa: (extra && extra.empresa) || metadata.empresa || null,
    documento: (extra && extra.documento) || metadata.documento || null,
    perfil_uso: (extra && extra.perfil_uso) || metadata.perfil_uso || 'pf',
    aceitou_termos_em: (extra && extra.aceitou_termos_em) || metadata.aceitou_termos_em || null
  });

  var response = await saveAuthProfilePayload(perfil);
  if (response.error) {
    if (!isMissingProfileError(response.error)) console.warn('Nao foi possivel salvar perfil do usuario:', response.error);
    authProfile = perfil;
    return authProfile;
  }

  authProfile = response.data || perfil;
  return authProfile;
}

async function loadAuthProfile() {
  authProfile = null;
  if (!authUser || !authUser.id) return null;

  var response = await supabaseClient
    .from('perfis')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (response.error) {
    if (!isMissingProfileError(response.error)) console.warn('Nao foi possivel carregar perfil do usuario:', response.error);
    authProfile = fallbackAuthProfile();
    return authProfile;
  }

  if (response.data) {
    authProfile = response.data;
    return authProfile;
  }

  return ensureAuthProfile();
}

async function loadAuthProfileSafe() {
  try {
    return await Promise.race([
      loadAuthProfile(),
      new Promise(function(resolve) {
        setTimeout(function() {
          authProfile = fallbackAuthProfile();
          resolve(authProfile);
        }, 3500);
      })
    ]);
  } catch (err) {
    console.warn('Perfil indisponivel. Usando perfil temporario:', err);
    authProfile = fallbackAuthProfile();
    return authProfile;
  }
}

async function refreshAppAfterAuth() {
  if (typeof loadData !== 'function') return;

  await loadAuthProfileSafe();
  if (isBlockedUser()) {
    alert('Seu acesso esta bloqueado. Fale com o administrador.');
    await logoutUsuario();
    return;
  }

  activeClient = null;
  await loadData();
  if (typeof renderTabs === 'function') renderTabs();
  if (typeof renderClientList === 'function') renderClientList();

  var saved = localStorage.getItem(activeClientStorageKey());
  if (saved && data.clients[saved] && typeof selectClient === 'function') {
    selectClient(saved);
  } else if (typeof clearActiveClientView === 'function') {
    localStorage.removeItem(activeClientStorageKey());
    clearActiveClientView();
  } else if (typeof renderTab === 'function') {
    renderTab(activeTab || 'cartao');
  }
}

async function loginUsuario() {
  var email = authEmail();
  var password = authPassword();

  if (!email || !password) {
    setAuthMessage('Informe e-mail e senha.', 'error');
    return;
  }

  if (!supabaseAuthReady()) return;

  try {
    setAuthLoading(true);
    setAuthMessage('Entrando...');

    var response = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (response.error) {
      setAuthMessage(response.error.message || 'Nao foi possivel entrar.', 'error');
      return;
    }

    authUser = response.data.user;
    await loadAuthProfileSafe();
    if (isBlockedUser()) {
      setAuthMessage('Seu acesso esta bloqueado. Fale com o administrador.', 'error');
      await supabaseClient.auth.signOut();
      authUser = null;
      return;
    }

    hideAuthScreen();
    renderAuthUser();

    if (_authResolver) {
      _authResolver(authUser);
      _authResolver = null;
    } else {
      await refreshAppAfterAuth();
    }
  } catch (err) {
    console.error('Erro inesperado no login:', err);
    setAuthMessage(err.message || 'Erro inesperado ao entrar.', 'error');
  } finally {
    setAuthLoading(false);
  }
}

async function criarUsuario() {
  var email = authEmail();
  var password = authPassword();
  var nome = authName();
  var telefone = authPhone();
  var perfilUso = authUsageType();
  var documento = authDocument();
  var empresa = authCompany();

  if (!email || !password) {
    setAuthMessage('Informe e-mail e senha para criar o acesso.', 'error');
    return;
  }
  if (password.length < 6) {
    setAuthMessage('A senha precisa ter pelo menos 6 caracteres.', 'error');
    return;
  }
  if (!nome) {
    setAuthMessage('Informe seu nome completo.', 'error');
    return;
  }
  if (!telefone) {
    setAuthMessage('Informe o WhatsApp do responsavel.', 'error');
    return;
  }
  if (!documento) {
    setAuthMessage('Informe o CPF ou CNPJ principal do cadastro.', 'error');
    return;
  }
  if ((perfilUso === 'pj' || perfilUso === 'consultor') && !empresa) {
    setAuthMessage('Informe a empresa ou razao social para este perfil.', 'error');
    return;
  }
  if (!authTermsAccepted()) {
    setAuthMessage('Confirme os termos para concluir o cadastro.', 'error');
    return;
  }

  if (!supabaseAuthReady()) return;

  try {
    setAuthLoading(true);
    setAuthMessage('Criando acesso...');

    var acceptedAt = new Date().toISOString();
    var response = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        data: {
          nome: nome,
          telefone: telefone,
          perfil_uso: perfilUso,
          documento: documento,
          empresa: empresa || null,
          aceitou_termos_em: acceptedAt
        }
      }
    });

    if (response.error) {
      setAuthMessage(response.error.message || 'Nao foi possivel criar o acesso.', 'error');
      return;
    }

    if (response.data.session && response.data.user) {
      authUser = response.data.user;
      await ensureAuthProfile({
        nome: nome,
        telefone: telefone,
        perfil_uso: perfilUso,
        documento: documento,
        empresa: empresa || null,
        aceitou_termos_em: acceptedAt
      });
      hideAuthScreen();
      renderAuthUser();
      if (_authResolver) {
        _authResolver(authUser);
        _authResolver = null;
      } else {
        await refreshAppAfterAuth();
      }
      return;
    }

    setAuthMessage('Acesso criado. Confirme seu e-mail antes de entrar.');
  } catch (err) {
    console.error('Erro ao criar acesso:', err);
    setAuthMessage(err.message || 'Erro inesperado ao criar o acesso.', 'error');
  } finally {
    setAuthLoading(false);
  }
}

async function enviarResetSenha() {
  var email = authEmail();

  if (!email) {
    setAuthMessage('Informe seu e-mail para receber o link de recuperacao.', 'error');
    return;
  }

  setAuthLoading(true);
  setAuthMessage('Enviando link...');

  var response = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  setAuthLoading(false);

  if (response.error) {
    setAuthMessage(response.error.message || 'Nao foi possivel enviar o link.', 'error');
    return;
  }

  setAuthMessage('Link de recuperacao enviado para seu e-mail.');
}

async function atualizarSenha() {
  var input = document.getElementById('auth-new-password');
  var password = input ? input.value : '';

  if (!password || password.length < 6) {
    setAuthMessage('A senha precisa ter pelo menos 6 caracteres.', 'error');
    return;
  }

  setAuthLoading(true);
  setAuthMessage('Salvando senha...');

  var response = await supabaseClient.auth.updateUser({ password: password });

  setAuthLoading(false);

  if (response.error) {
    setAuthMessage(response.error.message || 'Nao foi possivel alterar a senha.', 'error');
    return;
  }

  setAuthMessage('Senha atualizada.');
  await refreshAppAfterAuth();
}

async function logoutUsuario() {
  var previousClientKey = activeClientStorageKey();
  await supabaseClient.auth.signOut();
  authUser = null;
  authProfile = null;
  localStorage.removeItem('fb_activeClient');
  localStorage.removeItem(previousClientKey);
  activeClient = null;
  if (typeof clearActiveClientView === 'function') clearActiveClientView();
  renderAuthScreen();
  renderAuthUser();
}

async function requireAuthSession() {
  renderAuthScreen();

  var sessionData = await supabaseClient.auth.getSession();
  if (sessionData.data && sessionData.data.session && sessionData.data.session.user) {
    authUser = sessionData.data.session.user;
    await loadAuthProfileSafe();
    hideAuthScreen();
    renderAuthUser();
    return authUser;
  }

  renderAuthScreen();
  return new Promise(function(resolve) {
    _authResolver = function(user) {
      _authResolver = null;
      resolve(user);
    };
  });
}

supabaseClient.auth.onAuthStateChange(async function(eventName, session) {
  authUser = session && session.user ? session.user : null;
  if (eventName === 'PASSWORD_RECOVERY') {
    renderNewPasswordScreen();
    return;
  }

  if (authUser) {
    await loadAuthProfileSafe();
    hideAuthScreen();
    renderAuthUser();
    if (_authResolver) {
      _authResolver(authUser);
      _authResolver = null;
    }
  } else if (eventName === 'SIGNED_OUT') {
    renderAuthScreen();
    renderAuthUser();
  }
});
