const SUPABASE_URL = 'https://pjnnkaafrxruooplccnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hiH2CKVSf-he9QP_M3ByrQ_wXXbKZbf';

var supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
window.supabaseClient = supabaseClient;

async function testarConexao() {
  const { data, error } = await applyUserScope(
    supabaseClient
    .from('clientes')
    .select('*')
  );

  console.log('DATA:', data);
  console.log('ERROR:', error);
}
