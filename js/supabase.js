const SUPABASE_URL = 'https://pjnnkaafrxruooplccnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hiH2CKVSf-he9QP_M3ByrQ_wXXbKZbf';
const GRANAFY_PUBLIC_URL = 'https://levycupira.github.io/granafy/';

var supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
window.supabaseClient = supabaseClient;
window.GRANAFY_PUBLIC_URL = GRANAFY_PUBLIC_URL;

function getGranafyAppUrl() {
  var configured = String(window.GRANAFY_PUBLIC_URL || GRANAFY_PUBLIC_URL || '').trim();
  var current = window.location.origin + window.location.pathname;
  var host = String(window.location.hostname || '').toLowerCase();
  var isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (configured) {
    if (isLocalHost) return configured;
    try {
      var configuredUrl = new URL(configured);
      if (configuredUrl.origin !== window.location.origin) return configured;
    } catch (e) {}
  }

  return current;
}

window.getGranafyAppUrl = getGranafyAppUrl;

async function testarConexao() {
  const { data, error } = await applyUserScope(
    supabaseClient
    .from('clientes')
    .select('*')
  );

  console.log('DATA:', data);
  console.log('ERROR:', error);
}
