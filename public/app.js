const SUPABASE_URL = 'https://gjrnaavkyalwolldexft.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CPM-CH4JV3muBw_DrGk-zQ_Rii5iGU6';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// SISTEMA DE MONITORAMENTO DE DEBUG (LOGS)
// ==========================================
function logDebug(mensagem, erro = false) {
    const timestamp = new Date().toLocaleTimeString();
    const msgFormatada = `[${timestamp}] ${mensagem}`;

    if (erro) console.error(msgFormatada);
    else console.log(msgFormatada);

    let logs = JSON.parse(localStorage.getItem('edi_logs') || '[]');
    logs.push(msgFormatada);
    if (logs.length > 50) logs.shift(); // Limita a 50 linhas para não pesar
    localStorage.setItem('edi_logs', JSON.stringify(logs));

    // Exibe no painel flutuante se ele já existir
    const painel = document.getElementById('painel-debug-edi');
    if (painel) {
        painel.innerHTML += `<div style="color: ${erro ? '#ff7675' : '#a29bfe'}; margin-bottom: 4px;">${msgFormatada}</div>`;
        painel.scrollTop = painel.scrollHeight;
    }
}

// Cria a caixinha preta de log no canto da tela automaticamente
document.addEventListener('DOMContentLoaded', () => {
    const painel = document.createElement('div');
    painel.id = 'painel-debug-edi';
    painel.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 350px; height: 250px; background: rgba(0,0,0,0.85); color: #fff; font-family: monospace; font-size: 11px; padding: 10px; overflow-y: auto; z-index: 99999; border-radius: 8px; border: 1px solid #6c5ce7; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';
    painel.innerHTML = '<div style="color: #6c5ce7; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 5px; display: flex; justify-content: space-between;"><span>Edi Pro - Log Monitor</span><span style="cursor:pointer; color:red;" onclick="this.parentElement.parentElement.style.display=\'none\'">X</span></div>';
    document.body.appendChild(painel);

    // Mostra os logs antigos ao carregar a página
    const logs = JSON.parse(localStorage.getItem('edi_logs') || '[]');
    logs.forEach(l => {
        painel.innerHTML += `<div style="color: #a29bfe; margin-bottom: 4px;">${l}</div>`;
    });
    painel.scrollTop = painel.scrollHeight;
});

let idAtual = null; let usuarioAtual = null;
let editResumoNode = null, editExpNode = null, editEscNode = null, editIdiNode = null, editHabNode = null;
let modoCriarConta = false;
let ultimasAlteracoesIA = "";
let analiseAtsAtual = null;
let vagaOriginalAtual = ""; // Guarda o texto da vaga para recalcular o ATS depois
let origemAtual = "Criado do zero";
let historicoTelas = [];

// MODELO DE IA PADRÃO (Sendo atualizado via busca de API no load)
let modeloIAPreferido = "gemini-1.5-flash";

// VARIÁVEL DE PROTEÇÃO CONTRA PERDA DE DADOS E GATILHO PARA RECALCULAR ATS
let temAlteracoesNaoSalvas = false;

function marcarAlteracao() {
    temAlteracoesNaoSalvas = true;
    // Se existe uma análise ATS e uma vaga salva, mostra o botão de recalcular
    if (analiseAtsAtual && vagaOriginalAtual) {
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'flex';
    }
}

// === PREVENÇÃO DE PERDA DE DADOS (F5 ou fechar aba) ===
window.addEventListener('beforeunload', function (e) {
    const telaEditor = document.getElementById('tela-editor');
    if (telaEditor && telaEditor.classList.contains('ativa') && temAlteracoesNaoSalvas) {
        e.preventDefault();
        e.returnValue = 'Deseja seguir com a atualização da página? Todos seus dados não salvos serão perdidos!';
        return e.returnValue;
    }
});

// Detectar qualquer digitação no editor para ativar a trava de segurança
document.addEventListener('DOMContentLoaded', () => {
    const editorPanel = document.getElementById('editor');
    if (editorPanel) {
        editorPanel.addEventListener('input', marcarAlteracao);
    }
});

// === LÓGICA DO TOUR/TUTORIAL ===
let passoTour = 0;
const tourTextos = [
    "<b>1. Extração Mágica (IA) ✨</b><br><br>Cole todo o texto do seu LinkedIn ou de um currículo antigo no primeiro menu. A nossa Inteligência Artificial vai ler tudo e preencher todos os campos do editor de forma automática para você!",
    "<b>2. Múltiplas Versões 📑</b><br><br>Para se candidatar a vagas diferentes, use o botão <b>Salvar Cópia</b> no topo da tela. Ele duplica o seu currículo atual, permitindo que você altere informações sem perder a versão original.",
    "<b>3. Gerenciar e Exportar 📄</b><br><br>Na tela inicial do sistema, em <b>Ver Salvos</b>, você gerencia todas as suas versões. Quando o currículo estiver perfeito, é só clicar em <b>Gerar PDF</b> no menu superior!"
];
function iniciarTour() { if (!localStorage.getItem('tourV1')) { document.getElementById('tour-panel').style.display = 'block'; mostrarPassoTour(); } }
function mostrarPassoTour() { document.getElementById('tour-text').innerHTML = tourTextos[passoTour]; }
function proximoTour() { passoTour++; if (passoTour >= tourTextos.length) { fecharTour(); } else { mostrarPassoTour(); } }
function fecharTour() { document.getElementById('tour-panel').style.display = 'none'; localStorage.setItem('tourV1', 'concluido'); }

// === FUNÇÕES BLINDADAS DE DOM E NAVEGAÇÃO ===
function setValSafe(id, val) { const el = document.getElementById(id); if (el) el.value = val || ""; }
function getValSafe(id) { const el = document.getElementById(id); return el ? el.value : ""; }

function fecharAbaPai(elementId) {
    const el = document.getElementById(elementId);
    if (el) { const details = el.closest('details'); if (details) details.removeAttribute('open'); }
}

function syncNome() { const el = document.getElementById('inNome'); const prev = document.getElementById('nomePreview'); if (el && prev) prev.innerText = el.value || "NOME COMPLETO"; }

function atualizarStatusOrigem() {
    const el = document.getElementById('status-origem');
    if (el) el.innerText = "Origem: " + origemAtual;
}

function syncContato() {
    const idade = getValSafe('inIdade'); const end = getValSafe('inEnd'); const email = getValSafe('inEmail'); const whats = getValSafe('inWhats'); const linkedin = getValSafe('inLinkedin'); const pretensao = getValSafe('inPretensao'); const mostrarPretensao = document.getElementById('chkPretensao')?.checked;
    let partes = [];
    if (idade) partes.push(`${idade} anos`); if (end) partes.push(end); if (email) partes.push(email); if (whats) partes.push(whats); if (linkedin) partes.push(linkedin); if (mostrarPretensao && pretensao) partes.push(`Pretensão: ${pretensao}`);
    const prev = document.getElementById('contatoPreview'); if (prev) prev.innerText = partes.length > 0 ? partes.join(' | ') : "...";
}

function mascaraWhats(i) { if (!i) return; let v = i.value.replace(/\D/g, "").replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2"); i.value = v.substring(0, 15); syncContato(); }

// Máscara Estrita de CEP
function mascaraCep(i) {
    if (!i) return;
    let v = i.value.replace(/\D/g, ""); // Arranca tudo que não for número
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    i.value = v.substring(0, 9); // Trava em 9 caracteres
    syncContato();
}

// Máscara Estrita de CPF (Caso adicionado no html futuramente)
function mascaraCpf(i) {
    if (!i) return;
    let v = i.value.replace(/\D/g, "");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    i.value = v.substring(0, 14);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = msg || "✔ Operação realizada com sucesso!";
        t.style.background = msg && msg.includes("login") ? "var(--primary)" : "var(--accent)";
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 4000);
    }
}

const regexSenha = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
function validarSenha(senha) { return regexSenha.test(senha); }

const DEFAULT_PROMPT_SIMPLES = `Você é um especialista em RH. Ajuste o currículo sutilmente. MANTENHA a estrutura e experiências. Retorne APENAS um objeto JSON válido. Formato EXATO: { "titulo_vaga": "Nome", "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "fim":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill"], "email_envio_vaga": "extraia o e-mail para envio de currículo se houver na vaga, senao vazio", "resumo_alteracoes": "O que você focou e melhorou" }`;
const DEFAULT_PROMPT_AGRESSIVO = `Você é um especialista em recrutamento. Ajuste o currículo para ter o MAIOR MATCH POSSÍVEL. Seja agressivo no resumo. Retorne APENAS um objeto JSON válido. Formato EXATO: { "titulo_vaga": "Nome", "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "fim":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill"], "email_envio_vaga": "extraia o e-mail para envio de currículo se houver na vaga, senao vazio", "resumo_alteracoes": "O que você focou, cortou ou adicionou" }`;
const DEFAULT_PROMPT_ATS = `Você é um sistema de triagem de currículos baseado em ATS (Applicant Tracking System) com análise complementar de recrutador humano.
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

function verificarAdmin() {
    if (usuarioAtual && usuarioAtual.email === 'dop.jr82@gmail.com') { const c = document.getElementById('btn-admin-config'); const u = document.getElementById('btn-admin-users'); if (c) c.style.display = 'flex'; if (u) u.style.display = 'flex'; }
    else { const c = document.getElementById('btn-admin-config'); const u = document.getElementById('btn-admin-users'); if (c) c.style.display = 'none'; if (u) u.style.display = 'none'; }
}

function atualizarInfosUsuarioTopo() {
    if (!usuarioAtual) return;
    const displayEmail = document.getElementById('user-email-display');
    const displayName = document.getElementById('user-name-display');
    if (displayEmail) displayEmail.innerText = usuarioAtual.email;
    if (displayName) {
        const nomeMeta = usuarioAtual.user_metadata?.full_name || usuarioAtual.user_metadata?.name || 'Usuário';
        displayName.innerText = `Olá, ${nomeMeta.split(' ')[0]}`;
    }
}

async function atualizarNomeConta() {
    const novoNome = getValSafe('novo-nome');
    if (!novoNome) return alert("Digite o nome desejado.");
    const { data, error } = await sb.auth.updateUser({ data: { full_name: novoNome } });
    if (error) { alert("Erro ao atualizar nome: " + error.message); }
    else {
        usuarioAtual = data.user;
        atualizarInfosUsuarioTopo();
        showToast("Nome atualizado com sucesso!");
    }
}

function abrirConfigAdmin() {
    setValSafe('admin-prompt-simples', localStorage.getItem('adminPromptSimples') || DEFAULT_PROMPT_SIMPLES);
    setValSafe('admin-prompt-agressivo', localStorage.getItem('adminPromptAgressivo') || DEFAULT_PROMPT_AGRESSIVO);
    setValSafe('admin-prompt-ats', localStorage.getItem('adminPromptAts') || DEFAULT_PROMPT_ATS);
    setValSafe('admin-email-suporte', localStorage.getItem('adminEmailSuporte') || 'suporte@cvedipro.com');
    document.getElementById('modal-admin').style.display = 'flex';
}

function salvarConfigAdmin() {
    const pS = getValSafe('admin-prompt-simples').trim();
    const pA = getValSafe('admin-prompt-agressivo').trim();
    const pATS = getValSafe('admin-prompt-ats').trim();
    const emailSuporte = getValSafe('admin-email-suporte').trim();

    if (pS && pA && pATS) {
        localStorage.setItem('adminPromptSimples', pS);
        localStorage.setItem('adminPromptAgressivo', pA);
        localStorage.setItem('adminPromptAts', pATS);
        if (emailSuporte) localStorage.setItem('adminEmailSuporte', emailSuporte);
        document.getElementById('modal-admin').style.display = 'none'; showToast();
    } else { alert("Os prompts não podem ficar vazios."); }
}

async function abrirGestaoUsuarios() {
    irPara('tela-admin-usuarios'); const tabela = document.getElementById('corpo-tabela-usuarios'); if (!tabela) return; tabela.innerHTML = `<tr><td colspan="3" style="text-align: center;">Buscando...</td></tr>`;
    const { data, error } = await sb.rpc('admin_listar_usuarios');
    if (error) { tabela.innerHTML = `<tr><td colspan="3" style="color: red;">Erro: ${error.message}</td></tr>`; return; }
    tabela.innerHTML = ""; if (!data || data.length === 0) { tabela.innerHTML = `<tr><td colspan="3">Nenhum usuário.</td></tr>`; return; }
    data.forEach(u => {
        const ehAdmin = u.email === 'dop.jr82@gmail.com'; const inativo = u.email.includes('_inativo.local');
        let botoesAcao = '-';
        if (!ehAdmin) {
            let btnStatus = inativo
                ? `<button class="btn-base btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="reabilitarUsuarioAdmin('${u.id}', '${u.email}')">Reabilitar</button>`
                : `<button class="btn-base btn-neutral" style="padding: 6px 12px; font-size: 11px;" onclick="deletarUsuarioAdmin('${u.id}', '${u.email}')">Desativar</button>`;

            let btnExcluir = `<button class="btn-base btn-danger" style="padding: 6px 10px; font-size: 12px; border: 1px solid var(--danger);" onclick="excluirUsuarioDefinitivo('${u.id}', '${u.email}')" title="Excluir Definitivamente">🗑️</button>`;

            botoesAcao = `<div style="display: flex; gap: 8px; align-items: center;">${btnStatus}${btnExcluir}</div>`;
        }
        tabela.innerHTML += `<tr><td style="${inativo ? 'text-decoration: line-through; color: #999;' : ''}"><strong>${u.email}</strong> ${ehAdmin ? '(Você)' : ''} ${inativo ? '<span style="color:red; font-size:10px;">[Desativado]</span>' : ''}</td><td>${new Date(u.criado_em).toLocaleDateString('pt-BR')}</td><td>${botoesAcao}</td></tr>`;
    });
}

