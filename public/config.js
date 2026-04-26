export const SUPABASE_URL = 'https://gjrnaavkyalwolldexft.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_CPM-CH4JV3muBw_DrGk-zQ_Rii5iGU6';

const supabaseLib = globalThis.supabase;
if (!supabaseLib?.createClient) {
    throw new Error('Supabase JS não está disponível. Verifique o script no HTML antes de main.js.');
}
export const sb = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY);

/** Estado mutável compartilhado entre módulos */
export const appState = {
    idAtual: null,
    usuarioAtual: null,
    editResumoNode: null,
    editExpNode: null,
    editEscNode: null,
    editIdiNode: null,
    editHabNode: null,
    modoCriarConta: false,
    ultimasAlteracoesIA: '',
    analiseAtsAtual: null,
    sugestoesAtsEstruturadas: [],
    vagaOriginalAtual: '',
    vagaAnalisadaAtual: '',
    vagaVinculadaAtual: null,
    historicoProfissionalAlvoId: '',
    origemAtual: 'Criado do zero',
    historicoTelas: [],
    modeloIAPreferido: 'gemini-2.5-flash',
    modeloIAForcado: '',
    temAlteracoesNaoSalvas: false,
    passoTour: 0
};

export function normalizarSugestaoAtsEstruturada(sugestao) {
    if (!sugestao || typeof sugestao !== 'object') return null;

    return {
        tipo: String(sugestao.tipo || 'geral'),
        alvo: String(sugestao.alvo || 'curriculo'),
        descricao: String(sugestao.descricao || ''),
        prioridade: String(sugestao.prioridade || 'media'),
        aplicavel_automaticamente: Boolean(sugestao.aplicavel_automaticamente)
    };
}

export function atualizarSugestoesAtsEstruturadas(origem) {
    const sugestoes = Array.isArray(origem?.sugestoes_estruturadas)
        ? origem.sugestoes_estruturadas
        : [];

    appState.sugestoesAtsEstruturadas = sugestoes
        .map(normalizarSugestaoAtsEstruturada)
        .filter(item => item && item.descricao);

    return appState.sugestoesAtsEstruturadas;
}

export function limparSugestoesAtsEstruturadas() {
    appState.sugestoesAtsEstruturadas = [];
}

export function obterSugestoesAtsEstruturadas() {
    return appState.sugestoesAtsEstruturadas
        .map(normalizarSugestaoAtsEstruturada)
        .filter(item => item && item.descricao);
}

export const regexSenha = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const DEFAULT_PROMPT_SIMPLES = `Aja como especialista em currículos. Ajuste o currículo para a vaga com mudanças pequenas, preservando estrutura, fatos e experiências. Responda somente JSON válido no formato {"titulo_vaga":"","nome":"","endereco":"","cep":"","email":"","whatsapp":"","linkedin":"","resumo":"","experiencias":[{"cargo":"","empresa":"","ini":"","fim":"","desc":""}],"formacao":[{"curso":"","inst":"","ini":"","fim":""}],"idiomas":[{"nome":"","nivel":""}],"habilidades":[""],"email_envio_vaga":"","resumo_alteracoes":""}.`;

export const DEFAULT_PROMPT_AGRESSIVO = `Aja como especialista em recrutamento. Ajuste o currículo para maximizar aderência à vaga, preservando apenas fatos plausíveis do histórico informado. Responda somente JSON válido no formato {"titulo_vaga":"","nome":"","endereco":"","cep":"","email":"","whatsapp":"","linkedin":"","resumo":"","experiencias":[{"cargo":"","empresa":"","ini":"","fim":"","desc":""}],"formacao":[{"curso":"","inst":"","ini":"","fim":""}],"idiomas":[{"nome":"","nivel":""}],"habilidades":[""],"email_envio_vaga":"","resumo_alteracoes":""}.`;

