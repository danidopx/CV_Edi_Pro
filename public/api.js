import { appState, sb, DEFAULT_PROMPTS_BY_NAME } from './config.js';

export const PROMPT_NAMES = {
    simples: 'ajuste_simples',
    agressivo: 'ajuste_agressivo',
    ats: 'analise_ats',
    validarVagaImportada: 'validar_vaga_importada',
    validarVagaAjuste: 'validar_vaga_ajuste',
    extracaoTextoCv: 'extracao_texto_cv'
};

const ORDEM_PREFERENCIA_MODELOS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
];

function escolherModeloPreferido(modelosDisponiveis) {
    for (const id of ORDEM_PREFERENCIA_MODELOS) {
        if (modelosDisponiveis.includes(id)) {
            return id;
        }
    }

    return modelosDisponiveis[0] || null;
}

export function getPromptCatalog() {
    return DEFAULT_PROMPTS_BY_NAME;
}

function erroDeModeloInvalido(mensagem) {
    return typeof mensagem === 'string'
        && (
            mensagem.includes('is not found for API version')
            || mensagem.includes('not supported for generateContent')
        );
}

function traduzirErroIA(status, mensagem) {
    if (typeof mensagem !== 'string') {
        return `Status HTTP ${status}: erro desconhecido na IA.`;
    }

    if (mensagem.includes('API_KEY_INVALID') || mensagem.includes('API Key not found')) {
        return 'A chave da API Gemini parece inválida ou não chegou corretamente ao ambiente do Vercel.';
    }

    if (mensagem.includes('"status": "UNAVAILABLE"') || mensagem.includes('currently experiencing high demand')) {
        return 'A API do Gemini está com alta demanda no momento. Tente novamente em alguns instantes.';
    }

    return `Status HTTP ${status}: ${mensagem}`;
}

export function logDebug(mensagem, erro = false) {
    const timestamp = new Date().toLocaleTimeString();
    const msgFormatada = `[${timestamp}] ${mensagem}`;

    if (erro) console.error(msgFormatada);
    else console.log(msgFormatada);

    let logs = JSON.parse(localStorage.getItem('edi_logs') || '[]');
    logs.push(msgFormatada);
    if (logs.length > 50) logs.shift();
    localStorage.setItem('edi_logs', JSON.stringify(logs));

    const conteudo = document.getElementById('painel-debug-edi-conteudo');
    if (conteudo) {
        conteudo.innerHTML += `<div style="color: ${erro ? '#ff7675' : '#a29bfe'}; margin-bottom: 4px;">${msgFormatada}</div>`;
        conteudo.scrollTop = conteudo.scrollHeight;
    }
}

export function initDebugPanel() {
    const painel = document.createElement('div');
    painel.id = 'painel-debug-edi';
    const versao = document.querySelector('.footer-info strong')?.innerText || 'CV Edi Pro';
    painel.dataset.expandido = 'false';
    painel.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 260px; height: 38px; background: rgba(0,0,0,0.88); color: #fff; font-family: monospace; font-size: 11px; padding: 8px; overflow: hidden; z-index: 99999; border-radius: 8px; border: 1px solid #6c5ce7; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';
    painel.innerHTML = `
        <div style="color: #a29bfe; font-weight: bold; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <button id="painel-debug-toggle" type="button" style="background: transparent; color: #a29bfe; border: 0; cursor: pointer; font-weight: bold;">+</button>
            <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Log - ${versao}</span>
            <span style="cursor:pointer; color:#ff7675;" onclick="this.closest('#painel-debug-edi').style.display='none'">X</span>
        </div>
        <div id="painel-debug-edi-conteudo" style="display:none; margin-top: 8px; border-top: 1px solid #555; padding-top: 8px; height: 190px; overflow-y: auto;"></div>
    `;
    document.body.appendChild(painel);

    const conteudo = document.getElementById('painel-debug-edi-conteudo');
    const toggle = document.getElementById('painel-debug-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const expandido = painel.dataset.expandido === 'true';
            painel.dataset.expandido = expandido ? 'false' : 'true';
            painel.style.width = expandido ? '260px' : '350px';
            painel.style.height = expandido ? '38px' : '250px';
            painel.style.overflow = expandido ? 'hidden' : 'hidden';
            if (conteudo) conteudo.style.display = expandido ? 'none' : 'block';
            toggle.innerText = expandido ? '+' : '-';
            if (conteudo) conteudo.scrollTop = conteudo.scrollHeight;
        });
    }

    const logs = JSON.parse(localStorage.getItem('edi_logs') || '[]');
    logs.forEach(l => {
        if (conteudo) conteudo.innerHTML += `<div style="color: #a29bfe; margin-bottom: 4px;">${l}</div>`;
    });
    if (conteudo) conteudo.scrollTop = conteudo.scrollHeight;
}

export async function inicializarModeloIA() {
    try {
        const modeloForcado = await carregarConfiguracaoIA('modelo_forcado', { logMissing: false });
        appState.modeloIAForcado = (modeloForcado?.setting_value || '').trim();

        const modelResp = await fetch('/api/modelos');
        if (modelResp.ok) {
            const modelData = await modelResp.json();
            const modelosDisponiveis = modelData.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
                .map(m => m.name.split('/')[1]);

            const escolhido = appState.modeloIAForcado || escolherModeloPreferido(modelosDisponiveis);
            if (escolhido) {
                appState.modeloIAPreferido = escolhido;
            }
            console.log('IA Configurada para modelo rápido:', appState.modeloIAPreferido);
        }
    } catch (e) {
        console.warn('Aviso: Falha ao pré-carregar os modelos da IA, será usado o modelo padrão fallback.');
    }
}

