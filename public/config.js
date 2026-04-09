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
    vagaOriginalAtual: '',
    origemAtual: 'Criado do zero',
    historicoTelas: [],
    modeloIAPreferido: 'gemini-2.5-flash',
    temAlteracoesNaoSalvas: false,
    passoTour: 0
};

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

export const tourTextos = [
    '<b>1. Extração Mágica (IA) ✨</b><br><br>Cole todo o texto do seu LinkedIn ou de um currículo antigo no primeiro menu. A nossa Inteligência Artificial vai ler tudo e preencher todos os campos do editor de forma automática para você!',
    '<b>2. Múltiplas Versões 📑</b><br><br>Para se candidatar a vagas diferentes, use o botão <b>Salvar Cópia</b> no topo da tela. Ele duplica o seu currículo atual, permitindo que você altere informações sem perder a versão original.',
    '<b>3. Gerenciar e Exportar 📄</b><br><br>Na tela inicial do sistema, em <b>Ver Salvos</b>, você gerencia todas as suas versões. Quando o currículo estiver perfeito, é só clicar em <b>Gerar PDF</b> no menu superior!'
];