export const DEFAULT_PROMPT_ATS = `Analise a aderência entre VAGA e CURRÍCULO. Responda somente JSON válido no formato {"pontos_fortes":[""],"pontos_medios":[""],"pontos_fracos":[""],"score":0,"risco":"","motivo_risco":"","sugestoes":[""],"sugestoes_estruturadas":[{"tipo":"","alvo":"","descricao":"","prioridade":"","aplicavel_automaticamente":false}]}. VAGA: {{VAGA}} CURRICULO: {{CURRICULO}}`;
export const DEFAULT_PROMPT_ATS_GERAL = `Analise a qualidade geral do currículo sem vaga específica. Responda somente JSON válido no formato {"pontos_fortes":[""],"pontos_medios":[""],"pontos_fracos":[""],"score":0,"risco":"","motivo_risco":"","sugestoes":[""],"sugestoes_estruturadas":[{"tipo":"","alvo":"","descricao":"","prioridade":"","aplicavel_automaticamente":false}]}. CURRICULO: {{CURRICULO}}`;
export const DEFAULT_PROMPT_APLICAR_AJUSTES = `Aplique ajustes do histórico profissional para a vaga, preservando fatos informados e retornando somente JSON válido no formato {"titulo_vaga":"","nome":"","endereco":"","cep":"","email":"","whatsapp":"","linkedin":"","resumo":"","experiencias":[{"cargo":"","empresa":"","ini":"","fim":"","desc":""}],"formacao":[{"curso":"","inst":"","ini":"","fim":""}],"idiomas":[{"nome":"","nivel":""}],"habilidades":[""],"email_envio_vaga":"","resumo_alteracoes":""}. HISTORICO: {{HISTORICO}} VAGA: {{VAGA}}`;

export const DEFAULT_PROMPT_VALIDAR_VAGA_IMPORTADA = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Motivo da reprovação"}. Texto: {{TEXTO_VAGA}}`;

export const DEFAULT_PROMPT_VALIDAR_VAGA_AJUSTE = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Explique resumidamente por que não parece uma vaga ativa"}. Texto: {{TEXTO_VAGA}}`;
export const DEFAULT_PROMPT_EXTRACAO = `Converta o histórico profissional em JSON. Responda somente JSON válido no formato {"nome":"","endereco":"","cep":"","email":"","whatsapp":"","linkedin":"","resumo":"texto","experiencias":[{"cargo":"","empresa":"","ini":"","fim":"","desc":""}],"formacao":[{"curso":"","inst":"","ini":"","status":""}],"idiomas":[{"nome":"","nivel":""}],"habilidades":[""]}. STATUS da formação deve ser "Concluído", "Cursando" ou "Trancado". TEXTO: {{TEXTO_BRUTO}}`;
export const DEFAULT_PROMPT_GERAR_CURRICULO_HISTORICO = `Gere um currículo estruturado a partir do histórico profissional informado. Responda somente JSON válido no formato {"nome":"","endereco":"","cep":"","email":"","whatsapp":"","linkedin":"","resumo":"","experiencias":[{"cargo":"","empresa":"","ini":"","fim":"","desc":""}],"formacao":[{"curso":"","inst":"","ini":"","fim":""}],"idiomas":[{"nome":"","nivel":""}],"habilidades":[""]}. HISTORICO: {{HISTORICO}}`;
export const DEFAULT_PROMPT_MELHORAR_RESUMO = `Reescreva o resumo profissional em português do Brasil, claro e objetivo, sem inventar fatos. Responda somente JSON válido no formato {"resumo":""}. TEXTO_BASE: {{RESUMO_BASE}}`;
export const DEFAULT_PROMPT_MELHORAR_RESUMO_POR_ALVO = `Reescreva o resumo profissional para o alvo informado, preservando fatos reais. Responda somente JSON válido no formato {"resumo":"","foco":""}. ALVO: {{ALVO}} RESUMO_BASE: {{RESUMO_BASE}}`;
export const DEFAULT_PROMPT_MELHORAR_EXPERIENCIA = `Reescreva a descrição da experiência em português do Brasil, clara e objetiva, sem inventar fatos. Responda somente JSON válido no formato {"descricao":""}. CARGO: {{CARGO}} EMPRESA: {{EMPRESA}} TEXTO_BASE: {{DESCRICAO_BASE}}`;
export const DEFAULT_PROMPT_REESCREVER_EXPERIENCIA_POR_VAGA = `Reescreva a experiência para a vaga alvo, preservando fatos reais. Responda somente JSON válido no formato {"descricao":"","palavras_chave":[""]}. CARGO: {{CARGO}} EMPRESA: {{EMPRESA}} VAGA: {{VAGA}} TEXTO_BASE: {{DESCRICAO_BASE}}`;

