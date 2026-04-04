const SUPABASE_URL = 'https://pjnnkaafrxruooplccnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hiH2CKVSf-he9QP_M3ByrQ_wXXbKZbf';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function testarConexao() {
  const { data, error } = await supabaseClient
    .from('clientes')
    .select('*');

  console.log('DATA:', data);
  console.log('ERROR:', error);
}

testarConexao();