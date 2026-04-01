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

// --- INICIALIZAÇÃO E CONTROLE DE FLUXO (LOAD) ---
window.addEventListener('load', async () => {
    applyTheme(localStorage.getItem('themePreference') || 'light');
    inicializarModeloIA();

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

    // MÁSCARAS DE ENTRADA
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

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            usuarioAtual = session.user;
            atualizarInfosUsuarioTopo();
            const idNoBau = localStorage.getItem('vaga_pendente_importacao');
            if (idNoBau) receberVagaExterna(idNoBau);
        } else if (event === 'SIGNED_OUT') {
            usuarioAtual = null;
            irPara('tela-landing');
        }
    });
});

async function receberVagaExterna(idTransferencia) {
    try {
        exibirLoading(true, "Validando conteúdo da vaga com IA...");
        const { data, error } = await sb.from('transferencias_vagas').select('texto').eq('id', idTransferencia).single();

        if (error || !data) {
            localStorage.removeItem('vaga_pendente_importacao');
            throw new Error("Vaga não encontrada ou link expirado.");
        }

        const textoVaga = data.texto;
        const promptValidacao = `Responda apenas "SIM" se o texto abaixo for uma descrição de vaga de emprego ou "NAO" se for texto aleatório ou erro: ${textoVaga.substring(0, 600)}`;
        const validacao = await chamarIA(promptValidacao);

        if (validacao.includes("NAO")) {
            showToast("⚠️ O conteúdo capturado não parece ser uma vaga válida.");
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
        showToast("✨ Vaga importada e validada com sucesso!");
        await sb.from('transferencias_vagas').delete().eq('id', idTransferencia);
    } catch (e) {
        console.error("Erro na importação:", e);
        localStorage.removeItem('vaga_pendente_importacao');
        irPara('tela-menu');
    } finally {
        exibirLoading(false);
    }
}

async function inicializarModeloIA() {
    try {
        const res = await fetch('/api/modelos');
        const data = await res.json();
        if (data && data.models) {
            const preferidos = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"];
            for (let p of preferidos) {
                if (data.models.some(m => m.name.includes(p))) {
                    modeloIAPreferido = data.models.find(m => m.name.includes(p)).name.split('/').pop();
                    break;
                }
            }
        }
    } catch (e) { console.error("Erro ao buscar modelos", e); }
}

async function chamarIA(prompt) {
    const res = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, modelo: modeloIAPreferido })
    });
    const data = await res.json();
    if (data && data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
    }
    throw new Error("Erro na resposta da IA");
}

function irPara(telaId) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(telaId);
    if (tela) {
        tela.classList.add('ativa');
        historicoTelas.push(telaId);
        window.scrollTo(0, 0);
    }
}

function voltarTela() {
    if (historicoTelas.length > 1) {
        historicoTelas.pop();
        const anterior = historicoTelas[historicoTelas.length - 1];
        document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
        document.getElementById(anterior).classList.add('ativa');
    }
}

async function abrirTelaVaga() {
    irPara('tela-vaga');
}

function exibirLoading(show, texto = "") {
    const overlay = document.getElementById('loading-overlay');
    const txt = document.getElementById('loading-text');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
        if (txt && texto) txt.innerText = texto;
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function applyTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('themePreference', theme);
}

async function verificarAdmin() {
    if (!usuarioAtual) return;
    const { data } = await sb.from('perfil_usuario').select('is_admin').eq('id', usuarioAtual.id).single();
    if (data && data.is_admin) {
        const btn = document.getElementById('btn-admin-painel');
        if (btn) btn.style.display = 'block';
    }
}

function atualizarInfosUsuarioTopo() {
    const el = document.getElementById('user-info-topo');
    if (el && usuarioAtual) {
        el.innerText = `Olá, ${usuarioAtual.email}`;
    }
}

async function recuperarEstadoTela() {
    const logado = !!usuarioAtual;
    if (logado) irPara('tela-menu');
    else irPara('tela-landing');
}