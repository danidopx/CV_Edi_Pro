import { appState, sb, DEFAULT_PROMPTS_BY_NAME } from './config.js';

export const PROMPT_NAMES = {
    simples: 'ajuste_simples',
    agressivo: 'ajuste_agressivo',
    ats: 'analise_ats',
    atsGeral: 'analise_ats_geral',
    aplicarAjustes: 'aplicar_ajustes',
    validarVagaImportada: 'validar_vaga_importada',
    validarVagaAjuste: 'validar_vaga_ajuste',
    extracaoTextoCv: 'extracao_texto_cv',
    gerarCurriculoHistorico: 'gerar_curriculo_historico',
    melhorarResumo: 'melhorar_resumo',
    melhorarResumoAlvo: 'melhorar_resumo_alvo',
    melhorarExperiencia: 'melhorar_experiencia',
    reescreverExperienciaVaga: 'reescrever_experiencia_vaga'
};

function detectarAmbienteAtualPeloHost(hostname) {
    const host = String(hostname || '').toLowerCase();

    // Domínios oficiais de PRODUÇÃO
    const hostsProducao = [
        'cvedipro.vercel.app',
        'curriculo-edi.vercel.app',
        'cv-edi-pro.onrender.com'
    ];

    if (hostsProducao.includes(host)) {
        return 'production';
    }

    // Se estiver no Render ou Vercel e não for o host oficial, é Preview
    if (host.includes('onrender.com') || host.includes('vercel.app')) {
        return 'preview';
    }

    return 'production';
}

const ORDEM_PREFERENCIA_MODELOS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
];

const TIPOS_SUGESTAO_ACEITOS = new Set(['resumo', 'experiencia', 'habilidade', 'formacao', 'idioma', 'contato', 'geral']);
const PRIORIDADES_SUGESTAO_ACEITAS = new Set(['alta', 'media', 'baixa']);

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

export function detectarAmbienteAtual() {
    return detectarAmbienteAtualPeloHost(window.location.hostname);
}

