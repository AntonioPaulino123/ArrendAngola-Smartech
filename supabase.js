// Configuração do Supabase
const SUPABASE_URL = 'https://zabaauxkksqeuazpfxwi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ES7PHsEz96dQ12gWJ8xihw_P8NeAfH5';

// Inicializar cliente
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função de cadastro simplificada
async function cadastrarUsuario(nome, email, telefone, provincia, senha) {
    try {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .insert([{ nome, email, telefone, provincia, senha }])
            .select();
        
        if (error) return { sucesso: false, erro: error.message };
        return { sucesso: true, usuario: data[0] };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
}

// Função de login simplificada
async function loginUsuario(email, senha) {
    try {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .eq('senha', senha);
        
        if (error || !data || data.length === 0) {
            return { sucesso: false, erro: 'Email ou senha inválidos' };
        }
        
        sessionStorage.setItem('usuario', JSON.stringify(data[0]));
        return { sucesso: true, usuario: data[0] };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
}

// Função para pegar usuário logado
function getUsuarioLogado() {
    const usuario = sessionStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

// Função de logout
function logout() {
    sessionStorage.removeItem('usuario');
    window.location.href = 'index.html';
}

// Função para publicar imóvel
async function publicarImovel(imovel) {
    const usuario = getUsuarioLogado();
    if (!usuario) return { sucesso: false, erro: 'Faça login primeiro' };
    
    try {
        const { data, error } = await supabaseClient
            .from('imoveis')
            .insert([{
                tipo_negocio: imovel.tipo_negocio,
                preco: imovel.preco,
                provincia: imovel.provincia,
                bairro: imovel.bairro,
                descricao: imovel.descricao,
                telefone_contato: imovel.telefone_contato,
                usuario_id: usuario.id,
                status: 'ativo'
            }])
            .select();
        
        if (error) return { sucesso: false, erro: error.message };
        return { sucesso: true, imovel: data[0] };
    } catch (erro) {
        return { sucesso: false, erro: erro.message };
    }
}

// Função para listar imóveis
async function listarImoveis() {
    try {
        const { data, error } = await supabaseClient
            .from('imoveis')
            .select('*, usuarios(nome)')
            .eq('status', 'ativo')
            .order('created_at', { ascending: false });
        
        if (error) return [];
        return data || [];
    } catch (erro) {
        return [];
    }
}