async function deletarUsuarioAdmin(userId, userEmail) {
    if (confirm(`ATENÇÃO: Deseja suspender o acesso de ${userEmail}?`)) {
        const { error } = await sb.rpc('admin_deletar_usuario', { alvo_id: userId });
        if (error) alert("Erro: " + error.message); else { showToast("Usuário desativado!"); abrirGestaoUsuarios(); }
    }
}

async function reabilitarUsuarioAdmin(userId, userEmail) {
    if (confirm(`Deseja REABILITAR o acesso de ${userEmail}?`)) {
        const { error } = await sb.rpc('admin_reabilitar_usuario', { alvo_id: userId });
        if (error) alert("Erro: O banco de dados não encontrou a função admin_reabilitar_usuario. Certifique-se de criá-la no Supabase."); else { showToast("Usuário reabilitado com sucesso!"); abrirGestaoUsuarios(); }
    }
}

async function excluirUsuarioDefinitivo(userId, userEmail) {
    if (confirm(`⚠️ CUIDADO! Você está prestes a EXCLUIR DEFINITIVAMENTE o usuário:\n\n${userEmail}\n\nEsta ação apagará a conta do banco de dados e NÃO PODE SER DESFEITA. Deseja continuar?`)) {
        const { error } = await sb.rpc('admin_excluir_usuario_definitivo', { alvo_id: userId });
        if (error) alert("Erro ao excluir: " + error.message);
        else { showToast("Usuário excluído permanentemente do sistema!"); abrirGestaoUsuarios(); }
    }
}

function ajustarZoomMobile() {
    const wrapper = document.getElementById('curriculo-wrapper');
    const curriculo = document.getElementById('curriculo');
    if (wrapper && curriculo) {
        if (window.innerWidth <= 1024 && !wrapper.classList.contains('wrapper-fullscreen')) {
            const larguraDisponivel = wrapper.clientWidth - 30;
            let escala = larguraDisponivel / 680;
            curriculo.style.transformOrigin = "top center";
            curriculo.style.transform = `scale(${escala})`;
            wrapper.style.height = `${curriculo.offsetHeight * escala}px`;
            wrapper.scrollTo(0, 0);
        } else if (!wrapper.classList.contains('wrapper-fullscreen')) {
            curriculo.style.transform = "none";
            wrapper.style.height = "auto";
            wrapper.scrollTo(0, 0);
        }
    }
}
window.addEventListener('resize', ajustarZoomMobile);

function toggleFullscreenCV() {
    const wrapper = document.getElementById('curriculo-wrapper');
    const cv = document.getElementById('curriculo');
    if (!wrapper || !cv) return;

    if (wrapper.classList.contains('wrapper-fullscreen')) {
        wrapper.classList.remove('wrapper-fullscreen');
        wrapper.scrollTo(0, 0);
        ajustarZoomMobile();
    } else {
        wrapper.classList.add('wrapper-fullscreen');
        cv.style.transform = "none";
        wrapper.style.height = "100vh";
    }
}

function fecharFullscreenSeguro() {
    const wrapper = document.getElementById('curriculo-wrapper');
    if (wrapper && wrapper.classList.contains('wrapper-fullscreen')) {
        wrapper.classList.remove('wrapper-fullscreen');
        wrapper.scrollTo(0, 0);
        ajustarZoomMobile();
    }
}

// ==========================================
// INICIALIZAÇÃO E INTEGRAÇÃO DE BACKEND
// ==========================================

async function inicializarModeloIA() {
    try {
        const modelResp = await fetch('/api/modelos');
        if (modelResp.ok) {
            const modelData = await modelResp.json();
            const modelosDisponiveis = modelData.models
                .filter(m => m.supportedGenerationMethods.includes("generateContent") && m.name.includes("gemini"))
                .map(m => m.name.split('/')[1]);

            if (modelosDisponiveis.includes("gemini-1.5-flash")) {
                modeloIAPreferido = "gemini-1.5-flash";
            } else if (modelosDisponiveis.includes("gemini-1.5-pro")) {
                modeloIAPreferido = "gemini-1.5-pro";
            } else if (modelosDisponiveis.length > 0) {
                modeloIAPreferido = modelosDisponiveis[0];
            }
            console.log("IA Configurada para modelo rápido:", modeloIAPreferido);
        }
    } catch (e) {
        console.warn("Aviso: Falha ao pré-carregar os modelos da IA, será usado o modelo padrão fallback.");
    }
}

function recuperarEstadoTela() {
    const telaSalva = localStorage.getItem('telaRecuperacao');
    const cvSalvo = localStorage.getItem('cvRecuperacao');

    if (telaSalva === 'tela-editor' && cvSalvo) {
        carregar(cvSalvo);
    } else if (telaSalva === 'tela-editor' && !cvSalvo) {
        irPara('tela-menu');
    } else if (telaSalva && document.getElementById(telaSalva)) {
        if (telaSalva === 'tela-lista') fluxoLista();
        else if (telaSalva === 'tela-vaga') abrirTelaVaga();
        else if (telaSalva === 'tela-admin-usuarios') abrirGestaoUsuarios();
        else irPara(telaSalva);
    } else {
        irPara('tela-menu');
    }
}