function formatarDataVersao(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function montarRotuloVersao(registro) {
    const ambiente = registro?.environment_name === 'production' ? 'Produção' : 'Preview';
    const versao = registro?.current_version || '0.0.0';
    return `CV Edi Pro v${versao}${ambiente === 'Preview' ? ' - Preview' : ''}`;
}

function extrairVersaoDoRotulo(texto) {
    const match = String(texto || '').match(/v(\d+\.\d+\.\d+)/i);
    return match ? match[1] : '';
}

function compararVersoesSemver(a, b) {
    const partesA = String(a || '0.0.0').split('.').map(n => Number(n) || 0);
    const partesB = String(b || '0.0.0').split('.').map(n => Number(n) || 0);

    for (let i = 0; i < 3; i += 1) {
        if ((partesA[i] || 0) > (partesB[i] || 0)) return 1;
        if ((partesA[i] || 0) < (partesB[i] || 0)) return -1;
    }

    return 0;
}

function normalizarUrlComparacao(valor) {
    return String(valor || '').trim().replace(/\/+$/, '').toLowerCase();
}

export async function carregarVersaoAtualApp() {
    const sb = getSb();

    const ambiente = detectarAmbienteAtual();
    const buildInfo = await carregarVersaoBuildAtual();

    const { data } = await sb
        .from('app_versions')
        .select('current_version, environment_name, release_date, deployment_url, commit_ref')
        .eq('environment_name', ambiente)
        .eq('is_current', true)
        .order('release_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (registroVersaoCombinaComDeployAtual(data, buildInfo)) {
        return data;
    }

    return buildInfo
        ? {
            current_version: buildInfo.current_version,
            environment_name: buildInfo.environment_name || ambiente,
            release_date: null,
            deployment_url: buildInfo.deployment_url || null,
            commit_ref: buildInfo.commit_ref || null
        }
        : null;
}

export function inicializarBadgeAmbiente() {
    const ambiente = detectarAmbienteAtual();
    const el = document.getElementById('env-badge');
    if (!el) return;

    el.className = `env-badge ${ambiente}`;
    el.textContent = ambiente === 'preview' ? '🧪 Preview' : '🚀 Produção';

    // Se quiser esconder em produção para manter o visual limpo, descomente abaixo:
    // if (ambiente === 'production') el.style.display = 'none';
}

export async function carregarVersaoBuildAtual() {
    try {
        const resposta = await fetch('/api/build-version', { cache: 'no-store' });
        if (!resposta.ok) return null;
        return await resposta.json();
    } catch {
        return null;
    }
}

function registroVersaoCombinaComDeployAtual(registro, buildInfo = null) {
    if (!registro) return false;

    const deploymentUrl = normalizarUrlComparacao(registro.deployment_url);
    const origemAtual = normalizarUrlComparacao(window.location.origin);

    if (buildInfo) {
        const ambienteBuild = String(buildInfo.environment_name || '').trim();
        const ambienteRegistro = String(registro.environment_name || '').trim();
        const versaoBuild = String(buildInfo.current_version || '').trim();
        const versaoRegistro = String(registro.current_version || '').trim();
        const commitBuild = String(buildInfo.commit_ref || '').trim().toLowerCase();
        const commitRegistro = String(registro.commit_ref || '').trim().toLowerCase();

        if (ambienteBuild && ambienteRegistro && ambienteBuild !== ambienteRegistro) {
            return false;
        }

        if (versaoBuild && versaoRegistro && versaoBuild !== versaoRegistro) {
            return false;
        }

        if (commitBuild && commitRegistro) {
            return commitBuild === commitRegistro;
        }

        if (deploymentUrl && origemAtual) {
            return deploymentUrl === origemAtual;
        }

        return Boolean(versaoBuild && versaoRegistro && versaoBuild === versaoRegistro);
    }

    if (!deploymentUrl) return false;
    return deploymentUrl === origemAtual;
}

export async function carregarHistoricoVersoesApp(environmentName) {
    let query = sb
        .from('app_versions')
        .select('id, app_name, environment_name, current_version, previous_version, release_date, responsible_name, responsible_email, deployment_url, commit_ref, release_notes, source, is_current')
        .order('release_date', { ascending: false })
        .limit(20);

    if (environmentName) {
        query = query.eq('environment_name', environmentName);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data || [];
}

export async function registrarVersaoApp(payload) {
    const environmentName = payload.environment_name;

    const { data: atualAtual, error: atualError } = await sb
        .from('app_versions')
        .select('id, current_version')
        .eq('environment_name', environmentName)
        .eq('is_current', true)
        .order('release_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (atualError) {
        throw atualError;
    }

    if (atualAtual?.id) {
        const { error: limparAtualError } = await sb
            .from('app_versions')
            .update({ is_current: false })
            .eq('id', atualAtual.id);

        if (limparAtualError) {
            throw limparAtualError;
        }
    }

    const registro = {
        app_name: payload.app_name || 'CV Edi Pro',
        environment_name: environmentName,
        current_version: payload.current_version,
        previous_version: payload.previous_version || atualAtual?.current_version || null,
        release_date: payload.release_date || new Date().toISOString(),
        responsible_name: payload.responsible_name || null,
        responsible_email: payload.responsible_email || null,
        deployment_url: payload.deployment_url || null,
        commit_ref: payload.commit_ref || null,
        release_notes: payload.release_notes || null,
        source: payload.source || 'manual',
        is_current: true,
        is_public: true,
        created_by: appState.usuarioAtual?.id || null
    };

    const { data, error } = await sb
        .from('app_versions')
        .insert(registro)
        .select('id, app_name, environment_name, current_version, previous_version, release_date, responsible_name, responsible_email, deployment_url, commit_ref, release_notes, source, is_current')
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function sincronizarVersaoAppNaTela() {
    inicializarBadgeAmbiente();
    const label = document.querySelector('[data-app-version-label]');
    const meta = document.querySelector('[data-app-version-meta]');
    if (!label) return;

    const version = await carregarVersaoAtualApp().catch(() => null);
    if (!version) return;

    label.textContent =
        `v${version.current_version}${version.environment_name === 'preview' ? ' - Preview' : ''}`;

    if (meta) {
        meta.textContent =
            `${version.environment_name}${version.release_date ? ` | ${new Date(version.release_date).toLocaleString('pt-BR')}` : ' | build atual'}`;
    }
}

function normalizarListaTexto(valor) {
    if (!Array.isArray(valor)) return [];
    return valor
        .map(item => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean);
}

function inferirTipoSugestao(descricao) {
    const texto = String(descricao || '').toLowerCase();
    if (/(resumo|perfil profissional|objetivo)/.test(texto)) return 'resumo';
    if (/(experien|atividade|resultado|realiza|atuou|historico profissional)/.test(texto)) return 'experiencia';
    if (/(habilidade|competenc|tecnolog|ferramenta|skill)/.test(texto)) return 'habilidade';
    if (/(forma[cç][aã]o|curso|gradu|faculdade|certifica)/.test(texto)) return 'formacao';
    if (/(idioma|ingles|ingl[eê]s|espanhol|flu[eê]ncia)/.test(texto)) return 'idioma';
    if (/(telefone|whats|email|linkedin|contato)/.test(texto)) return 'contato';
    return 'geral';
}

function inferirAlvoSugestao(tipo) {
    switch (tipo) {
        case 'resumo': return 'resumo';
        case 'experiencia': return 'experiencias';
        case 'habilidade': return 'habilidades';
        case 'formacao': return 'escolaridades';
        case 'idioma': return 'idiomas';
        case 'contato': return 'dados_pessoais';
        default: return 'curriculo';
    }
}

function inferirPrioridadeSugestao(descricao) {
    const texto = String(descricao || '').toLowerCase();
    if (/(urgente|essencial|prioridade|obrigat[oó]ri|ausente|faltando|incluir)/.test(texto)) return 'alta';
    if (/(melhorar|refor[cç]ar|detalhar|ajustar|destacar)/.test(texto)) return 'media';
    return 'baixa';
}

function normalizarSugestaoEstruturada(item) {
    if (typeof item === 'string') {
        const descricao = item.trim();
        const tipo = inferirTipoSugestao(descricao);
        return {
            tipo,
            alvo: inferirAlvoSugestao(tipo),
            descricao,
            prioridade: inferirPrioridadeSugestao(descricao),
            aplicavel_automaticamente: false
        };
    }

    if (!item || typeof item !== 'object') {
        return null;
    }

    const descricao = String(item.descricao || item.texto || item.sugestao || '').trim();
    if (!descricao) return null;

    const tipoInferido = inferirTipoSugestao(descricao);
    const tipoBruto = String(item.tipo || '').trim().toLowerCase();
    const tipo = TIPOS_SUGESTAO_ACEITOS.has(tipoBruto) ? tipoBruto : tipoInferido;

    const prioridadeBruta = String(item.prioridade || '').trim().toLowerCase();
    const prioridade = PRIORIDADES_SUGESTAO_ACEITAS.has(prioridadeBruta)
        ? prioridadeBruta
        : inferirPrioridadeSugestao(descricao);

    const alvo = String(item.alvo || '').trim() || inferirAlvoSugestao(tipo);

    return {
        tipo,
        alvo,
        descricao,
        prioridade,
        aplicavel_automaticamente: Boolean(item.aplicavel_automaticamente) && false
    };
}

function pareceRespostaATS(parsedJson) {
    if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
        return false;
    }

    return [
        'score',
        'risco',
        'motivo_risco',
        'pontos_fortes',
        'pontos_medios',
        'pontos_fracos',
        'sugestoes',
        'sugestoes_estruturadas'
    ].some(chave => chave in parsedJson);
}

export function normalizarRespostaATS(parsedJson) {
    if (!pareceRespostaATS(parsedJson)) {
        return parsedJson;
    }

    const sugestoesTexto = normalizarListaTexto(parsedJson.sugestoes);
    const sugestoesEstruturadasBrutas = Array.isArray(parsedJson.sugestoes_estruturadas)
        ? parsedJson.sugestoes_estruturadas
        : sugestoesTexto;

    const sugestoesEstruturadas = sugestoesEstruturadasBrutas
        .map(item => normalizarSugestaoEstruturada(item))
        .filter(Boolean);

    return {
        ...parsedJson,
        pontos_fortes: normalizarListaTexto(parsedJson.pontos_fortes),
        pontos_medios: normalizarListaTexto(parsedJson.pontos_medios),
        pontos_fracos: normalizarListaTexto(parsedJson.pontos_fracos),
        sugestoes: sugestoesTexto.length > 0
            ? sugestoesTexto
            : sugestoesEstruturadas.map(item => item.descricao),
        sugestoes_estruturadas: sugestoesEstruturadas
    };
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
    if (document.getElementById('painel-debug-edi')) return;
    const painel = document.createElement('div');
    painel.id = 'painel-debug-edi';
    const versao = document.querySelector('.footer-info strong')?.innerText || 'CV Edi Pro';
    painel.dataset.expandido = 'false';
    painel.style.cssText = 'display: none; position: fixed; bottom: 10px; right: 10px; width: 260px; height: 38px; background: rgba(0,0,0,0.88); color: #fff; font-family: monospace; font-size: 11px; padding: 8px; overflow: hidden; z-index: 99999; border-radius: 8px; border: 1px solid #6c5ce7; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';
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

export function atualizarVisibilidadePainelDebug(visivel) {
    const painel = document.getElementById('painel-debug-edi');
    if (!painel) return;
    painel.style.display = visivel ? 'block' : 'none';
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
                parsedJson = normalizarRespostaATS(parsedJson);
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
