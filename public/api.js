import { appState } from './config.js';

// --- LOGS E DEBUG ---

export function logDebug(mensagem, erro = false) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
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
    // ... (Mantenha a sua lógica de criação do painel de debug aqui)
}

// --- GESTÃO DE MODELOS ---

export async function atualizarModelosDisponiveis() {
    logDebug('A atualizar lista de modelos...');
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE_AQUI');
        // Nota: Idealmente esta chamada deve passar pela sua Vercel Function ia.js para segurança

        if (!response.ok) throw new Error('Erro ao procurar modelos');

        const data = await response.json();
        // Filtra apenas modelos que suportam geração de conteúdo
        const modelosChat = data.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));

        // NOVO: Salva no cache para o Painel Admin
        localStorage.setItem('cache_modelos_lista', JSON.stringify(modelosChat));
        localStorage.setItem('cache_modelos_data', new Date().toLocaleString('pt-BR'));

        logDebug(`Modelos atualizados: ${modelosChat.length} encontrados.`);
        return modelosChat;
    } catch (error) {
        logDebug('Falha ao atualizar modelos: ' + error.message, true);
        return [];
    }
}

// --- PROCESSAMENTO DE IA ---

/**
 * @param {string} tipo - 'simples', 'agressivo', 'ats', 'validacao'
 * @param {string} contexto - O texto (CV ou Vaga) a ser processado
 */
export async function processarIA(tipo, contexto) {
    logDebug(`Iniciando processamento IA: ${tipo}`);

    // NOVO: Tenta pegar o prompt personalizado do LocalStorage, se não existir, usa o do config.js
    let promptBase = '';
    switch (tipo) {
        case 'simples': promptBase = localStorage.getItem('prompt_simples'); break;
        case 'agressivo': promptBase = localStorage.getItem('prompt_agressivo'); break;
        case 'ats': promptBase = localStorage.getItem('prompt_ats'); break;
        case 'validacao': promptBase = localStorage.getItem('prompt_validacao'); break;
    }

    // Se o admin nunca salvou nada, promptBase será null, então buscamos o padrão
    if (!promptBase) {
        // Importação dinâmica ou referência direta aos nomes no config.js
        const config = await import('./config.js');
        promptBase = config[`DEFAULT_PROMPT_${tipo.toUpperCase()}`];
    }

    const promptFinal = `${promptBase}\n\n[CONTEXTO]: ${contexto}`;

    try {
        const response = await fetch('/api/ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: promptFinal,
                modelo: appState.modeloIAPreferido
            })
        });

        if (!response.ok) {
            const corpoErro = await response.text();
            throw new Error(`Status HTTP ${response.status}: ${corpoErro}`);
        }

        const dataResp = await response.json();
        let respostaBruta = dataResp.candidates[0].content.parts[0].text;

        // Limpeza de Markdown se a IA retornar blocos ```json
        const inicioJson = respostaBruta.indexOf('{');
        const fimJson = respostaBruta.lastIndexOf('}');

        if (inicioJson === -1 || fimJson === -1) {
            exibirModalErro(respostaBruta);
            throw new Error('A resposta da IA não contém um JSON válido.');
        }

        return JSON.parse(respostaBruta.substring(inicioJson, fimJson + 1));

    } catch (error) {
        logDebug(`Erro na IA (${tipo}): ` + error.message, true);
        throw error;
    }
}

function exibirModalErro(texto) {
    const terr = document.getElementById('texto-bruto-erro');
    const merr = document.getElementById('modal-erro-ia');
    if (terr && merr) {
        terr.value = texto;
        merr.style.display = 'flex';
    }
}