window.addEventListener('load', async () => {
    logDebug("=== PÁGINA CARREGADA ===");
    applyTheme(localStorage.getItem('themePreference') || 'light');
    inicializarModeloIA();

    const urlParams = new URLSearchParams(window.location.search);
    const vaga_id = urlParams.get('vaga_id');
    const tituloMobile = urlParams.get('titulo_vaga');
    const textoMobile = urlParams.get('texto_vaga');
    const linkMobile = urlParams.get('link_vaga');

    if (vaga_id) {
        logDebug(`ID da Extensão recebido na URL: ${vaga_id}`);
        localStorage.setItem('vaga_pendente_importacao', vaga_id);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (tituloMobile || textoMobile || linkMobile) {
        logDebug("Vaga Mobile recebida via Share.");
        const conteudoMontado = `[ORIGEM DA VAGA: Celular]\n\n${tituloMobile || ''}\n${textoMobile || ''}\n${linkMobile || ''}`.trim();
        localStorage.setItem('vaga_mobile_pendente', conteudoMontado);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const ultimaAtividade = localStorage.getItem('ultima_atividade_app');
    if (ultimaAtividade && (Date.now() - parseInt(ultimaAtividade) > 7200000)) {
        logDebug("Sessão expirada por inatividade.");
        await sb.auth.signOut(); localStorage.removeItem('ultima_atividade_app'); irPara('tela-landing'); return;
    }

    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        logDebug("Usuário LOGADO detectado.");
        usuarioAtual = session.user;
        localStorage.setItem('ultima_atividade_app', Date.now());
        atualizarInfosUsuarioTopo();
        verificarAdmin();

        const idVagaPendente = localStorage.getItem('vaga_pendente_importacao');
        const textoMobilePendente = localStorage.getItem('vaga_mobile_pendente');

        if (idVagaPendente) {
            logDebug(`Chamando receberVagaExterna() com ID: ${idVagaPendente}`);
            receberVagaExterna(idVagaPendente);
        } else if (textoMobilePendente) {
            logDebug("Processando vaga mobile pendente.");
            receberVagaMobile(textoMobilePendente);
        } else {
            logDebug("Sem vaga pendente. Recuperando estado da tela.");
            recuperarEstadoTela();
        }
    } else {
        logDebug("Usuário DESLOGADO.");
        const idVagaPendente = localStorage.getItem('vaga_pendente_importacao');
        const textoMobilePendente = localStorage.getItem('vaga_mobile_pendente');
        if (idVagaPendente || textoMobilePendente) {
            setTimeout(() => showToast("Faça login ou crie sua conta para concluir a importação da vaga!"), 1000);
        }
        irPara('tela-landing');
    }

    // Monitoramento de login em tempo real
    sb.auth.onAuthStateChange(async (event, session) => {
        logDebug(`Auth State Alterado: ${event}`);
        if (event === 'SIGNED_IN' && session) {
            usuarioAtual = session.user;
            localStorage.setItem('ultima_atividade_app', Date.now());
            atualizarInfosUsuarioTopo();
            verificarAdmin();

            const idVagaPendente = localStorage.getItem('vaga_pendente_importacao');
            const textoMobilePendente = localStorage.getItem('vaga_mobile_pendente');

            if (idVagaPendente) {
                logDebug(`Pós-login: Vaga pendente encontrada. Chamando receberVagaExterna()`);
                receberVagaExterna(idVagaPendente);
            } else if (textoMobilePendente) {
                receberVagaMobile(textoMobilePendente);
            } else {
                const tl = document.getElementById('tela-login'); const tld = document.getElementById('tela-landing');
                if ((tl && tl.classList.contains('ativa')) || (tld && tld.classList.contains('ativa'))) { recuperarEstadoTela(); }
            }
        }
        else if (event === 'SIGNED_OUT') { usuarioAtual = null; verificarAdmin(); irPara('tela-landing'); }
    });
    const cv = document.getElementById('curriculo'); if (cv) { const observer = new MutationObserver(ajustarZoomMobile); observer.observe(cv, { childList: true, subtree: true, characterData: true }); } setTimeout(ajustarZoomMobile, 100);
});

async function receberVagaExterna(idTransferencia) {
    logDebug(`=== Início: receberVagaExterna (${idTransferencia}) ===`);
    if (window.isImportingVaga) {
        logDebug("⛔ Execução bloqueada: Trava anti-colisão ativa (window.isImportingVaga = true).");
        return;
    }
    window.isImportingVaga = true;
    logDebug("Trava anti-colisão ativada.");

    try {
        mostrarCarregamento();
        document.getElementById('loading-text').innerText = "Validando conteúdo da vaga importada...";

        logDebug("Buscando vaga no Supabase...");
        const { data, error } = await sb.from('transferencias_vagas').select('texto').eq('id', idTransferencia).single();

        if (error) {
            logDebug(`❌ ERRO BANCO (Supabase): ${error.message} (Code: ${error.code})`, true);
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        if (!data || !data.texto) {
            logDebug("❌ ERRO: Dados vieram em branco do Supabase.", true);
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        logDebug("✅ Vaga encontrada no banco. Acionando a IA para validação...");
        const textoVaga = data.texto;

        const promptValidacao = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ou requisitos de uma posição? Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Não é uma vaga de emprego válida"}. Texto: ${textoVaga.substring(0, 1000)}`;

        const validacao = await processarIA(promptValidacao);
        logDebug(`Resposta da IA recebida: ${JSON.stringify(validacao)}`);

        if (validacao && validacao.valida === false) {
            logDebug("⛔ IA reprovou o conteúdo da vaga.", true);
            showToast("⚠️ O conteúdo capturado não parece ser uma vaga válida.");
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        logDebug("✅ Vaga Aprovada. Preenchendo a tela...");
        localStorage.removeItem('vaga_pendente_importacao');
        await abrirTelaVaga();

        const txtEl = document.getElementById('texto-vaga');
        if (txtEl) {
            txtEl.value = textoVaga;
            txtEl.dispatchEvent(new Event('input'));
        }

        showToast("✨ Vaga capturada com sucesso! Selecione seu currículo base.");
        logDebug("Deletando vaga temporária do banco...");
        await sb.from('transferencias_vagas').delete().eq('id', idTransferencia);
        logDebug("=== Processo Finalizado com Sucesso ===");

    } catch (e) {
        logDebug(`❌ ERRO FATAL no Try/Catch: ${e.message}`, true);
        console.error(e);
        localStorage.removeItem('vaga_pendente_importacao');
        irPara('tela-menu');
    } finally {
        window.isImportingVaga = false;
        logDebug("Trava anti-colisão liberada.");
        ocultarCarregamento();
    }
}

async function receberVagaMobile(textoCompleto) {
    localStorage.removeItem('vaga_mobile_pendente');
    await abrirTelaVaga();
    const txtEl = document.getElementById('texto-vaga');
    if (txtEl) txtEl.value = textoCompleto;
    showToast("📱 Vaga recebida do celular! Selecione o seu currículo base e clique em Gerar.");
}

function alternarModoLogin() {
    modoCriarConta = !modoCriarConta;
    const bx = document.getElementById('box-confirma-senha'); if (bx) bx.style.display = modoCriarConta ? 'flex' : 'none';
    const bt = document.getElementById('btn-acao-login'); if (bt) bt.innerText = modoCriarConta ? "Criar Conta Segura" : "Entrar no Sistema";
    const tx = document.getElementById('txt-troca-login'); if (tx) tx.innerHTML = modoCriarConta ? `Já tem conta? <a href="#" onclick="alternarModoLogin(); return false;" style="color: var(--primary); font-weight: bold; text-decoration: none;">Entrar</a>` : `Não tem conta? <a href="#" onclick="alternarModoLogin(); return false;" style="color: var(--primary); font-weight: bold; text-decoration: none;">Criar agora</a>`;
}

async function processarFormularioLogin() {
    const email = getValSafe('login-email'); const password = getValSafe('login-senha');
    if (!email || !password) return alert("Preencha e-mail e senha.");
    const msgLog = document.getElementById('msg-login'); if (msgLog) msgLog.style.display = 'block';

    if (modoCriarConta) {
        const conf = getValSafe('login-senha-conf');
        if (password !== conf) { alert("As senhas não coincidem."); if (msgLog) msgLog.style.display = 'none'; return; }
        if (!validarSenha(password)) { alert("A senha deve ter no mínimo 8 caracteres, contendo pelo menos 1 número e 1 letra maiúscula."); if (msgLog) msgLog.style.display = 'none'; return; }
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) { alert("Erro: " + error.message); }
        else { if (data.user && data.user.identities && data.user.identities.length === 0) { alert("E-mail já em uso."); } else { alert("✉️ Link de confirmação enviado! Verifique seu e-mail."); setValSafe('login-email', ""); setValSafe('login-senha', ""); setValSafe('login-senha-conf', ""); alternarModoLogin(); } }
    } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
            if (msgLog) msgLog.style.display = 'none';
            if (error.message.toLowerCase().includes('ban') || error.message.toLowerCase().includes('inativo') || error.message.toLowerCase().includes('suspen') || error.message.toLowerCase().includes('block')) {
                const emailSuporte = localStorage.getItem('adminEmailSuporte') || 'suporte@cvedipro.com';
                document.getElementById('texto-email-suporte').innerText = emailSuporte;
                document.getElementById('modal-bloqueado').style.display = 'flex';
            } else {
                alert("Erro: E-mail ou senha incorretos.");
            }
        }
    }
    if (msgLog) msgLog.style.display = 'none';
}

async function recuperarSenha() { const email = prompt("E-mail para recuperação:"); if (!email) return; const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); if (error) { alert("Erro: " + error.message); } else { alert("✉️ Link enviado se o e-mail existir no sistema."); } }
async function atualizarEmail() { const novoEmail = getValSafe('novo-email'); if (!novoEmail) return alert("Digite o novo e-mail."); const { error } = await sb.auth.updateUser({ email: novoEmail }); if (error) { alert("Erro: " + error.message); } else { alert("✉️ Links enviados para confirmar a troca."); setValSafe('novo-email', ""); } }
async function atualizarSenhaConta() {
    const s1 = getValSafe('nova-senha'); const s2 = getValSafe('nova-senha-conf');
    if (s1 !== s2) return alert("As senhas não coincidem."); if (!validarSenha(s1)) return alert("A senha deve ter no mínimo 8 caracteres, 1 número e 1 letra maiúscula.");
    const { error } = await sb.auth.updateUser({ password: s1 }); if (error) { alert("Erro: " + error.message); } else { alert("Senha atualizada!"); setValSafe('nova-senha', ""); setValSafe('nova-senha-conf', ""); }
}
async function solicitarExclusao() {
    if (usuarioAtual && usuarioAtual.email === 'dop.jr82@gmail.com') { return alert("A conta de administrador principal não pode ser excluída."); }
    if (confirm("TEM CERTEZA? O acesso à sua conta será bloqueado permanentemente e todos os currículos atrelados ao seu e-mail ficarão inacessíveis.")) {
        const { error } = await sb.rpc('desativar_minha_conta');
        if (error) alert("Erro ao desativar: " + error.message); else { await fazerLogout(); alert("Conta desativada com sucesso."); }
    }
}

async function fazerLoginGoogle() {
    const msg = document.getElementById('msg-login'); if (msg) msg.style.display = 'block';
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google' });
    if (error) { alert("Erro: " + error.message); if (msg) msg.style.display = 'none'; }
}

async function fazerLogout() {
    await sb.auth.signOut();
    localStorage.removeItem('ultima_atividade_app');
    localStorage.removeItem('telaRecuperacao');
    localStorage.removeItem('cvRecuperacao');
}