export async function carregarPromptIA(promptName, { logMissing = true } = {}) {
    const { data, error } = await sb
        .from('ai_prompts')
        .select('id, prompt_content')
        .eq('prompt_name', promptName)
        .single();

    if (error) {
        if (logMissing && error.code !== 'PGRST116') {
            logDebug(`[ERRO Supabase] Falha ao buscar prompt '${promptName}': ${error.message}`, true);
        }
        return null;
    }

    return data;
}

export async function carregarTodosPromptsIA() {
    const { data, error } = await sb
        .from('ai_prompts')
        .select('id, prompt_name, prompt_content, description, is_system_prompt, updated_at')
        .order('prompt_name', { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

export async function carregarConfiguracaoIA(settingKey, { logMissing = true } = {}) {
    const { data, error } = await sb
        .from('ai_settings')
        .select('setting_key, setting_value, description, updated_at')
        .eq('setting_key', settingKey)
        .maybeSingle();

    if (error) {
        if (logMissing) {
            logDebug(`[ERRO Supabase] Falha ao buscar configuração '${settingKey}': ${error.message}`, true);
        }
        return null;
    }

    return data;
}

export async function processarIA(promptOrContent, options = {}) {
    let respostaBruta = '';
    let promptId = null;
    let actualPromptContent = promptOrContent;

    try {
        if (options.promptName) {
            const promptData = await carregarPromptIA(options.promptName);
            if (promptData) {
                promptId = promptData.id;
                actualPromptContent = promptData.prompt_content;
            }
        } else if (options.promptContentOverride) {
            actualPromptContent = options.promptContentOverride;
        } else if (options.promptNameFallback) {
            const promptData = await carregarPromptIA(options.promptNameFallback, { logMissing: false });
            if (promptData) {
                promptId = promptData.id;
                actualPromptContent = promptData.prompt_content;
            }
        }

        if (options.transformPromptContent) {
            actualPromptContent = options.transformPromptContent(actualPromptContent);
        }

        if (options.promptIdOverride) {
            promptId = options.promptIdOverride;
        }

        if (options.promptRecord) {
            const promptData = options.promptRecord;
            promptId = promptData.id;
            actualPromptContent = promptData.prompt_content;
        }

        const { data: { user } } = await sb.auth.getUser();
        const userId = user?.id || null;

        const executarRequisicaoIA = async () => fetch('/api/ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: actualPromptContent, modelo: appState.modeloIAPreferido })
        });

        let response = await executarRequisicaoIA();

        if (!response.ok) {
            let corpoErro = await response.text();

            if (response.status === 500 && erroDeModeloInvalido(corpoErro)) {
                logDebug(`Modelo '${appState.modeloIAPreferido}' invalido. Atualizando lista de modelos e tentando novamente...`, true);
                await inicializarModeloIA();
                response = await executarRequisicaoIA();

                if (!response.ok) {
                    corpoErro = await response.text();
                    throw new Error(traduzirErroIA(response.status, corpoErro));
                }
            } else {
                throw new Error(traduzirErroIA(response.status, corpoErro));
            }
        }

        const dataResp = await response.json();
        respostaBruta = dataResp.candidates[0].content.parts[0].text;

        const inicioJson = respostaBruta.indexOf('{');
        const fimJson = respostaBruta.lastIndexOf('}');

        let parsedJson = null;
        if (inicioJson !== -1 && fimJson !== -1) {
            try {
                parsedJson = JSON.parse(respostaBruta.substring(inicioJson, fimJson + 1));
            } catch (e) {
                logDebug(`[ERRO JSON Parse] Falha ao fazer parse do JSON: ${e.message}`, true);
            }
        }

        // 2. Log AI interaction to Supabase
        const { error: logError } = await sb.from('ai_interactions').insert({
            prompt_id: promptId,
            model_used: appState.modeloIAPreferido,
            input_content: actualPromptContent,
            raw_response: respostaBruta,
            parsed_response: parsedJson,
            user_id: userId
        });

        if (logError) {
            logDebug(`[ERRO Supabase] Falha ao logar interação da IA: ${logError.message}`, true);
        }

        if (!parsedJson) {
            const terr = document.getElementById('texto-bruto-erro');
            const merr = document.getElementById('modal-erro-ia');
            if (terr && merr) { terr.value = respostaBruta; merr.style.display = 'flex'; }
            throw new Error('Erro JSON: Resposta da IA não contém JSON válido ou falha no parse.');
        }

        return parsedJson;
    } catch (err) {
        logDebug(`[ERRO IA] ${err.message}`, true);

        // Still try to log the error interaction if possible
        const { data: { user } } = await sb.auth.getUser();
        const userId = user?.id || null;

        const { error: logError } = await sb.from('ai_interactions').insert({
            prompt_id: promptId,
            model_used: appState.modeloIAPreferido,
            input_content: actualPromptContent,
            raw_response: respostaBruta, // Even if it's an error, log the raw response
            parsed_response: null, // No parsed JSON on error
            user_id: userId
        });

        if (logError) {
            logDebug(`[ERRO Supabase] Falha ao logar interação de ERRO da IA: ${logError.message}`, true);
        }

        throw err;
    }
}
