const SUPABASE_URL = 'https://gjrnaavkyalwolldexft.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CPM-CH4JV3muBw_DrGk-zQ_Rii5iGU6';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let idAtual = null; let usuarioAtual = null;
let editResumoNode = null, editExpNode = null, editEscNode = null, editIdiNode = null, editHabNode = null;
let modoCriarConta = false;
let ultimasAlteracoesIA = "";
let analiseAtsAtual = null;
let vagaOriginalAtual = "";
let origemAtual = "Criado do zero";
let historicoTelas = [];
let modeloIAPreferido = "gemini-1.5-flash";
let temAlteracoesNaoSalvas = false;

function marcarAlteracao() {
    temAlteracoesNaoSalvas = true;
    if (analiseAtsAtual && vagaOriginalAtual) {
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.classList.remove('oculto');
    }
}

// --- INÍCIO DA LÓGICA DE CARREGAMENTO (LOAD) ---
window.addEventListener('load', async () => {
    applyTheme(localStorage.getItem('themePreference') || 'light');
    inicializarModeloIA();

    // 1. CAPTURA DE PARÂMETROS DA EXTENSÃO (vaga_id)
    const urlParams = new URLSearchParams(window.location.search);
    const vaga_id = urlParams.get('vaga_id');

    if (vaga_id) {
        localStorage.setItem('vaga_pendente_importacao', vaga_id);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        usuarioAtual = session.user;
        localStorage.setItem('ultima_atividade_app', Date.now());
        atualizarInfosUsuarioTopo();
        verificarAdmin();

        // 2. TENTA IMPORTAR SE HOUVER VAGA NO "BAÚ"
        const idNoBau = localStorage.getItem('vaga_pendente_importacao');
        if (idNoBau) {
            receberVagaExterna(idNoBau);
        } else {
            recuperarEstadoTela();
        }
    } else {
        if (localStorage.getItem('vaga_pendente_importacao')) {
            setTimeout(() => {
                showToast("🚀 Vaga capturada! Faça login para concluir a importação.");
            }, 1000);
        }
        irPara('tela-landing');
    }

    // --- MÁSCARAS DE ENTRADA (MANTIDAS DO SEU ORIGINAL) ---
    ['expIni', 'expFim', 'escIni'].forEach(id => {
        const inputData = document.getElementById(id);
        if (inputData) {
            inputData.addEventListener('input', function () {
                let v = this.value.replace(/\D/g, "");
                if (v.length >= 2) {
                    let mes = parseInt(v.substring(0, 2));
                    if (mes > 12) v = "12" + v.substring(2);
                    if (mes === 0 && v.length >= 2) v = "01" + v.substring(2);
                    v = v.replace(/^(\d{2})(\d)/, "$1/$2");
                }
                this.value = v.substring(0, 7);
            });
        }
    });

    const inPretensao = document.getElementById('inPretensao');
    if (inPretensao) {
        inPretensao.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, "");
            if (v) {
                v = (parseInt(v) / 100).toFixed(2).replace(".", ",");
                v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
                this.value = "R$ " + v;
            }
        });
    }

    // --- MONITORAMENTO DE AUTH ---
    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            usuarioAtual = session.user;
            const idNoBau = localStorage.getItem('vaga_pendente_importacao');
            if (idNoBau) receberVagaExterna(idNoBau);
        } else if (event === 'SIGNED_OUT') {
            usuarioAtual = null;
            irPara('tela-landing');
        }
    });
});

// --- FUNÇÃO DE IMPORTAÇÃO COM VALIDAÇÃO IA ---
async function receberVagaExterna(idTransferencia) {
    try {
        exibirLoading(true, "Validando vaga capturada...");

        const { data, error } = await sb.from('transferencias_vagas')
            .select('texto')
            .eq('id', idTransferencia)
            .single();

        if (error || !data) {
            localStorage.removeItem('vaga_pendente_importacao');
            throw new Error("Vaga não encontrada.");
        }

        const textoVaga = data.texto;

        // VALIDAÇÃO COM IA
        const promptValidacao = `Responda apenas SIM se o texto abaixo for uma vaga de emprego ou NAO se não for: ${textoVaga.substring(0, 500)}`;
        const ehVaga = await chamarIA(promptValidacao); // Ajuste se sua função for diferente

        if (ehVaga.includes("NAO")) {
            showToast("⚠️ O conteúdo não parece ser uma vaga válida.");
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        localStorage.removeItem('vaga_pendente_importacao');
        await abrirTelaVaga();

        const txtEl = document.getElementById('texto-vaga');
        if (txtEl) {
            txtEl.value = textoVaga;
            txtEl.dispatchEvent(new Event('input'));
        }
        showToast("✨ Vaga importada com sucesso!");
        await sb.from('transferencias_vagas').delete().eq('id', idTransferencia);

    } catch (e) {
        console.error(e);
        localStorage.removeItem('vaga_pendente_importacao');
    } finally {
        exibirLoading(false);
    }
}