function applyTheme(theme) { if (theme === 'dark') { document.body.classList.add('dark-mode'); const b = document.querySelector('.btn-luz'); if (b) b.innerText = '☀️'; } else { document.body.classList.remove('dark-mode'); const b = document.querySelector('.btn-luz'); if (b) b.innerText = '💡'; } }
function toggleTheme() { const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark'; localStorage.setItem('themePreference', newTheme); applyTheme(newTheme); }

function irPara(id) {
    const telaEditor = document.getElementById('tela-editor');
    const saindoDoEditor = telaEditor && telaEditor.classList.contains('ativa') && id !== 'tela-editor';

    if (saindoDoEditor && temAlteracoesNaoSalvas) {
        if (!confirm("Existem alterações não salvas. Deseja sair desta tela mesmo assim?")) { return; }
        temAlteracoesNaoSalvas = false;
    }

    const telaAtiva = document.querySelector('.tela.ativa');
    if (telaAtiva && telaAtiva.id !== id && telaAtiva.id !== 'tela-landing' && telaAtiva.id !== 'tela-login') {
        historicoTelas.push(telaAtiva.id);
    }
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const dest = document.getElementById(id);
    if (dest) dest.classList.add('ativa');

    if (id !== 'tela-landing' && id !== 'tela-login') {
        localStorage.setItem('telaRecuperacao', id);
        if (idAtual) localStorage.setItem('cvRecuperacao', idAtual);
        else localStorage.removeItem('cvRecuperacao');
    }

    window.scrollTo(0, 0);
    setTimeout(ajustarZoomMobile, 50);
}

function voltarTela() {
    const telaEditor = document.getElementById('tela-editor');
    const saindoDoEditor = telaEditor && telaEditor.classList.contains('ativa');

    if (saindoDoEditor && temAlteracoesNaoSalvas) {
        if (!confirm("Existem alterações não salvas. Deseja sair desta tela mesmo assim?")) { return; }
        temAlteracoesNaoSalvas = false;
    }

    if (historicoTelas.length > 0) {
        const id = historicoTelas.pop();
        document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
        const dest = document.getElementById(id);
        if (dest) dest.classList.add('ativa');

        if (id !== 'tela-landing' && id !== 'tela-login') {
            localStorage.setItem('telaRecuperacao', id);
        }

        window.scrollTo(0, 0);
        setTimeout(ajustarZoomMobile, 50);
    } else {
        irPara('tela-menu');
    }
}

function mostrarCarregamento() { document.getElementById('loading-overlay').style.display = 'flex'; }
function ocultarCarregamento() { document.getElementById('loading-overlay').style.display = 'none'; }
function mostrarAlteracoes() {
    document.getElementById('texto-alteracoes-ia').innerText = ultimasAlteracoesIA || "Nenhum resumo de alteração foi gerado pela IA para este currículo.";
    document.getElementById('modal-alteracoes').style.display = 'flex';
}

// ==== RENDERIZAÇÃO E CARREGAMENTO DO PAINEL ATS ====
function mostrarCarregamentoATS(abrirPainel = true) {
    const detailsAts = document.getElementById('details-ats');
    const painelConteudo = document.getElementById('painel-ats-conteudo');
    const badgeScore = document.getElementById('badge-score-ats');
    const titulo = document.getElementById('titulo-ats-lateral');

    if (titulo) titulo.innerText = "⏳ Analisando vaga...";
    if (badgeScore) {
        badgeScore.innerHTML = " ... ";
        badgeScore.style.background = "var(--text-light)";
    }

    if (painelConteudo) {
        // Novo visual com animação de pulsação e brilho
        painelConteudo.innerHTML = `
                <div style="text-align:center; padding: 30px 15px; display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div class="ai-loader-circle"></div>
                    <div class="ai-loading-text">
                        A Inteligência Artificial está calculando o seu Score e separando os pontos de atenção da vaga.
                    </div>
                    <span style="font-size:11px; color: var(--text-light); letter-spacing: 1px; opacity: 0.7;">PROCESSANDO DADOS...</span>
                </div>
            `;
    }

    if (detailsAts) {
        detailsAts.style.display = 'block';
        if (abrirPainel) detailsAts.setAttribute('open', 'true');
    }
}

function renderizarATS(dados) {
    const detailsAts = document.getElementById('details-ats');
    const painelConteudo = document.getElementById('painel-ats-conteudo');
    const badgeScore = document.getElementById('badge-score-ats');
    const titulo = document.getElementById('titulo-ats-lateral');

    if (!dados || !painelConteudo || !badgeScore) { if (detailsAts) detailsAts.style.display = 'none'; return; }

    if (titulo) titulo.innerText = "📊 Análise da Vaga";

    const pontuacao = dados.score || 0;
    let corScore = pontuacao >= 75 ? 'var(--accent)' : (pontuacao >= 50 ? '#f39c12' : 'var(--danger)');

    badgeScore.innerHTML = `<span style="font-size: 10px; font-weight: normal; opacity: 0.9; margin-right: 4px; letter-spacing: 0.5px;">SCORE</span>${pontuacao}`;
    badgeScore.style.background = corScore;

    let riscoTxt = (dados.risco || "").toLowerCase();
    let corRisco = riscoTxt.includes('baixo') ? 'var(--accent)' : (riscoTxt.includes('médio') || riscoTxt.includes('medio') ? '#f39c12' : 'var(--danger)');

    let html = `
            <div style="font-size: 13px; margin-bottom: 15px; background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                <strong>Risco de Eliminação:</strong> <span style="color: ${corRisco}; font-weight: bold;">${dados.risco || 'Não avaliado'}</span><br>
                <span style="color: var(--text-light); font-size: 11px;">${dados.motivo_risco || ''}</span>
            </div>
        `;

    if (dados.pontos_fortes && dados.pontos_fortes.length > 0) {
        html += `<div style="margin-bottom: 10px;"><strong style="color: var(--accent); font-size: 13px;">🔵 Pontos Fortes (Match Alto):</strong><ul style="margin: 5px 0; padding-left: 20px; font-size: 12px; color: var(--text-main);">${dados.pontos_fortes.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
    }
    if (dados.pontos_medios && dados.pontos_medios.length > 0) {
        html += `<div style="margin-bottom: 10px;"><strong style="color: #f39c12; font-size: 13px;">🟡 Pontos Médios (Parcial):</strong><ul style="margin: 5px 0; padding-left: 20px; font-size: 12px; color: var(--text-main);">${dados.pontos_medios.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
    }
    if (dados.pontos_fracos && dados.pontos_fracos.length > 0) {
        html += `<div style="margin-bottom: 10px;"><strong style="color: var(--danger); font-size: 13px;">🔴 Pontos Ausentes ou Gaps (Gap):</strong><ul style="margin: 5px 0; padding-left: 20px; font-size: 12px; color: var(--text-main);">${dados.pontos_fracos.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
    }
    if (dados.sugestoes && dados.sugestoes.length > 0) {
        html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed var(--border-color);"><strong style="color: var(--primary); font-size: 13px;">💡 Sugestões Práticas de Melhoria:</strong><ul style="margin: 5px 0; padding-left: 20px; font-size: 12px; color: var(--text-main);">${dados.sugestoes.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
    }

    painelConteudo.innerHTML = html;
    detailsAts.style.display = 'block';
}

function calcularIdadeOnboarding() { const dateInput = getValSafe('onb-data'); if (dateInput) { const diff = Date.now() - new Date(dateInput).getTime(); const age = new Date(diff); setValSafe('onb-idade', Math.abs(age.getUTCFullYear() - 1970)); } }
function calcularIdadeEditor() { const dateInput = getValSafe('inData'); if (dateInput) { const diff = Date.now() - new Date(dateInput).getTime(); const age = new Date(diff); setValSafe('inIdade', Math.abs(age.getUTCFullYear() - 1970)); syncContato(); } }

function fecharOnboarding() {
    const mod = document.getElementById('modal-onboarding'); if (mod) mod.style.display = 'none';
    irPara('tela-menu');
}

function fluxoNovo() {
    idAtual = null;
    localStorage.removeItem('cvRecuperacao');
    limparTudo();
    const st = document.getElementById('status-nome'); if (st) st.innerText = "📄 Currículo: NOVO";

    // Auto preencher e-mail e nome (se vier do google)
    if (usuarioAtual) {
        setValSafe('onb-email', usuarioAtual.email);
        if (usuarioAtual.user_metadata?.full_name || usuarioAtual.user_metadata?.name) {
            setValSafe('onb-nome', usuarioAtual.user_metadata.full_name || usuarioAtual.user_metadata.name);
        }
    }

    const mod = document.getElementById('modal-onboarding'); if (mod) mod.style.display = 'flex';
}

function salvarOnboardingEContinuar() {
    const n = getValSafe('onb-nome'); const e = getValSafe('onb-email'); const w = getValSafe('onb-whats');
    if (!n || !e || w === undefined) return alert("Por favor, preencha os campos obrigatórios para criar a base do seu currículo.");

    setValSafe('inNome', n); setValSafe('inEmail', e); setValSafe('inWhats', w); setValSafe('inData', getValSafe('onb-data')); setValSafe('inIdade', getValSafe('onb-idade')); setValSafe('inCep', getValSafe('onb-cep')); setValSafe('inEnd', getValSafe('onb-end')); setValSafe('inLinkedin', getValSafe('onb-linkedin')); setValSafe('inVaga', getValSafe('onb-vaga')); setValSafe('inStatus', getValSafe('onb-status')); setValSafe('inPretensao', getValSafe('onb-pretensao'));
    const whatsEl = document.getElementById('inWhats'); if (whatsEl) mascaraWhats(whatsEl);
    const cepEl = document.getElementById('inCep'); if (cepEl) mascaraCep(cepEl);
    syncNome(); syncContato();
    const mod = document.getElementById('modal-onboarding'); if (mod) mod.style.display = 'none';

    document.getElementById('panel-ia-extracao').style.display = 'block';

    origemAtual = "Criado do zero";
    atualizarStatusOrigem();

    marcarAlteracao(); // Aciona o bloqueio ao começar a criar
    irPara('tela-editor'); iniciarTour();
}

// ==== GESTÃO DE CURRÍCULO PADRÃO ====
function definirPadrao(id) {
    if (!usuarioAtual) return;
    localStorage.setItem('cv_padrao_' + usuarioAtual.id, id);
    showToast("⭐ Currículo Padrão atualizado!");
    fluxoLista(); // Recarrega a lista para mostrar a estrela
}

async function fluxoLista() {
    irPara('tela-lista'); const grid = document.getElementById('grid-salvos'); if (!grid) return; grid.innerHTML = "<p>Carregando...</p>";

    const padraoId = localStorage.getItem('cv_padrao_' + usuarioAtual.id);

    const { data, error } = await sb.from('curriculos_saas').select('identificador').eq('user_id', usuarioAtual.id).order('identificador', { ascending: true });
    grid.innerHTML = "";

    if (!data || data.length === 0) { grid.innerHTML = "<p>Nenhum currículo salvo.</p>"; return; }

    grid.innerHTML = `
            <div style="grid-column: 1 / -1; background: var(--primary-dim); border: 1px solid var(--primary); padding: 15px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; color: var(--text-main);">
                <strong>💡 Dica de Mestre:</strong> Crie um currículo contendo <b>todas</b> as suas experiências, habilidades e formações (mesmo que fique grande). Salve-o e depois clique em <b>"⭐ Definir Padrão"</b>. Ele será a sua base oficial para a IA gerar currículos perfeitos para cada vaga!
            </div>
        `;

    data.forEach(item => {
        const isPadrao = item.identificador === padraoId;
        const btnPadrao = isPadrao
            ? `<span style="font-size: 12px; color: var(--primary); font-weight: bold;">⭐ Padrão da Conta</span>`
            : `<button class="btn-base btn-neutral" style="padding: 6px 12px; font-size:11px;" onclick="definirPadrao('${item.identificador}')">⭐ Definir Padrão</button>`;

        const card = document.createElement('div'); card.className = "card-salvo";
        card.innerHTML = `
                <strong style="cursor:pointer; flex:1; min-width: 150px;" onclick="carregar('${item.identificador}')">${item.identificador}</strong>
                <div style="display:flex; gap:10px; align-items: center; flex-wrap: wrap;">
                    ${btnPadrao}
                    <button class="btn-base btn-neutral" style="padding: 6px 12px; font-size:12px;" onclick="duplicar('${item.identificador}')">📑 Duplicar</button>
                    <button class="btn-base btn-danger" onclick="deletar('${item.identificador}')">🗑️ Apagar</button>
                </div>
            `;
        if (isPadrao) card.style.borderLeft = "5px solid var(--accent)";
        grid.appendChild(card);
    });
}

async function duplicar(idOriginal) {
    const novoId = prompt("Nome para a cópia (ex: Versão 2):", idOriginal + " - Cópia"); if (!novoId) return;
    const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', idOriginal).eq('user_id', usuarioAtual.id).single();
    if (data) {
        const payload = { identificador: novoId, user_id: usuarioAtual.id, conteudo: data.conteudo };
        const { error } = await sb.from('curriculos_saas').insert(payload);
        if (error) alert("Erro ao duplicar: O nome já deve existir."); else { showToast(); fluxoLista(); }
    }
}

async function salvarComo() { if (!idAtual) return alert("Por favor, guarde o currículo normalmente primeiro antes de criar uma cópia."); const novoId = prompt("Guardar como nova versão. Escreva o novo nome:", idAtual + " - v2"); if (!novoId) return; idAtual = novoId; await salvar(); }

async function salvar() {
    const id = idAtual || prompt("Nome do currículo (ex: TI Banco Itaú):"); if (!id) return; const regexClean = /\[editar\]|\[remover\]|\[x\]/g;
    const payload = {
        identificador: id, user_id: usuarioAtual.id,
        conteudo: {
            origem: origemAtual,
            analise_ats: analiseAtsAtual, // Salva o resultado do ATS
            vaga_original: vagaOriginalAtual, // Guarda a vaga para recalcular no futuro
            pessoais: { nome: getValSafe('inNome'), data: getValSafe('inData'), idade: getValSafe('inIdade'), cep: getValSafe('inCep'), end: getValSafe('inEnd'), email: getValSafe('inEmail'), whats: getValSafe('inWhats'), linkedin: getValSafe('inLinkedin'), vaga: getValSafe('inVaga'), status: getValSafe('inStatus'), pretensao: getValSafe('inPretensao'), mostrarPretensao: document.getElementById('chkPretensao')?.checked },
            resumo: Array.from(document.querySelectorAll('#preRes .texto-justificado')).map(el => el.innerText.replace(regexClean, '').trim()),
            experiencias: Array.from(document.querySelectorAll('.bloco-exp')).map(el => ({ cargo: el.querySelector('.exp-header span:first-child').innerText, data: el.querySelector('.exp-header span:last-child').innerText, empresa: el.querySelector('.exp-empresa').innerText, desc: el.querySelector('.texto-justificado').innerText.replace(regexClean, '').trim() })),
            escolaridade: Array.from(document.querySelectorAll('#preEsc .item-lista')).map(el => el.innerText.replace(regexClean, '').trim()),
            idiomas: Array.from(document.querySelectorAll('#preIdi .item-lista')).map(el => el.innerText.replace(regexClean, '').trim()),
            habilidades: Array.from(document.querySelectorAll('#preHab .item-lista')).map(el => el.innerText.replace(regexClean, '').trim())
        }
    };
    const { error } = await sb.from('curriculos_saas').upsert(payload, { onConflict: 'identificador, user_id' });
    if (!error) {
        idAtual = id;
        localStorage.setItem('cvRecuperacao', idAtual);
        const sn = document.getElementById('status-nome'); if (sn) sn.innerText = "📄 Currículo: " + id;

        temAlteracoesNaoSalvas = false; // Desbloqueia fechamento seguro

        showToast();
    } else { alert("Erro ao salvar."); }
}

async function carregar(id) {
    const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', id).eq('user_id', usuarioAtual.id).single();
    if (data) {
        limparTudo(); idAtual = id;
        localStorage.setItem('cvRecuperacao', idAtual);
        const sn = document.getElementById('status-nome'); if (sn) sn.innerText = "📄 Currículo: " + id;
        const c = data.conteudo || {}; const regexLimpa = /\[editar\]|\[remover\]|\[x\]/g;

        origemAtual = c.origem || "Não identificada";
        atualizarStatusOrigem();

        vagaOriginalAtual = c.vaga_original || "";

        // Carrega análise ATS se existir
        analiseAtsAtual = c.analise_ats || null;
        if (analiseAtsAtual) {
            renderizarATS(analiseAtsAtual);
            const atsPainel = document.getElementById('details-ats');
            if (atsPainel) atsPainel.removeAttribute('open'); // Mantém fechado se for carregamento antigo
        }

        if (c.dados_mercado) { setValSafe('inData', c.dados_mercado.data || ""); setValSafe('inIdade', c.dados_mercado.idade || ""); setValSafe('inVaga', c.dados_mercado.vaga || ""); setValSafe('inStatus', c.dados_mercado.status || "Ativo (Empregado)"); setValSafe('inPretensao', c.dados_mercado.pretensao || ""); }
        if (c.pessoais) {
            setValSafe('inNome', c.pessoais.nome || "");
            if (c.pessoais.data) setValSafe('inData', c.pessoais.data);
            if (c.pessoais.idade) setValSafe('inIdade', c.pessoais.idade);
            setValSafe('inEnd', c.pessoais.end || ""); setValSafe('inCep', c.pessoais.cep || ""); setValSafe('inEmail', c.pessoais.email || ""); setValSafe('inLinkedin', c.pessoais.linkedin || ""); setValSafe('inVaga', c.pessoais.vaga || c.dados_mercado?.vaga || ""); setValSafe('inStatus', c.pessoais.status || c.dados_mercado?.status || "Ativo (Empregado)"); setValSafe('inPretensao', c.pessoais.pretensao || c.dados_mercado?.pretensao || "");
            const chk = document.getElementById('chkPretensao'); if (chk) chk.checked = !!c.pessoais.mostrarPretensao;
            const inputWhats = document.getElementById('inWhats'); if (inputWhats && c.pessoais.whats) { inputWhats.value = c.pessoais.whats; mascaraWhats(inputWhats); }
        }
        syncNome(); syncContato();

        if (c.resumo) c.resumo.forEach(r => adicionarResumo(r.replace(regexLimpa, '')));
        if (c.experiencias) c.experiencias.forEach(e => { const dates = e.data ? e.data.split(' — ') : ["", ""]; adicionarExperiencia({ cargo: e.cargo || "", empresa: e.empresa || "", ini: dates[0] || "", fim: dates[1] || "", desc: (e.desc || "").replace(regexLimpa, '') }); });
        if (c.escolaridade) c.escolaridade.forEach(esc => { const raw = esc.replace(regexLimpa, ''); const p = raw.split(':'); adicionarEscolaridade({ curso: p[0] ? p[0].trim() : "", status: p[1] ? p[1].trim() : "" }); });
        if (c.idiomas) c.idiomas.forEach(i => { const p = i.replace(regexLimpa, '').split(':'); adicionarIdioma({ nome: p[0] ? p[0].trim() : "", nivel: p[1] ? p[1].trim() : "" }); });
        if (c.habilidades) c.habilidades.forEach(h => adicionarHabilidade(h.replace(regexLimpa, '')));

        document.getElementById('panel-ia-extracao').style.display = 'none';

        temAlteracoesNaoSalvas = false; // Acabou de carregar, não há alterações
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'none';

        irPara('tela-editor'); iniciarTour();
    }
}

async function deletar(id) {
    if (confirm(`Tem certeza que deseja apagar o currículo "${id}" definitivamente?`)) {
        const { error } = await sb.from('curriculos_saas').delete().eq('identificador', id).eq('user_id', usuarioAtual.id);
        if (error) {
            alert("Erro ao apagar: " + error.message);
        } else {
            showToast("🗑️ Currículo apagado com sucesso!");
            fluxoLista(); // Agora sim, recarrega a lista corretamente!
        }
    }
}

async function abrirTelaVaga() {
    irPara('tela-vaga');
    const select = document.getElementById('select-curriculo-base'); if (!select) return;
    select.innerHTML = "<option>Carregando...</option>";
    const aviso = document.getElementById('aviso-cv-incompleto'); if (aviso) aviso.style.display = 'none';

    const { data, error } = await sb.from('curriculos_saas').select('identificador').eq('user_id', usuarioAtual.id);
    if (error || !data || data.length === 0) { select.innerHTML = "<option value=''>Nenhum currículo salvo.</option>"; return; }

    const padraoId = localStorage.getItem('cv_padrao_' + usuarioAtual.id);

    select.innerHTML = "<option value=''>-- Selecione o seu currículo --</option>";
    data.forEach(item => {
        const isSelected = item.identificador === padraoId ? 'selected' : '';
        select.innerHTML += `<option value="${item.identificador}" ${isSelected}>${item.identificador} ${item.identificador === padraoId ? '(⭐ Padrão)' : ''}</option>`;
    });

    if (padraoId) verificarCurriculoBase(); // Executa validação se já puxou o default
}

// VALIDAÇÃO EM TEMPO REAL DO CURRÍCULO BASE
async function verificarCurriculoBase() {
    const idBase = getValSafe('select-curriculo-base');
    const aviso = document.getElementById('aviso-cv-incompleto');
    if (!idBase || !aviso) { aviso.style.display = 'none'; return; }

    try {
        const { data } = await sb.from('curriculos_saas').select('conteudo').eq('identificador', idBase).eq('user_id', usuarioAtual.id).single();
        if (data && data.conteudo) {
            const c = data.conteudo;
            let valido = true;

            let resumoText = c.resumo ? c.resumo.join(' ') : '';
            if (resumoText.length < 50) valido = false;
            if (!c.experiencias || c.experiencias.length === 0) valido = false;
            if (!c.habilidades || c.habilidades.length === 0) valido = false;

            if (!valido) { aviso.style.display = 'block'; } else { aviso.style.display = 'none'; }
        }
    } catch (e) { console.error("Erro validação base", e); }
}

async function processarIA(promptContent) {
    let respostaBruta = "";
    try {
        const response = await fetch('/api/ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptContent, modelo: modeloIAPreferido })
        });

        if (!response.ok) throw new Error("Falha na API interna.");

        const dataResp = await response.json();
        respostaBruta = dataResp.candidates[0].content.parts[0].text;

        const inicioJson = respostaBruta.indexOf('{');
        const fimJson = respostaBruta.lastIndexOf('}');

        if (inicioJson === -1 || fimJson === -1) {
            const terr = document.getElementById('texto-bruto-erro'); const merr = document.getElementById('modal-erro-ia');
            if (terr && merr) { terr.value = respostaBruta; merr.style.display = 'flex'; }
            throw new Error("Erro JSON.");
        }
        try { return JSON.parse(respostaBruta.substring(inicioJson, fimJson + 1)); }
        catch (e) {
            const terr = document.getElementById('texto-bruto-erro'); const merr = document.getElementById('modal-erro-ia');
            if (terr && merr) { terr.value = respostaBruta; merr.style.display = 'flex'; }
            throw new Error("Erro JSON.");
        }
    } catch (err) {
        throw err;
    }
}

async function extrairDadosIA() {
    const txt = getValSafe('texto-ia');
    if (!txt) return alert("Cole texto!");

    mostrarCarregamento();
    document.getElementById('loading-text').innerText = "Processando Inteligência Artificial...";

    const prompt = `Aja como conversor estrito de texto para JSON. Formato obrigatório: { "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "texto", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "status":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill1"] } STATUS FORMAÇÃO: Obrigatório retornar um dos: "Concluído", "Cursando", "Trancado". Texto: ${txt}`;

    try {
        const extraido = await processarIA(prompt);
        limparTudo();
        idAtual = null;
        localStorage.removeItem('cvRecuperacao');
        const sn = document.getElementById('status-nome'); if (sn) sn.innerText = "📄 Currículo: NOVO";

        origemAtual = "Extraído via IA (Texto colado)";
        atualizarStatusOrigem();

        preencherEditor(extraido);
        marcarAlteracao(); // Aciona trava de F5
    } catch (err) {
        if (err.message !== "Erro JSON.") alert("Erro: " + err.message);
    } finally {
        ocultarCarregamento();
    }
}

// Função separada para gerar o ATS assincronamente sem travar a tela
async function gerarAtsEmSegundoPlano(textoVaga, curriculoAdaptado, abrirPainel = true) {
    mostrarCarregamentoATS(abrirPainel);
    try {
        const promptAtsBase = localStorage.getItem('adminPromptAts') || DEFAULT_PROMPT_ATS;
        const promptFinalAts = promptAtsBase.replace('{{VAGA}}', textoVaga).replace('{{CURRICULO}}', JSON.stringify(curriculoAdaptado));

        const resultadoAts = await processarIA(promptFinalAts);
        analiseAtsAtual = resultadoAts;
        renderizarATS(resultadoAts);
    } catch (errAts) {
        console.error("Erro na Análise ATS assíncrona.", errAts);
        const titulo = document.getElementById('titulo-ats-lateral');
        if (titulo) titulo.innerText = "⚠️ Erro ao gerar Score. Tente novamente.";
    }
}

// Botão de Recalcular ATS Manualmente
async function acionarRecalculoATS(e) {
    e.stopPropagation(); // Previne abrir/fechar o painel de details
    const btn = document.getElementById('btn-recalcular-ats');

    // Proteção contra múltiplos cliques (Rate Limit)
    btn.disabled = true;
    btn.innerText = "⏳";
    btn.style.opacity = "0.7";
    btn.style.cursor = "not-allowed";

    // Montar o JSON atual do currículo diretamente da tela (simulando a IA)
    const regexClean = /\[editar\]|\[remover\]|\[x\]/g;
    const cvAtualMontado = {
        nome: getValSafe('inNome'),
        resumo: Array.from(document.querySelectorAll('#preRes .texto-justificado')).map(el => el.innerText.replace(regexClean, '').trim()).join('\n'),
        experiencias: Array.from(document.querySelectorAll('.bloco-exp')).map(el => ({
            cargo: el.querySelector('.exp-header span:first-child').innerText,
            fim: el.querySelector('.exp-header span:last-child').innerText,
            empresa: el.querySelector('.exp-empresa').innerText,
            desc: el.querySelector('.texto-justificado').innerText.replace(regexClean, '').trim()
        })),
        formacao: Array.from(document.querySelectorAll('#preEsc .item-lista')).map(el => {
            const raw = el.dataset.raw ? JSON.parse(el.dataset.raw) : {};
            return { curso: raw.curso || el.innerText.replace(regexClean, '').trim(), status: raw.status || "" };
        }),
        idiomas: Array.from(document.querySelectorAll('#preIdi .item-lista')).map(el => ({ nome: el.innerText.replace(regexClean, '').trim() })),
        habilidades: Array.from(document.querySelectorAll('#preHab .item-lista')).map(el => el.innerText.replace(regexClean, '').trim())
    };

    // Chama a API passando a vaga que ficou salva em memória
    await gerarAtsEmSegundoPlano(vagaOriginalAtual, cvAtualMontado, false);

    // Restaura e esconde o botão, só vai aparecer na próxima alteração
    btn.innerText = "🔄";
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.style.display = 'none';
}

async function ajustarCurriculoVaga() {
    const idBase = getValSafe('select-curriculo-base'); const textoVaga = getValSafe('texto-vaga'); const nivelAjuste = getValSafe('nivel-ajuste');
    if (!idBase || !textoVaga) return alert("Preencha todos os campos da tela.");

    mostrarCarregamento();

    try {
        // PASSO 1: VALIDAÇÃO DA VAGA PELA IA
        document.getElementById('loading-text').innerText = "Analisando a vaga...";
        const promptValidacao = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ou requisitos de uma posição? Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Explique resumidamente por que não parece uma vaga"}. Texto: ${textoVaga.substring(0, 1500)}`;
        const validacao = await processarIA(promptValidacao);

        if (validacao && validacao.valida === false) {
            ocultarCarregamento();
            alert("⚠️ Aviso da IA: " + (validacao.motivo || "O texto inserido não parece conter os dados de uma vaga de emprego."));
            return;
        }

        // PASSO 2: CRUZAMENTO DOS DADOS (SE PASSOU PELA VALIDAÇÃO)
        document.getElementById('loading-text').innerText = "Reescrevendo o seu currículo...";

        const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', idBase).eq('user_id', usuarioAtual.id).single();
        if (!data) throw new Error("Erro ao ler currículo base."); const c = data.conteudo; const regexLimpa = /\[editar\]|\[remover\]|\[x\]/g;
        const dadosDoCandidato = { nome: c.pessoais.nome, endereco: c.pessoais.end, cep: c.pessoais.cep, email: c.pessoais.email, whatsapp: c.pessoais.whats, linkedin: c.pessoais.linkedin, resumo: c.resumo ? c.resumo.join("\n").replace(regexLimpa, '') : "", experiencias: c.experiencias ? c.experiencias.map(e => { const dates = e.data.split(' — '); return { cargo: e.cargo, empresa: e.empresa, ini: dates[0] || "", fim: dates[1] || "", desc: e.desc.replace(regexLimpa, '') }; }) : [], formacao: c.escolaridade ? c.escolaridade.map(esc => { const p = esc.replace(regexLimpa, '').split(':'); return { curso: p[0] ? p[0].trim() : "", inst: "", ini: "", status: p[1] ? p[1].trim() : "" } }) : [], idiomas: c.idiomas ? c.idiomas.map(i => { const p = i.replace(regexLimpa, '').split(':'); return { nome: p[0] ? p[0].trim() : "", nivel: p[1] ? p[1].trim() : "" }; }) : [], habilidades: c.habilidades ? c.habilidades.map(h => h.replace(regexLimpa, '')) : [] };
        const basePrompt = nivelAjuste === 'agressivo' ? (localStorage.getItem('adminPromptAgressivo') || DEFAULT_PROMPT_AGRESSIVO) : (localStorage.getItem('adminPromptSimples') || DEFAULT_PROMPT_SIMPLES);

        // Adicionando instrução para reescrever formatação mantendo status
        const promptAjustado = basePrompt + ` STATUS FORMAÇÃO: Obrigatório manter/reescrever para um dos: "Concluído", "Cursando", "Trancado".`;

        const prompt = `${promptAjustado} DADOS: ${JSON.stringify(dadosDoCandidato)} VAGA: ${textoVaga}`;

        const extraido = await processarIA(prompt);

        limparTudo();

        // Salvando a vaga na variável global para o ATS Recalcular depois
        vagaOriginalAtual = textoVaga;

        // VERIFICAR E-MAIL DE ENVIO DA VAGA
        const alertaMail = document.getElementById('alerta-email-vaga');
        if (extraido.email_envio_vaga && extraido.email_envio_vaga.includes('@')) {
            document.getElementById('texto-email-vaga').innerText = extraido.email_envio_vaga;
            alertaMail.style.display = 'block';
        }

        if (extraido.resumo_alteracoes) {
            ultimasAlteracoesIA = extraido.resumo_alteracoes;
            document.getElementById('btn-ver-alteracoes').style.display = 'inline-flex';
        }

        let matchOrigem = textoVaga.match(/\[ORIGEM DA VAGA: (.*?)\]/);
        if (matchOrigem) {
            origemAtual = `Extração Nativa (${matchOrigem[1]})`;
        } else {
            origemAtual = `Adaptado da vaga (Texto copiado)`;
        }
        atualizarStatusOrigem();

        const primeiroNome = (extraido.nome || "Candidato").split(" ")[0]; const tituloVagaFormatado = extraido.titulo_vaga || "Vaga Ajustada"; idAtual = `${primeiroNome} - ${tituloVagaFormatado}`;

        localStorage.setItem('cvRecuperacao', idAtual);
        const sn = document.getElementById('status-nome'); if (sn) sn.innerText = "📄 Currículo: " + idAtual;

        if (c.pessoais) {
            setValSafe('inData', c.pessoais.data || ""); setValSafe('inIdade', c.pessoais.idade || "");
            setValSafe('inVaga', c.pessoais.vaga || ""); setValSafe('inStatus', c.pessoais.status || "Ativo (Empregado)");
            setValSafe('inPretensao', c.pessoais.pretensao || "");
            const chk = document.getElementById('chkPretensao'); if (chk) chk.checked = !!c.pessoais.mostrarPretensao;
        }

        document.getElementById('panel-ia-extracao').style.display = 'none';

        preencherEditor(extraido);
        marcarAlteracao();

        // Redireciona rapidamente para a tela de editor
        irPara('tela-editor');

        // Inicia o cálculo do ATS em segundo plano para não travar a UX do usuário
        gerarAtsEmSegundoPlano(textoVaga, extraido);

        // Esconde o botão de recalcular (pois acabou de gerar do zero)
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'none';

    } catch (err) {
        if (err.message !== "Erro JSON.") alert("Erro: " + err.message);
    } finally {
        ocultarCarregamento();
    }
}

function editarResumo(btn) { fecharFullscreenSeguro(); const div = btn.parentElement.parentElement; const raw = JSON.parse(div.dataset.raw); setValSafe('resIn', raw.texto); if (editResumoNode) { editResumoNode.style.borderLeft = "none"; editResumoNode.style.paddingLeft = "0"; } editResumoNode = div; div.style.borderLeft = "3px solid var(--primary)"; div.style.paddingLeft = "10px"; const inputEdit = document.getElementById('resIn'); if (inputEdit) { inputEdit.closest('details').open = true; inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputEdit.focus(); } const btnAdd = document.getElementById('btn-add-res'); if (btnAdd) { btnAdd.innerText = "💾 Salvar Edição"; btnAdd.classList.replace('btn-primary', 'btn-accent'); } }
function adicionarResumo(txt = null) {
    let val = txt || getValSafe('resIn');
    if (!val) return;

    // Passa o texto pelo higienizador
    val = higienizarTexto(val);

    const rawStr = JSON.stringify({ texto: val });
    // Adicionado o white-space: pre-wrap para respeitar os 'Enters'
    const htmlStr = `<div style="white-space: pre-wrap;">${val}</div> <div style="text-align:right; margin-top:5px"><small style="color:var(--primary);cursor:pointer;padding:5px;" onclick="editarResumo(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:8px;padding:5px;" onclick="this.parentElement.parentElement.remove(); marcarAlteracao();">[remover]</small></div>`;
    if (!txt && editResumoNode) { editResumoNode.dataset.raw = rawStr; editResumoNode.innerHTML = htmlStr; editResumoNode.style.borderLeft = "none"; editResumoNode.style.paddingLeft = "0"; editResumoNode = null; } else { const div = document.createElement('div'); div.className = 'texto-justificado'; div.dataset.raw = rawStr; div.innerHTML = htmlStr; const pr = document.getElementById('preRes'); if (pr) pr.appendChild(div); } setValSafe('resIn', ""); const btnAdd = document.getElementById('btn-add-res'); if (btnAdd) { btnAdd.innerText = "+ Adicionar Resumo"; btnAdd.classList.replace('btn-accent', 'btn-primary'); } fecharAbaPai('resIn'); marcarAlteracao();
}

// Função auxiliar para converter "MM/AAAA" ou "Atual" em números para ordenação
function parseDataParaSort(dataStr) {
    if (!dataStr) return 0;
    const str = dataStr.toLowerCase().trim();
    if (str === "até o momento" || str === "atual") return 999999;

    const matchMMAAAA = str.match(/(\d{1,2})\/(\d{4})/);
    if (matchMMAAAA) return parseInt(matchMMAAAA[2]) * 100 + parseInt(matchMMAAAA[1]);

    const matchAAAA = str.match(/(\d{4})/);
    if (matchAAAA) return parseInt(matchAAAA[1]) * 100;

    return 0;
}

// Função que reorganiza os blocos na tela
function reordenarExperienciasDOM() {
    const container = document.getElementById('preExp');
    if (!container) return;
    const blocos = Array.from(container.querySelectorAll('.bloco-exp'));

    blocos.sort((a, b) => {
        const textoDataA = a.querySelector('.exp-header span:last-child')?.innerText || "";
        const textoDataB = b.querySelector('.exp-header span:last-child')?.innerText || "";

        const fimA = textoDataA.split('—')[1] || textoDataA.split('—')[0];
        const fimB = textoDataB.split('—')[1] || textoDataB.split('—')[0];

        return parseDataParaSort(fimB) - parseDataParaSort(fimA);
    });

    blocos.forEach(bloco => container.appendChild(bloco));
}

function editarExperiencia(btn) { fecharFullscreenSeguro(); const div = btn.parentElement.parentElement; const raw = JSON.parse(div.dataset.raw); setValSafe('expC', raw.cargo); setValSafe('expE', raw.empresa); setValSafe('expIni', raw.ini); setValSafe('expFim', raw.fim === "Até o momento" ? "" : raw.fim); const expAtual = document.getElementById('expAtual'); if (expAtual) expAtual.checked = raw.fim === "Até o momento"; const expFim = document.getElementById('expFim'); if (expFim) expFim.disabled = raw.fim === "Até o momento"; setValSafe('expDes', raw.desc); if (editExpNode) { editExpNode.style.borderLeft = "none"; editExpNode.style.paddingLeft = "0"; } editExpNode = div; div.style.borderLeft = "3px solid var(--primary)"; div.style.paddingLeft = "10px"; const inputEdit = document.getElementById('expC'); if (inputEdit) { inputEdit.closest('details').open = true; inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputEdit.focus(); } const btnAdd = document.getElementById('btn-add-exp'); if (btnAdd) { btnAdd.innerText = "💾 Salvar Experiência"; btnAdd.classList.replace('btn-primary', 'btn-accent'); } }
function adicionarExperiencia(dados = null) {
    let cargo = dados?.cargo || getValSafe('expC');
    let emp = dados?.empresa || getValSafe('expE');
    let ini = dados?.ini || getValSafe('expIni');
    const expAtual = document.getElementById('expAtual');
    let fim = dados?.fim || ((expAtual && expAtual.checked) ? "Até o momento" : getValSafe('expFim'));
    let des = dados?.desc || getValSafe('expDes');
    if (!cargo || !emp) return;

    // Limpa lixos, mas não remove as bolinhas da descrição
    cargo = higienizarTexto(cargo).replace(/^[•\-\*]+/, '').trim();
    des = higienizarTexto(des);

    const rawStr = JSON.stringify({ cargo, empresa: emp, ini, fim, desc: des });
    let headerData = (ini || fim) ? `<span>${ini || ''}${ini && fim ? ' — ' : ''}${fim || ''}</span>` : '';

    // Adicionado o white-space: pre-wrap para a descrição
    const htmlStr = `<div class="exp-header"><span>${cargo}</span>${headerData}</div><div class="exp-empresa">${emp}</div><div class="texto-justificado" style="white-space: pre-wrap;">${des}</div><div style="text-align:right; margin-top:-5px"><small style="color:var(--primary);cursor:pointer;padding:5px;" onclick="editarExperiencia(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:8px;padding:5px;" onclick="this.parentElement.parentElement.remove(); marcarAlteracao();">[remover]</small></div>`;
    if (!dados && editExpNode) { editExpNode.dataset.raw = rawStr; editExpNode.innerHTML = htmlStr; editExpNode.style.borderLeft = "none"; editExpNode.style.paddingLeft = "0"; editExpNode = null; } else { const div = document.createElement('div'); div.className = "bloco-exp"; div.style.marginBottom = "15px"; div.dataset.raw = rawStr; div.innerHTML = htmlStr; const pe = document.getElementById('preExp'); if (pe) pe.appendChild(div); } ['expC', 'expE', 'expIni', 'expFim', 'expDes'].forEach(i => setValSafe(i, "")); if (expAtual) expAtual.checked = false; const eFim = document.getElementById('expFim'); if (eFim) eFim.disabled = false; const btnAdd = document.getElementById('btn-add-exp'); if (btnAdd) { btnAdd.innerText = "+ Adicionar Experiência"; btnAdd.classList.replace('btn-accent', 'btn-primary'); } fecharAbaPai('expC'); reordenarExperienciasDOM(); marcarAlteracao();
}

function editarEscolaridade(btn) { fecharFullscreenSeguro(); const div = btn.parentElement; const raw = JSON.parse(div.dataset.raw); setValSafe('escC', raw.curso); setValSafe('escI', raw.inst); setValSafe('escIni', raw.ini); setValSafe('escStatus', raw.status || "Concluído"); if (editEscNode) { editEscNode.style.borderLeft = "none"; editEscNode.style.paddingLeft = "0"; } editEscNode = div; div.style.borderLeft = "3px solid var(--primary)"; div.style.paddingLeft = "10px"; const inputEdit = document.getElementById('escC'); if (inputEdit) { inputEdit.closest('details').open = true; inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputEdit.focus(); } const btnAdd = document.getElementById('btn-add-esc'); if (btnAdd) { btnAdd.innerText = "💾 Salvar Formação"; btnAdd.classList.replace('btn-primary', 'btn-accent'); } }
function adicionarEscolaridade(dados = null) { let cur = dados?.curso || getValSafe('escC'); let ins = dados?.inst || getValSafe('escI'); let ini = dados?.ini || getValSafe('escIni'); let status = dados?.status || getValSafe('escStatus'); if (!cur) return; cur = cur.replace(/^[•\-\*\s]+/, ''); const rawStr = JSON.stringify({ curso: cur, inst: ins, ini, status }); let html = `• <strong>${cur}</strong>`; if (ins) html += ` — ${ins}`; let infoExtra = []; if (ini) infoExtra.push(ini); if (status) infoExtra.push(status); if (infoExtra.length > 0) html += ` (${infoExtra.join(' - ')})`; const htmlStr = `${html} <small style="color:var(--primary);cursor:pointer;margin-left:10px;padding:5px;" onclick="editarEscolaridade(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:5px;padding:5px;" onclick="this.parentElement.remove(); marcarAlteracao();">[x]</small>`; if (!dados && editEscNode) { editEscNode.dataset.raw = rawStr; editEscNode.innerHTML = htmlStr; editEscNode.style.borderLeft = "none"; editEscNode.style.paddingLeft = "0"; editEscNode = null; } else { const div = document.createElement('div'); div.className = "item-lista"; div.dataset.raw = rawStr; div.innerHTML = htmlStr; const pe = document.getElementById('preEsc'); if (pe) pe.appendChild(div); } ['escC', 'escI', 'escIni'].forEach(i => setValSafe(i, "")); setValSafe('escStatus', "Concluído"); const btnAdd = document.getElementById('btn-add-esc'); if (btnAdd) { btnAdd.innerText = "+ Adicionar Formação"; btnAdd.classList.replace('btn-accent', 'btn-primary'); } fecharAbaPai('escC'); marcarAlteracao(); }

function editarIdioma(btn) { fecharFullscreenSeguro(); const div = btn.parentElement; const raw = JSON.parse(div.dataset.raw); setValSafe('idiIn', raw.nome); setValSafe('idiNivel', raw.nivel); if (editIdiNode) { editIdiNode.style.borderLeft = "none"; editIdiNode.style.paddingLeft = "0"; } editIdiNode = div; div.style.borderLeft = "3px solid var(--primary)"; div.style.paddingLeft = "10px"; const inputEdit = document.getElementById('idiIn'); if (inputEdit) { inputEdit.closest('details').open = true; inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputEdit.focus(); } const btnAdd = document.getElementById('btn-add-idi'); if (btnAdd) { btnAdd.innerText = "💾 Salvar Idioma"; btnAdd.classList.replace('btn-primary', 'btn-accent'); } }
function adicionarIdioma(d = null) { let nome = d?.nome || getValSafe('idiIn'); let nivel = d?.nivel || getValSafe('idiNivel'); if (!nome) return; nome = nome.replace(/^[•\-\*\s]+/, ''); const rawStr = JSON.stringify({ nome, nivel }); let html = `• <strong>${nome}</strong>`; if (nivel) html += `: ${nivel}`; const htmlStr = `${html} <small style="color:var(--primary);cursor:pointer;margin-left:10px;padding:5px;" onclick="editarIdioma(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:5px;padding:5px;" onclick="this.parentElement.remove(); marcarAlteracao();">[x]</small>`; if (!d && editIdiNode) { editIdiNode.dataset.raw = rawStr; editIdiNode.innerHTML = htmlStr; editIdiNode.style.borderLeft = "none"; editIdiNode.style.paddingLeft = "0"; editIdiNode = null; } else { const div = document.createElement('div'); div.className = "item-lista"; div.dataset.raw = rawStr; div.innerHTML = htmlStr; const pi = document.getElementById('preIdi'); if (pi) pi.appendChild(div); } setValSafe('idiIn', ""); const btnAdd = document.getElementById('btn-add-idi'); if (btnAdd) { btnAdd.innerText = "+ Adicionar Idioma"; btnAdd.classList.replace('btn-accent', 'btn-primary'); } fecharAbaPai('idiIn'); marcarAlteracao(); }

function editarHabilidade(btn) { fecharFullscreenSeguro(); const div = btn.parentElement; const raw = JSON.parse(div.dataset.raw); setValSafe('habIn', raw.hab); if (editHabNode) { editHabNode.style.borderLeft = "none"; editHabNode.style.paddingLeft = "0"; } editHabNode = div; div.style.borderLeft = "3px solid var(--primary)"; div.style.paddingLeft = "10px"; const inputEdit = document.getElementById('habIn'); if (inputEdit) { inputEdit.closest('details').open = true; inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputEdit.focus(); } const btnAdd = document.getElementById('btn-add-hab'); if (btnAdd) { btnAdd.innerText = "💾 Salvar Edição"; btnAdd.classList.replace('btn-primary', 'btn-accent'); } }
function adicionarHabilidade(h = null) { let v = h || getValSafe('habIn'); if (!v) return; v = v.replace(/^[•\-\*\s]+/, ''); const rawStr = JSON.stringify({ hab: v }); const htmlStr = `• <span class="hab-text">${v}</span> <small style="color:var(--primary);cursor:pointer;margin-left:10px;padding:5px;" onclick="editarHabilidade(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:5px;padding:5px;" onclick="this.parentElement.remove(); marcarAlteracao();">[x]</small>`; if (!h && editHabNode) { editHabNode.dataset.raw = rawStr; editHabNode.innerHTML = htmlStr; editHabNode.style.borderLeft = "none"; editHabNode.style.paddingLeft = "0"; editHabNode = null; } else { const div = document.createElement('div'); div.className = 'item-lista'; div.dataset.raw = rawStr; div.innerHTML = htmlStr; const ph = document.getElementById('preHab'); if (ph) ph.appendChild(div); } setValSafe('habIn', ""); const btnAdd = document.getElementById('btn-add-hab'); if (btnAdd) { btnAdd.innerText = "+ Adicionar Habilidade"; btnAdd.classList.replace('btn-accent', 'btn-primary'); } fecharAbaPai('habIn'); marcarAlteracao(); }

function preencherEditor(extraido) {
    setValSafe('inNome', extraido.nome || ""); setValSafe('inEnd', extraido.endereco || ""); setValSafe('inCep', extraido.cep || "");
    setValSafe('inEmail', extraido.email || ""); setValSafe('inLinkedin', extraido.linkedin || "");
    const inputWhats = document.getElementById('inWhats'); if (inputWhats && extraido.whatsapp) { inputWhats.value = extraido.whatsapp; mascaraWhats(inputWhats); }
    syncNome(); syncContato();
    if (extraido.resumo) { setValSafe('resIn', extraido.resumo); adicionarResumo(); }
    if (extraido.experiencias) extraido.experiencias.forEach(e => adicionarExperiencia(e));
    if (extraido.formacao) extraido.formacao.forEach(f => adicionarEscolaridade(f));
    if (extraido.idiomas) extraido.idiomas.forEach(i => adicionarIdioma(i));
    if (extraido.habilidades) extraido.habilidades.forEach(h => adicionarHabilidade(h));
    showToast(); setTimeout(ajustarZoomMobile, 100);
}

function limparTudo() {
    ultimasAlteracoesIA = "";
    analiseAtsAtual = null;
    vagaOriginalAtual = "";

    document.getElementById('btn-ver-alteracoes').style.display = 'none';
    document.getElementById('alerta-email-vaga').style.display = 'none';
    document.getElementById('details-ats').style.display = 'none';
    document.getElementById('painel-ats-conteudo').innerHTML = "";

    origemAtual = "Criado do zero";
    atualizarStatusOrigem();

    editResumoNode = null; editExpNode = null; editEscNode = null; editIdiNode = null; editHabNode = null;
    ['preRes', 'preExp', 'preEsc', 'preIdi', 'preHab'].forEach(i => { const el = document.getElementById(i); if (el) el.innerHTML = ""; });
    ['inNome', 'inData', 'inIdade', 'inEnd', 'inCep', 'inEmail', 'inWhats', 'inLinkedin', 'inPretensao', 'texto-ia'].forEach(i => setValSafe(i, ""));
    const chk = document.getElementById('chkPretensao'); if (chk) chk.checked = false;
    const np = document.getElementById('nomePreview'); if (np) np.innerText = "NOME COMPLETO";
    const prev = document.getElementById('contatoPreview'); if (prev) prev.innerText = "...";

    document.querySelectorAll('#editor details').forEach(d => d.removeAttribute('open'));

    document.querySelectorAll('.btn-add-block').forEach(btn => { btn.innerText = btn.innerText.replace('💾 Salvar Edição', '+ Adicionar').replace('💾 Salvar Experiência', '+ Adicionar Experiência').replace('💾 Salvar Formação', '+ Adicionar Formação').replace('💾 Salvar Idioma', '+ Adicionar Idioma'); btn.classList.remove('btn-accent'); btn.classList.add('btn-primary'); });

    const btnRecalcular = document.getElementById('btn-recalcular-ats');
    if (btnRecalcular) btnRecalcular.style.display = 'none';

    setTimeout(ajustarZoomMobile, 100);
}

function gerarPDF() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "mm", format: "a4" }); doc.setLineHeightFactor(1.4); const margin = 20; let y = 20; const regexClean = /\[editar\]|\[remover\]|\[x\]/g;
    function checarQuebra(espaco) { if (y + espaco > 280) { doc.addPage(); y = 20; } }
    const nome = getValSafe("inNome") || "Candidato"; const arquivo = `CV_${nome.replace(/\s+/g, '_')}.pdf`;

    doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(30, 30, 30); checarQuebra(15);
    const nomePrev = document.getElementById("nomePreview"); doc.text(nomePrev ? nomePrev.innerText : "", 105, y, { align: "center" }); y += 10;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 100, 100); checarQuebra(10);
    const contatoP = document.getElementById('contatoPreview'); const contatoTxt = contatoP ? contatoP.innerText : ""; const linhasContato = doc.splitTextToSize(contatoTxt, 170);
    doc.text(linhasContato, 105, y, { align: "center" }); y += (linhasContato.length * 5) + 3;

    doc.setDrawColor(200, 200, 200); doc.line(margin, y, 190, y); y += 10;

    const secoes = [
        { t: "RESUMO PROFISSIONAL", id: "preRes", type: "text" }, { t: "EXPERIÊNCIA PROFISSIONAL", id: "preExp", type: "exp" },
        { t: "FORMAÇÃO ACADÊMICA", id: "preEsc", type: "list" }, { t: "IDIOMAS", id: "preIdi", type: "list" },
        { t: "HABILIDADES", id: "preHab", type: "grid" }
    ];

    secoes.forEach(s => {
        const el = document.getElementById(s.id); if (!el || el.innerHTML.trim() === "") return;
        checarQuebra(18);
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(30, 30, 30); doc.text(s.t, margin, y); y += 2.5;
        doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.6); doc.line(margin, y, 190, y); y += 7;
        doc.setLineWidth(0.2); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(50, 50, 50);

        if (s.type === "text") {
            Array.from(el.querySelectorAll('.texto-justificado')).forEach(it => { const txt = it.innerText.replace(regexClean, '').trim(); const dim = doc.getTextDimensions(txt, { maxWidth: 170 }); checarQuebra(dim.h + 5); doc.text(txt, margin, y, { maxWidth: 170, align: "justify" }); y += dim.h + 4; });
        } else if (s.type === "exp") {
            Array.from(el.querySelectorAll('.bloco-exp')).forEach(b => {
                const cargo = b.querySelector('.exp-header span:first-child').innerText; const periodo = b.querySelector('.exp-header span:last-child').innerText; const emp = b.querySelector('.exp-empresa').innerText; const desc = b.querySelector('.texto-justificado').innerText.replace(regexClean, '').trim();
                const dim = doc.getTextDimensions(desc, { maxWidth: 170 }); checarQuebra(dim.h + 16);
                doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30); doc.text(cargo, margin, y); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100); doc.text(periodo, 190, y, { align: "right" }); y += 5.5;
                doc.setFont("helvetica", "italic"); doc.setTextColor(80, 80, 80); doc.text(emp, margin, y); y += 5.5;
                doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); doc.text(desc, margin, y, { maxWidth: 170, align: "left" }); y += dim.h + 7;
            });
        } else if (s.type === "list") {
            Array.from(el.querySelectorAll('.item-lista')).forEach(it => { checarQuebra(8); doc.text(it.innerText.replace(regexClean, '').trim(), margin, y); y += 6; });
        } else if (s.type === "grid") {
            const habs = Array.from(el.querySelectorAll('.item-lista')).map(el => el.querySelector('.hab-text') ? el.querySelector('.hab-text').innerText.replace(regexClean, '').trim() : "");
            const habString = habs.filter(h => h).join("   •   ");
            const linhasHab = doc.splitTextToSize(habString, 170);
            checarQuebra((linhasHab.length * 5) + 5);
            doc.text(linhasHab, margin, y, { align: "left" });
            y += (linhasHab.length * 5) + 5;
        }
        y += 7;
    });
    doc.save(arquivo);
}

