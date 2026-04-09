import { appState, sb } from './config.js';

export const PROMPT_NAMES = {
    simples: 'ajuste_simples',
    agressivo: 'ajuste_agressivo',
    ats: 'analise_ats'
};

export function logDebug(mensagem, erro = false) {
    const timestamp = new Date().toLocaleTimeString();
    const msgFormatada = `[${timestamp}] ${mensagem}`;

    if (erro) console.error(msgFormatada);
    else console.log(msgFormatada);

    let logs = JSON.parse(localStorage.getItem('edi_logs') || '[]');
    logs.push(msgFormatada);
    if (logs.length > 50) logs.shift();
    localStorage.setItem('edi_logs', JSON.stringify(logs));

    const painel = document.getElementById('painel-debug-edi');
    if (painel) {
        painel.innerHTML += `<div style="color: ${erro ? '#ff7675' : '#a29bfe'}; margin-bottom: 4px;">${msgFormatada}</div>`;
        painel.scrollTop = painel.scrollHeight;
    }
}

export function initDebugPanel() {
    const painel = document.createElement('div');
    painel.id = 'painel-debug-edi';
    painel.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 350px; height: 250px; background: rgba(0,0,0,0.85); color: #fff; font-family: monospace; font-size: 11px; padding: 10px; overflow-y: auto; z-index: 99999; border-radius: 8px; border: 1px solid #6c5ce7; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';
    painel.innerHTML = '<div style="color: #6c5ce7; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 5px; display: flex; justify-content: space-between;"><span>Edi Pro - Log Monitor</span><span style="cursor:pointer; color:red;" onclick="this.parentElement.parentElement.style.display=\'none\'">X</span></div>';
    document.body.appendChild(painel);

    const logs = JSON.parse(localStorage.getItem('edi_logs') || '[]');
    logs.forEach(l => {
        painel.innerHTML += `<div style="color: #a29bfe; margin-bottom: 4px;">${l}</div>`;
    });
    painel.scrollTop = painel.scrollHeight;
}

export async function inicializarModeloIA() {
    try {
        const modelResp = await fetch('/api/modelos');
        if (modelResp.ok) {
            const modelData = await modelResp.json();
            const modelosDisponiveis = modelData.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
                .map(m => m.name.split('/')[1]);

            const ordemPreferencia = [
                'gemini-1.5-flash-latest',
                'gemini-1.5-pro-latest',
                'gemini-1.5-flash',
                'gemini-pro'
            ];
            let escolhido = null;
            for (const id of ordemPreferencia) {
                if (modelosDisponiveis.includes(id)) {
                    escolhido = id;
                    break;
                }
            }
            if (!escolhido && modelosDisponiveis.length > 0) {
                escolhido = modelosDisponiveis[0];
            }
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

        const response = await fetch('/api/ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: actualPromptContent, modelo: appState.modeloIAPreferido })
        });

        if (!response.ok) {
            const corpoErro = await response.text();
            throw new Error(`Status HTTP ${response.status}: ${corpoErro}`);
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
