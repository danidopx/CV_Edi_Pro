import {
    sb,
    appState,
    regexSenha,
    DEFAULT_PROMPT_SIMPLES,
    DEFAULT_PROMPT_AGRESSIVO,
    DEFAULT_PROMPT_ATS,
    DEFAULT_PROMPT_VALIDACAO
} from './config.js';
import { getValSafe, setValSafe, showToast, irPara } from './ui.js';
import { atualizarModelosDisponiveis } from './api.js';

// --- VALIDAÇÕES E ESTADO ---

export function validarSenha(senha) {
    return regexSenha.test(senha);
}

export function verificarAdmin() {
    // Verifica se o usuário logado é o administrador principal
    const isAdmin = appState.usuarioAtual && appState.usuarioAtual.email === 'dop.jr82@gmail.com';
    const c = document.getElementById('btn-admin-config');
    const u = document.getElementById('btn-admin-users');

    if (c) c.style.display = isAdmin ? 'flex' : 'none';
    if (u) u.style.display = isAdmin ? 'flex' : 'none';
}

export function atualizarInfosUsuarioTopo() {
    if (!appState.usuarioAtual) return;
    const displayEmail = document.getElementById('user-email-display');
    const displayName = document.getElementById('user-name-display');

    if (displayEmail) displayEmail.innerText = appState.usuarioAtual.email;
    if (displayName) {
        displayName.innerText = appState.usuarioAtual.user_metadata?.full_name || 'Usuário';
    }
}

// --- GESTÃO DE ABAS DO PAINEL ADMIN (CORREÇÃO DA ABA INACESSÍVEL) ---

export function alternarAbasAdmin(tabId) {
    // 1. Remove classes ativas de todos os conteúdos e esconde
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    // 2. Remove destaque de todos os botões de aba
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Ativa o conteúdo da aba selecionada
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active');
    }

    // 4. Ativa visualmente o botão correspondente
    // Busca o botão que contém o ID da aba no atributo onclick
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// --- CONFIGURAÇÕES DA IA ---

export function abrirConfigAdmin() {
    // 1. Carrega Histórico de Modelos do LocalStorage
    const listaModelos = JSON.parse(localStorage.getItem('cache_modelos_lista') || '[]');
    const dataSinc = localStorage.getItem('cache_modelos_data') || 'Não sincronizado';

    const spanData = document.getElementById('sync-data-hora');
    if (spanData) spanData.innerText = dataSinc;

    const containerModelos = document.getElementById('historico-modelos-ia');
    if (containerModelos) {
        containerModelos.innerHTML = listaModelos.length > 0
            ? listaModelos.map(m => `<div class="model-item-badge">${m}</div>`).join('')
            : '<p>Nenhum modelo em cache. Sincronize com a API.</p>';
    }

    // 2. Preenche os Prompts (Usa o salvo ou o padrão do config.js)
    setValSafe('cfg-prompt-simples', localStorage.getItem('prompt_simples') || DEFAULT_PROMPT_SIMPLES);
    setValSafe('cfg-prompt-agressivo', localStorage.getItem('prompt_agressivo') || DEFAULT_PROMPT_AGRESSIVO);
    setValSafe('cfg-prompt-ats', localStorage.getItem('prompt_ats') || DEFAULT_PROMPT_ATS);
    setValSafe('cfg-prompt-validacao', localStorage.getItem('prompt_validacao') || DEFAULT_PROMPT_VALIDACAO);

    // 3. Exibe o Modal e garante a primeira aba ativa
    const modal = document.getElementById('modal-admin');
    if (modal) modal.style.display = 'flex';
    alternarAbasAdmin('tab-modelos');
}

export function salvarConfigAdmin() {
    // Salva as alterações de prompts no LocalStorage para uso nas chamadas de IA
    localStorage.setItem('prompt_simples', getValSafe('cfg-prompt-simples'));
    localStorage.setItem('prompt_agressivo', getValSafe('cfg-prompt-agressivo'));
    localStorage.setItem('prompt_ats', getValSafe('cfg-prompt-ats'));
    localStorage.setItem('prompt_validacao', getValSafe('cfg-prompt-validacao'));

    showToast('Configurações salvas localmente!');
    const modal = document.getElementById('modal-admin');
    if (modal) modal.style.display = 'none';
}

// --- AUTENTICAÇÃO E CONTA ---

export async function fazerLoginGoogle() {
    const msg = document.getElementById('msg-login');
    if (msg) msg.style.display = 'block';

    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });

    if (error) {
        alert('Erro ao entrar com Google: ' + error.message);
        if (msg) msg.style.display = 'none';
    }
}

export async function fazerLogout() {
    const { error } = await sb.auth.signOut();
    if (error) alert('Erro no logout: ' + error.message);
    else {
        localStorage.removeItem('ultima_atividade_app');
        irPara('tela-landing');
    }
}

export async function atualizarSenhaConta() {
    const s1 = getValSafe('nova-senha');
    const s2 = getValSafe('nova-senha-conf');

    if (s1 !== s2) return alert('As senhas não coincidem.');
    if (!validarSenha(s1)) return alert('A senha deve ter 8+ caracteres, 1 número e 1 letra maiúscula.');

    const { error } = await sb.auth.updateUser({ password: s1 });
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        alert('Senha atualizada!');
        setValSafe('nova-senha', '');
        setValSafe('nova-senha-conf', '');
    }
}

export async function solicitarExclusao() {
    if (appState.usuarioAtual && appState.usuarioAtual.email === 'dop.jr82@gmail.com') {
        return alert('A conta de administrador principal não pode ser excluída.');
    }

    const confirmacao = confirm('TEM CERTEZA? O acesso à sua conta será bloqueado permanentemente.');
    if (confirmacao) {
        const { error } = await sb.rpc('desativar_minha_conta');
        if (error) alert('Erro ao desativar: ' + error.message);
        else {
            await fazerLogout();
            alert('Conta desativada com sucesso.');
        }
    }
}

// Funções de Gestão de Usuários (Placeholders para as chamadas do Admin)
export function abrirGestaoUsuarios() { alert('Funcionalidade de gestão de usuários em desenvolvimento.'); }
export function deletarUsuarioAdmin() { }
export function reabilitarUsuarioAdmin() { }
export function excluirUsuarioDefinitivo() { }