// Remove caracteres invisíveis do Word/PDF e padroniza as "bolinhas"
function higienizarTexto(texto) {
    if (!texto) return "";
    return texto
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Arranca os fantasmas
        .replace(/[▪]/g, '•') // Transforma bullets esquisitos na bolinha clássica
        .replace(/\t/g, '  ') // Troca tabulação (Tab) por espaço normal
        .trim();
}

// Configura as travas assim que a tela carrega
document.addEventListener('DOMContentLoaded', () => {

    // 1. Trava da Idade (Apenas números, máximo 3 caracteres)
    const inIdade = document.getElementById('inIdade');
    if (inIdade) {
        inIdade.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, "").substring(0, 3);
            syncContato();
        });
    }

    // 2. Trava de E-mail (Verifica se tem '@' e '.' ao sair do campo)
    const inEmail = document.getElementById('inEmail');
    if (inEmail) {
        inEmail.addEventListener('blur', function () {
            const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !regexEmail.test(this.value)) {
                alert("⚠️ Por favor, insira um e-mail válido.");
                this.value = "";
                syncContato();
            }
        });
    }

    // 3. Forçar formato MM/AAAA (Experiência e Formação) e trava Mês Inválido
    ['expIni', 'expFim', 'escIni'].forEach(id => {
        const inputData = document.getElementById(id);
        if (inputData) {
            inputData.addEventListener('input', function () {
                let v = this.value.replace(/\D/g, "");
                if (v.length >= 2) {
                    // Impede mês maior que 12 ou igual a 00
                    let mes = parseInt(v.substring(0, 2));
                    if (mes > 12) v = "12" + v.substring(2);
                    if (mes === 0 && v.length >= 2) v = "01" + v.substring(2);

                    v = v.replace(/^(\d{2})(\d)/, "$1/$2");
                }
                this.value = v.substring(0, 7); // Trava em 7 (MM/AAAA)
            });
        }
    });

    // 4. Máscara de Moeda (Pretensão Salarial em R$)
    const inPretensao = document.getElementById('inPretensao');
    if (inPretensao) {
        inPretensao.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, "");
            if (v) {
                v = (parseInt(v) / 100).toFixed(2) + '';
                v = v.replace(".", ",");
                v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
                v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
                this.value = "R$ " + v;
            } else {
                this.value = "";
            }
            syncContato();
        });
    }

});
