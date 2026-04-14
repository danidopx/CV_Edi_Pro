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

export const DEFAULT_PROMPT_SIMPLES = `Você é um especialista em RH. Ajuste o currículo sutilmente. MANTENHA a estrutura e experiências. Retorne APENAS um objeto JSON válido. Formato EXATO: { "titulo_vaga": "Nome", "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "fim":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill"], "email_envio_vaga": "extraia o e-mail para envio de currículo se houver na vaga, senao vazio", "resumo_alteracoes": "O que você focou e melhorou" }`;

export const DEFAULT_PROMPT_AGRESSIVO = `Você é um especialista em recrutamento. Ajuste o currículo para ter o MAIOR MATCH POSSÍVEL. Seja agressivo no resumo. Retorne APENAS um objeto JSON válido. Formato EXATO: { "titulo_vaga": "Nome", "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "fim":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill"], "email_envio_vaga": "extraia o e-mail para envio de currículo se houver na vaga, senao vazio", "resumo_alteracoes": "O que você focou, cortou ou adicionou" }`;

export const DEFAULT_PROMPT_ATS = `Você é um sistema de triagem de currículos baseado em ATS (Applicant Tracking System) com análise complementar de recrutador humano.
Sua tarefa é analisar a compatibilidade entre uma VAGA e o CURRÍCULO AJUSTADO.
Considere critérios reais utilizados por plataformas como InfoJobs, Indeed e Glassdoor: Palavras-chave, Experiência relevante, Clareza e Aderência geral ao cargo.

ETAPA 1 — Extração da vaga Identifique Cargo principal, responsabilidades, requisitos obrigatórios e palavras-chave.
ETAPA 2 — Extração do currículo Identifique Experiências, tempo de exp, hard skills, soft skills.
ETAPA 3 — Análise de compatibilidade Compare vaga vs currículo e defina Pontos Fortes, Pontos Médios e Pontos Fracos (Gaps).
ETAPA 4 — Score geral Dê uma nota de 0 a 100 baseada na aderência.
ETAPA 5 — Risco de eliminação automática Informe: Alto / Médio / Baixo.
ETAPA 6 — Sugestões práticas de melhoria Diga exatamente o que ajustar no currículo (se necessário).

IMPORTANTE: Retorne APENAS um objeto JSON válido. NÃO use markdown ou blocos de código (\`\`\`json).
Formato EXATO obrigatório:
{
  "pontos_fortes": ["Ponto 1"],
  "pontos_medios": ["Ponto 1"],
  "pontos_fracos": ["Ponto 1"],
  "score": 85,
  "risco": "Baixo",
  "motivo_risco": "Breve explicação",
  "sugestoes": ["Sugestão 1"]
}

[VAGA] {{VAGA}} [CURRÍCULO] {{CURRICULO}}`;

export const DEFAULT_PROMPT_VALIDAR_VAGA_IMPORTADA = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Motivo da reprovação"}. Texto: {{TEXTO_VAGA}}`;

export const DEFAULT_PROMPT_VALIDAR_VAGA_AJUSTE = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Explique resumidamente por que não parece uma vaga ativa"}. Texto: {{TEXTO_VAGA}}`;

export const DEFAULT_PROMPT_EXTRACAO = `Aja como conversor estrito de texto para JSON. Formato obrigatório: { "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "texto", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "status":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill1"] } STATUS FORMAÇÃO: Obrigatório retornar um dos: "Concluído", "Cursando", "Trancado". Texto: {{TEXTO_BRUTO}}`;
export const DEFAULT_PROMPT_MELHORAR_RESUMO = `Você é um especialista em currículos. Reescreva o resumo profissional abaixo em português do Brasil, com linguagem clara, profissional e objetiva. Preserve os fatos informados, sem inventar experiências, cargos, empresas ou resultados. Responda somente JSON válido no formato {"resumo":"texto revisado"}. Texto base: {{RESUMO_BASE}}`;
export const DEFAULT_PROMPT_MELHORAR_EXPERIENCIA = `Você é um especialista em currículos. Reescreva a descrição de experiência abaixo em português do Brasil, com linguagem clara, profissional e objetiva. Preserve os fatos informados, sem inventar responsabilidades, sistemas, empresas, cargos ou resultados não mencionados. Responda somente JSON válido no formato {"descricao":"texto revisado"}. Cargo: {{CARGO}}. Empresa: {{EMPRESA}}. Descrição atual: {{DESCRICAO_BASE}}`;

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
    melhorar_resumo: {
        label: 'Melhorar Resumo',
        description: 'Reescreve o resumo profissional com linguagem mais clara, profissional e objetiva.',
        content: DEFAULT_PROMPT_MELHORAR_RESUMO
    },
    melhorar_experiencia: {
        label: 'Melhorar Experiência',
        description: 'Reescreve a descrição de uma experiência profissional sem alterar os fatos informados.',
        content: DEFAULT_PROMPT_MELHORAR_EXPERIENCIA
    }
};

export const tourTextos = [
    '<b>1. Cadastre seu currículo base</b><br><br>Comece criando um currículo manualmente ou importando um texto existente. O primeiro currículo salvo vira sua base para os ajustes de vaga.',
    '<b>2. Capture ou cole a vaga</b><br><br>Use <b>Ajustar à Vaga</b> no app ou envie uma vaga pela extensão do Chrome. Se a vaga vier da extensão, o app valida o texto antes de usar.',
    '<b>3. Gere uma versão ajustada</b><br><br>Escolha o currículo base, confira a vaga capturada e clique em gerar. O Edi Pro adapta o conteúdo e também cria uma análise ATS.',
    '<b>4. Salve, revise e exporte</b><br><br>Use <b>Salvar Cópia</b> para manter versões diferentes por vaga. Quando estiver pronto, gere o PDF e revise o resultado final.'
];
