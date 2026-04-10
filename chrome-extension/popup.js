const SEU_SITE_URL = 'https://curriculo-edi.vercel.app'; 
const AI_VALIDATION_ENDPOINT = `${SEU_SITE_URL}/api/validar-vaga`;
const SALVAR_VAGA_ENDPOINT = `${SEU_SITE_URL}/api/salvar-vaga`;
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

function setButtonStatus(text, disabled = false) {
    btnCapturar.innerText = text;
    btnCapturar.disabled = disabled;
}

function normalizarMensagemErro(mensagem) {
    if (!mensagem) return 'Nao foi possivel concluir a captura.';
    return mensagem.length > 90 ? `${mensagem.substring(0, 87)}...` : mensagem;
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
    const res = await fetch(AI_VALIDATION_ENDPOINT, {
        method: 'POST',
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
    const res = await fetch(SALVAR_VAGA_ENDPOINT, {
        method: 'POST',
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
        setButtonStatus(`🔎 Validando ${origemLabel} com IA...`, true);
        const validacao = await validarTextoComIa(captura);

        setButtonStatus('💾 Salvando vaga...', true);
        const idVaga = crypto.randomUUID();
        await salvarVagaNoBackend(idVaga, validacao.texto);

        setButtonStatus('✔ Sucesso!', true);
        setTimeout(() => {
            chrome.tabs.create({ url: `${SEU_SITE_URL}/?vaga_id=${idVaga}` });
        }, 500);
    } catch (e) {
        console.error(e);
        setButtonStatus(normalizarMensagemErro(e.message), false);
    }
});