export const DEFAULT_PROMPTS_BY_NAME = {
    ajuste_simples: {
        label: 'Ajuste Simples',
        description: 'Prompt base do ajuste simples de currículo para vaga.',
        content: DEFAULT_PROMPT_SIMPLES
    },
    ajuste_agressivo: {
        label: 'Ajuste Agressivo',
        description: 'Prompt base do ajuste agressivo de currículo para vaga.',
        content: DEFAULT_PROMPT_AGRESSIVO
    },
    analise_ats: {
        label: 'Análise ATS',
        description: 'Prompt base para score ATS e análise de aderência.',
        content: DEFAULT_PROMPT_ATS
    },
    analise_ats_geral: {
        label: 'Análise ATS Geral',
        description: 'Análise geral do currículo sem vaga específica.',
        content: DEFAULT_PROMPT_ATS_GERAL
    },
    aplicar_ajustes: {
        label: 'Aplicar Ajustes',
        description: 'Gera a versão ajustada do currículo a partir do histórico e da vaga.',
        content: DEFAULT_PROMPT_APLICAR_AJUSTES
    },
    validar_vaga_importada: {
        label: 'Validação de Vaga Importada',
        description: 'Valida vagas capturadas externamente antes do uso no app.',
        content: DEFAULT_PROMPT_VALIDAR_VAGA_IMPORTADA
    },
    validar_vaga_ajuste: {
        label: 'Validação de Vaga para Ajuste',
        description: 'Valida a vaga colada manualmente antes de ajustar currículo.',
        content: DEFAULT_PROMPT_VALIDAR_VAGA_AJUSTE
    },
    extracao_texto_cv: {
        label: 'Extração de Texto em CV',
        description: 'Converte texto bruto de currículo/LinkedIn em JSON estruturado.',
        content: DEFAULT_PROMPT_EXTRACAO
    },
    gerar_curriculo_historico: {
        label: 'Gerar Currículo do Histórico',
        description: 'Monta um currículo estruturado a partir do histórico profissional.',
        content: DEFAULT_PROMPT_GERAR_CURRICULO_HISTORICO
    },
    melhorar_resumo: {
        label: 'Melhorar Resumo',
        description: 'Reescreve o resumo profissional com linguagem mais clara, profissional e objetiva.',
        content: DEFAULT_PROMPT_MELHORAR_RESUMO
    },
    melhorar_resumo_alvo: {
        label: 'Resumo por Alvo',
        description: 'Reescreve o resumo profissional com foco em um alvo específico.',
        content: DEFAULT_PROMPT_MELHORAR_RESUMO_POR_ALVO
    },
    melhorar_experiencia: {
        label: 'Melhorar Experiência',
        description: 'Reescreve a descrição de uma experiência profissional sem alterar os fatos informados.',
        content: DEFAULT_PROMPT_MELHORAR_EXPERIENCIA
    },
    reescrever_experiencia_vaga: {
        label: 'Experiência por Vaga',
        description: 'Reescreve uma experiência com foco em uma vaga específica, preservando fatos reais.',
        content: DEFAULT_PROMPT_REESCREVER_EXPERIENCIA_POR_VAGA
    }
};

export const tourTextos = [
    '<b>1. Cadastre seu Histórico Profissional</b><br><br>Comece criando um currículo manualmente ou importando um texto existente. O primeiro currículo salvo vira seu Cadastro de Histórico Profissional para os ajustes de vaga.',
    '<b>2. Capture ou cole a vaga</b><br><br>Use <b>Ajustar à Vaga</b> no app ou envie uma vaga pela extensão do Chrome. Se a vaga vier da extensão, o app valida o texto antes de usar.',
    '<b>3. Gere uma versão ajustada</b><br><br>Escolha seu Cadastro de Histórico Profissional, confira a vaga capturada e clique em gerar. O Edi Pro adapta o conteúdo e também cria uma análise ATS.',
    '<b>4. Salve, revise e exporte</b><br><br>Use <b>Salvar Cópia</b> para manter versões diferentes por vaga. Quando estiver pronto, gere o PDF e revise o resultado final.'
];

export const tourMenuPrincipal = [
    {
        targetId: 'btn-menu-novo-curriculo',
        title: '➕ Novo Currículo',
        text: 'Use este botão para começar um currículo do zero e preencher seus dados no editor.'
    },
    {
        targetId: 'btn-menu-revisao-curriculo',
        title: '✨ Revisão do Currículo',
        text: 'Aqui você revisa rapidamente seu currículo-base antes de editar ou exportar.'
    },
    {
        targetId: 'btn-menu-curriculos-salvos',
        title: '📂 Currículos Salvos',
        text: 'Abra seus currículos já salvos para continuar editando, duplicar ou definir um como seu Cadastro de Histórico Profissional principal.'
    },
    {
        targetId: 'btn-menu-analise-vaga',
        title: '🎯 Análise da Vaga',
        text: 'Entre neste fluxo para cruzar uma vaga com seu currículo-base e gerar uma versão ajustada.'
    }
];
