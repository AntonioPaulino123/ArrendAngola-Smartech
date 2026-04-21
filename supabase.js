// ============================================
// ARRENDANGOLA - CONEXÃO COM SUPABASE
// ============================================

// Configuração do Supabase
const SUPABASE_URL = 'https://zabaauxkksqeuazpfxwi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ES7PHsEz96dQ12gWJ8xihw_P8NeAfH5';

// Inicializar cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== FUNÇÕES DE USUÁRIO ==========

// Cadastrar novo usuário
async function cadastrarUsuario(nome, email, telefone, provincia, senha) {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .insert([
            {
                nome: nome,
                email: email,
                telefone: telefone,
                provincia: provincia,
                senha: senha
            }
        ])
        .select();

    if (error) {
        console.error('Erro no cadastro:', error);
        return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, usuario: data[0] };
}

// Fazer login
async function loginUsuario(email, senha) {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('senha', senha);

    if (error || data.length === 0) {
        console.error('Erro no login:', error);
        return { sucesso: false, erro: 'Email ou senha inválidos' };
    }

    // Salvar usuário na sessão
    sessionStorage.setItem('usuario', JSON.stringify(data[0]));
    return { sucesso: true, usuario: data[0] };
}

// Obter usuário logado
function getUsuarioLogado() {
    const usuario = sessionStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

// Logout
function logout() {
    sessionStorage.removeItem('usuario');
    window.location.href = 'index.html';
}

// ========== FUNÇÕES DE IMÓVEIS ==========

// Listar imóveis com filtros
async function listarImoveis(filtros = {}) {
    let query = supabaseClient
        .from('imoveis')
        .select('*, usuarios(nome, avaliacao_media)')
        .eq('status', 'ativo');

    // Aplicar filtros
    if (filtros.provincia && filtros.provincia !== 'Todas') {
        query = query.eq('provincia', filtros.provincia);
    }
    if (filtros.tipo_negocio && filtros.tipo_negocio !== 'Todos') {
        query = query.eq('tipo_negocio', filtros.tipo_negocio);
    }
    if (filtros.preco_min) {
        query = query.gte('preco', parseFloat(filtros.preco_min));
    }
    if (filtros.preco_max) {
        query = query.lte('preco', parseFloat(filtros.preco_max));
    }

    // Ordenação
    if (filtros.ordenar === 'preco_asc') {
        query = query.order('preco', { ascending: true });
    } else if (filtros.ordenar === 'preco_desc') {
        query = query.order('preco', { ascending: false });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao listar imóveis:', error);
        return [];
    }

    // Buscar fotos para cada imóvel
    for (let imovel of data) {
        const { data: fotos } = await supabaseClient
            .from('fotos')
            .select('url')
            .eq('imovel_id', imovel.id);
        imovel.fotos = fotos || [];
    }

    return data;
}

// Buscar imóvel por ID
async function buscarImovelPorId(id) {
    const { data, error } = await supabaseClient
        .from('imoveis')
        .select('*, usuarios(nome, telefone, avaliacao_media)')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Erro ao buscar imóvel:', error);
        return null;
    }

    // Buscar fotos
    const { data: fotos } = await supabaseClient
        .from('fotos')
        .select('url')
        .eq('imovel_id', id);
    data.fotos = fotos || [];

    // Buscar avaliações
    const { data: avaliacoes } = await supabaseClient
        .from('avaliacoes')
        .select('*, usuarios(nome)')
        .eq('imovel_id', id);
    data.avaliacoes = avaliacoes || [];

    // Incrementar views
    await supabaseClient
        .from('imoveis')
        .update({ views: supabaseClient.rpc('increment', { row_id: id }) });

    return data;
}

// Publicar imóvel
async function publicarImovel(imovel) {
    const usuario = getUsuarioLogado();
    if (!usuario) {
        return { sucesso: false, erro: 'Faça login para publicar' };
    }

    const { data, error } = await supabaseClient
        .from('imoveis')
        .insert([
            {
                tipo_negocio: imovel.tipo_negocio,
                preco: imovel.preco,
                provincia: imovel.provincia,
                bairro: imovel.bairro,
                descricao: imovel.descricao,
                telefone_contato: imovel.telefone_contato,
                usuario_id: usuario.id
            }
        ])
        .select();

    if (error) {
        console.error('Erro ao publicar:', error);
        return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, imovel: data[0] };
}

// Salvar favorito
async function favoritarImovel(imovelId) {
    const usuario = getUsuarioLogado();
    if (!usuario) {
        return { sucesso: false, erro: 'Faça login para favoritar' };
    }

    const { error } = await supabaseClient
        .from('favoritos')
        .insert([
            { usuario_id: usuario.id, imovel_id: imovelId }
        ]);

    if (error) {
        return { sucesso: false, erro: error.message };
    }
    return { sucesso: true };
}

// ========== FUNÇÕES DE AVALIAÇÕES ==========

// Avaliar usuário (proprietário/inquilino)
async function avaliarUsuario(imovelId, avaliadoId, nota, comentario) {
    const usuario = getUsuarioLogado();
    if (!usuario) {
        return { sucesso: false, erro: 'Faça login para avaliar' };
    }

    const { error } = await supabaseClient
        .from('avaliacoes')
        .insert([
            {
                imovel_id: imovelId,
                avaliador_id: usuario.id,
                avaliado_id: avaliadoId,
                nota: nota,
                comentario: comentario
            }
        ]);

    if (error) {
        return { sucesso: false, erro: error.message };
    }

    // Atualizar média do usuário avaliado
    await atualizarMediaAvaliacao(avaliadoId);

    return { sucesso: true };
}

// Atualizar média de avaliações de um usuário
async function atualizarMediaAvaliacao(usuarioId) {
    const { data } = await supabaseClient
        .from('avaliacoes')
        .select('nota')
        .eq('avaliado_id', usuarioId);

    if (data && data.length > 0) {
        const media = data.reduce((sum, item) => sum + item.nota, 0) / data.length;
        await supabaseClient
            .from('usuarios')
            .update({ avaliacao_media: media })
            .eq('id', usuarioId);
    }
}

// ========== FUNÇÕES DE UPLOAD ==========

// Upload de foto (para usar depois)
async function uploadFoto(arquivo, pasta = 'imoveis') {
    const nomeArquivo = `${Date.now()}_${arquivo.name}`;
    const caminho = `${pasta}/${nomeArquivo}`;

    const { data, error } = await supabaseClient.storage
        .from('imagens')
        .upload(caminho, arquivo);

    if (error) {
        console.error('Erro no upload:', error);
        return null;
    }

    // Obter URL pública
    const { data: urlData } = supabaseClient.storage
        .from('imagens')
        .getPublicUrl(caminho);

    return urlData.publicUrl;
}