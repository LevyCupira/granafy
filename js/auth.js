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
  if (authProfile && Number.isFinite(Number(authProfile.limite_clientes))) {
    return Number(authProfile.limite_clientes);
  }
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
  document.querySelectorAll('.auth-panel button').forEach(btn => {
    btn.disabled = !!isLoading;
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
    + '<p>Use seu e-mail e senha para acessar a gestão financeira.</p>'
    + '<div class="form-group auth-signup-only" style="display:none"><label>Nome completo</label><input id="auth-name" type="text" autocomplete="name" placeholder="Seu nome"/></div>'
    + '<div class="form-group auth-signup-only" style="display:none"><label>WhatsApp</label><input id="auth-phone" type="tel" autocomplete="tel" placeholder="(00) 00000-0000"/></div>'
    + '<div class="form-group"><label>E-mail</label><input id="auth-email" type="email" autocomplete="email" placeholder="voce@email.com"/></div>'
    + '<div class="form-group"><label>Senha</label><input id="auth-password" type="password" autocomplete="current-password" placeholder="Sua senha"/></div>'
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
  if (subtitle) subtitle.textContent = 'Informe seus dados para acessar o Granafy.';
  if (loginBtn) loginBtn.style.display = 'none';
  if (createBtn) createBtn.style.display = 'none';

  document.querySelectorAll('.auth-signup-only').forEach(el => {
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
    + '<div class="form-group"><label>Nova senha</label><input id="auth-new-password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres"/></div>'
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
    ? '<span>' + authEsc((authProfile && authProfile.nome) || authUser.email || 'Usuário conectado') + '</span>'
      + '<button type="button" onclick="logoutUsuario()">Sair</button>'
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
    email,
    nome: email,
    tipo_acesso: admin ? 'admin' : 'cliente',
    limite_clientes: admin ? 999999 : 1,
    status: 'ativo',
    telefone: null,
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

async function ensureAuthProfile(extra) {
  if (!authUser || !authUser.id) return null;

  var email = authUser.email || '';
  var metadata = authUser.user_metadata || {};
  var perfil = Object.assign(fallbackAuthProfile(), {
    nome: (extra && extra.nome) || metadata.nome || email,
    telefone: (extra && extra.telefone) || metadata.telefone || null
  });

  const { data: saved, error } = await supabaseClient
    .from('perfis')
    .upsert([perfil], { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    if (!isMissingProfileError(error)) console.warn('Nao foi possivel salvar perfil do usuario:', error);
    authProfile = perfil;
    return authProfile;
  }

  authProfile = saved || perfil;
  return authProfile;
}

async function loadAuthProfile() {
  authProfile = null;
  if (!authUser || !authUser.id) return null;

  const { data: perfil, error } = await supabaseClient
    .from('perfis')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    if (!isMissingProfileError(error)) console.warn('Nao foi possivel carregar perfil do usuario:', error);
    authProfile = fallbackAuthProfile();
    return authProfile;
  }

  if (perfil) {
    authProfile = perfil;
    return authProfile;
  }

  return ensureAuthProfile();
}

async function loadAuthProfileSafe() {
  try {
    return await Promise.race([
      loadAuthProfile(),
      new Promise(resolve => setTimeout(function() {
        authProfile = fallbackAuthProfile();
        resolve(authProfile);
      }, 3500))
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

  const saved = localStorage.getItem(activeClientStorageKey());
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

  setAuthLoading(true);
  setAuthMessage('Entrando...');

  const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  setAuthLoading(false);

  if (error) {
    setAuthMessage(error.message || 'Não foi possível entrar.', 'error');
    return;
  }

  authUser = authData.user;
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
}

async function criarUsuario() {
  var email = authEmail();
  var password = authPassword();

  if (!email || !password) {
    setAuthMessage('Informe e-mail e senha para criar o acesso.', 'error');
    return;
  }

  if (password.length < 6) {
    setAuthMessage('A senha precisa ter pelo menos 6 caracteres.', 'error');
    return;
  }

  var nome = authName();
  var telefone = authPhone();

  if (!nome) {
    setAuthMessage('Informe seu nome completo.', 'error');
    return;
  }

  setAuthLoading(true);
  setAuthMessage('Criando acesso...');

  const { data: authData, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
      data: {
        nome,
        telefone
      }
    }
  });

  setAuthLoading(false);

  if (error) {
    setAuthMessage(error.message || 'Não foi possível criar o acesso.', 'error');
    return;
  }

  if (authData.session && authData.user) {
    authUser = authData.user;
    await ensureAuthProfile({ nome, telefone });
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
}

async function enviarResetSenha() {
  var email = authEmail();

  if (!email) {
    setAuthMessage('Informe seu e-mail para receber o link de recuperação.', 'error');
    return;
  }

  setAuthLoading(true);
  setAuthMessage('Enviando link...');

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  setAuthLoading(false);

  if (error) {
    setAuthMessage(error.message || 'Não foi possível enviar o link.', 'error');
    return;
  }

  setAuthMessage('Link de recuperação enviado para seu e-mail.');
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

  const { error } = await supabaseClient.auth.updateUser({ password });

  setAuthLoading(false);

  if (error) {
    setAuthMessage(error.message || 'Não foi possível alterar a senha.', 'error');
    return;
  }

  setAuthMessage('Senha atualizada.');
  await refreshAppAfterAuth();
}

async function logoutUsuario() {
  const previousClientKey = activeClientStorageKey();
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

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData && sessionData.session && sessionData.session.user) {
    authUser = sessionData.session.user;
    await loadAuthProfileSafe();
    hideAuthScreen();
    renderAuthUser();
    return authUser;
  }

  renderAuthScreen();
  return new Promise(resolve => {
    _authResolver = function(user) {
      _authResolver = null;
      resolve(user);
    };
  });
}

supabaseClient.auth.onAuthStateChange(async function(_event, session) {
  authUser = session && session.user ? session.user : null;
  if (_event === 'PASSWORD_RECOVERY') {
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
  } else if (_event === 'SIGNED_OUT') {
    renderAuthScreen();
    renderAuthUser();
  }
});

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

    const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setAuthMessage(error.message || 'Nao foi possivel entrar.', 'error');
      return;
    }

    authUser = authData.user;
    authProfile = fallbackAuthProfile();
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
