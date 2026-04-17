const MODO_CONFIGURACAO_AMBIENTE = true;
const SITE_PRODUCAO_URL = 'https://cvedipro.vercel.app';
const STORAGE_SITE_URL_KEY = 'ediProSiteUrl';
const MAX_TEXTO_VAGA_LENGTH = 8000;
const MIN_TEXTO_VAGA_LENGTH = 80;
const VALIDACAO_IA_PROMPT = `
Voce e um validador de texto de vaga de emprego para o Edi Pro.
Analise o texto enviado e responda somente JSON valido, sem markdown.
Formato:
{
  "valido": boolean,
  "motivo": "frase curta em portugues",
  "texto_normalizado": "texto da vaga limpo, preservando informacoes relevantes"
}
Marque "valido" como true apenas quando o texto aparentar ser uma vaga de emprego real, com cargo, atividades, requisitos, empresa, localidade, beneficios ou contexto equivalente.
Marque "valido" como false para textos vazios, paginas de login, feeds, propagandas, curriculos, artigos, menus, conteudo aleatorio ou textos sem informacoes suficientes de uma vaga.
Se valido, remova menus, rodapes, botoes, comentarios, textos repetidos e ruido visual. Preserve cargo, empresa, modalidade, localidade, requisitos, responsabilidades, beneficios, senioridade e instrucoes de candidatura.
`;

const btnCapturar = document.getElementById('btn-capturar');
const configAmbiente = document.getElementById('config-ambiente');
const inputSiteUrl = document.getElementById('input-site-url');
const btnSalvarUrl = document.getElementById('btn-salvar-url');
const btnUsarProducao = document.getElementById('btn-usar-producao');
const ambienteAtual = document.getElementById('ambiente-atual');
let siteUrlAtual = SITE_PRODUCAO_URL;

function setButtonStatus(text, disabled = false) {
    btnCapturar.innerText = text;
    btnCapturar.disabled = disabled;
}

function normalizarMensagemErro(mensagem) {
    if (!mensagem) return 'Nao foi possivel concluir a captura.';
    return mensagem.length > 90 ? `${mensagem.substring(0, 87)}...` : mensagem;
}

function normalizarSiteUrl(url) {
    const valor = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';

    if (!valor) return SITE_PRODUCAO_URL;
    if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(valor)) {
        throw new Error('Informe uma URL HTTPS valida.');
    }

    return valor;
}

function atualizarTextoAmbiente() {
    if (!ambienteAtual) return;
    const label = siteUrlAtual === SITE_PRODUCAO_URL ? 'Producao' : 'Teste';
    ambienteAtual.innerText = `${label}: ${siteUrlAtual}`;
}

async function carregarSiteUrl() {
    if (!MODO_CONFIGURACAO_AMBIENTE || !chrome.storage?.local) {
        siteUrlAtual = SITE_PRODUCAO_URL;
        return siteUrlAtual;
    }

    const dados = await chrome.storage.local.get(STORAGE_SITE_URL_KEY);
    siteUrlAtual = normalizarSiteUrl(dados[STORAGE_SITE_URL_KEY]);

    if (inputSiteUrl) inputSiteUrl.value = siteUrlAtual;
    atualizarTextoAmbiente();
    return siteUrlAtual;
}

function getEndpoint(path) {
    return `${siteUrlAtual}${path}`;
}

async function capturarTextoDaAba(tabId) {
    const [resultado] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [MAX_TEXTO_VAGA_LENGTH],
        func: (maxLength) => {
            const selecao = window.getSelection().toString().trim();
            const textoFonte = selecao.length > 50 ? selecao : (document.body && document.body.innerText) || '';
            const textoLimpo = textoFonte.replace(/\s+/g, ' ').trim();

            return {
                texto: textoLimpo.substring(0, maxLength),
                origem: selecao.length > 50 ? 'selecao' : 'pagina',
                tamanhoOriginal: textoLimpo.length,
                truncado: textoLimpo.length > maxLength
            };
        }
    });

    return resultado && resultado.result;
}

async function validarTextoComIa(captura) {
    const res = await fetch(getEndpoint('/api/validar-vaga'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            texto: captura.texto,
            prompt: VALIDACAO_IA_PROMPT,
            origem: captura.origem,
            truncado: captura.truncado
        })
    });

    if (!res.ok) {
        if (res.status === 404) {
            throw new Error('Validacao IA nao encontrada. Publique o endpoint /api/validar-vaga no site.');
        }

        throw new Error(`Validacao IA falhou (${res.status}).`);
    }

    const data = await res.json();
    const valido = data.valido === true || data.is_job_posting === true || data.valid === true;

    if (!valido) {
        throw new Error(data.motivo || data.reason || 'O texto capturado nao parece ser uma vaga de emprego.');
    }

    return {
        texto: data.texto_normalizado || data.normalized_text || data.texto || captura.texto,
        motivo: data.motivo || data.reason || 'Texto validado por IA.'
    };
}

async function salvarVagaNoBackend(idVaga, textoVaga) {
    const res = await fetch(getEndpoint('/api/salvar-vaga'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: idVaga,
            texto: textoVaga
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Backend retornou ${res.status} ao salvar a vaga.`);
    }
}

btnCapturar.addEventListener('click', async () => {
    setButtonStatus('⏳ Lendo pagina...', true);

    try {
        await carregarSiteUrl();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('Nao foi possivel identificar a aba ativa.');
        }

        const captura = await capturarTextoDaAba(tab.id);

        if (!captura || !captura.texto) {
            throw new Error('Aba bloqueada ou sem texto legivel.');
        }

        if (captura.texto.length < MIN_TEXTO_VAGA_LENGTH) {
            throw new Error('Selecione mais detalhes da vaga antes de capturar.');
        }

        const origemLabel = captura.origem === 'selecao' ? 'selecao' : 'pagina';
        setButtonStatus(`🔎 Validando ${origemLabel} da vaga...`, true);
        const validacao = await validarTextoComIa(captura);

        setButtonStatus('💾 Salvando vaga...', true);
        const idVaga = crypto.randomUUID();
        await salvarVagaNoBackend(idVaga, validacao.texto);

        setButtonStatus('✔ Sucesso!', true);
        setTimeout(() => {
            chrome.tabs.create({ url: `${siteUrlAtual}/?vaga_id=${idVaga}` });
        }, 500);
    } catch (e) {
        console.error(e);
        setButtonStatus(normalizarMensagemErro(e.message), false);
    }
});

async function iniciarConfiguracaoAmbiente() {
    if (!MODO_CONFIGURACAO_AMBIENTE || !configAmbiente) {
        return;
    }

    configAmbiente.style.display = 'block';
    await carregarSiteUrl();

    btnSalvarUrl?.addEventListener('click', async () => {
        try {
            siteUrlAtual = normalizarSiteUrl(inputSiteUrl?.value);
            await chrome.storage.local.set({ [STORAGE_SITE_URL_KEY]: siteUrlAtual });
            atualizarTextoAmbiente();
            setButtonStatus('Ambiente salvo', false);
        } catch (error) {
            setButtonStatus(normalizarMensagemErro(error.message), false);
        }
    });

    btnUsarProducao?.addEventListener('click', async () => {
        siteUrlAtual = SITE_PRODUCAO_URL;
        if (inputSiteUrl) inputSiteUrl.value = SITE_PRODUCAO_URL;
        await chrome.storage.local.remove(STORAGE_SITE_URL_KEY);
        atualizarTextoAmbiente();
        setButtonStatus('Producao selecionada', false);
    });
}

iniciarConfiguracaoAmbiente();
