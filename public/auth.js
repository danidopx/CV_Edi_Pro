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

export function validarSenha(senha) {

    return regexSenha.test(senha);
}

export function verificarAdmin() {
    if (appState.usuarioAtual && appState.usuarioAtual.email === 'dop.jr82@gmail.com') {
        const c = document.getElementById('btn-admin-config');
        const u = document.getElementById('btn-admin-users');
        if (c) c.style.display = 'flex';
        if (u) u.style.display = 'flex';
    } else {
        const c = document.getElementById('btn-admin-config');
        const u = document.getElementById('btn-admin-users');
        if (c) c.style.display = 'none';
        if (u) u.style.display = 'none';
    }
}

export function atualizarInfosUsuarioTopo() {
    if (!appState.usuarioAtual) return;
    const displayEmail = document.getElementById('user-email-display');
    const displayName = document.getElementById('user-name-display');
    if (displayEmail) displayEmail.innerText = appState.usuarioAtual.email;
    if (displayName) {
        const nomeMeta = appState.usuarioAtual.user_metadata?.full_name || appState.usuarioAtual.user_metadata?.name || 'Usuário';
        displayName.innerText = `Olá, ${nomeMeta.split(' ')[0]}`;
    }
}

export async function atualizarNomeConta() {
    const novoNome = getValSafe('novo-nome');
    if (!novoNome) return alert('Digite o nome desejado.');
    const { data, error } = await sb.auth.updateUser({ data: { full_name: novoNome } });
    if (error) {
        alert('Erro ao atualizar nome: ' + error.message);
    } else {
        appState.usuarioAtual = data.user;
        atualizarInfosUsuarioTopo();
        showToast('Nome atualizado com sucesso!');
    }
}

export function abrirConfigAdmin() {
    setValSafe('admin-prompt-validacao', localStorage.getItem('adminPromptValidacao') || DEFAULT_PROMPT_VALIDACAO);
    setValSafe('admin-prompt-simples', localStorage.getItem('adminPromptSimples') || DEFAULT_PROMPT_SIMPLES);
    setValSafe('admin-prompt-agressivo', localStorage.getItem('adminPromptAgressivo') || DEFAULT_PROMPT_AGRESSIVO);
    setValSafe('admin-prompt-ats', localStorage.getItem('adminPromptAts') || DEFAULT_PROMPT_ATS);
    setValSafe('admin-email-suporte', localStorage.getItem('adminEmailSuporte') || 'suporte@cvedipro.com');
    document.getElementById('modal-admin').style.display = 'flex';
}

export function alternarAbasAdmin(e, tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'var(--bg-body)';
        b.style.color = 'var(--text-main)';
        b.style.border = '1px solid var(--border-color)';
        b.style.borderBottom = 'none';
    });

    e.currentTarget.classList.add('active');
    e.currentTarget.style.background = 'var(--primary)';
    e.currentTarget.style.color = 'white';
    e.currentTarget.style.border = 'none';
}

export function salvarConfigAdmin() {
    const pV = getValSafe('admin-prompt-validacao').trim();
    const pS = getValSafe('admin-prompt-simples').trim();
    const pA = getValSafe('admin-prompt-agressivo').trim();
    const pATS = getValSafe('admin-prompt-ats').trim();
    const emailSuporte = getValSafe('admin-email-suporte').trim();

    if (pV && pS && pA && pATS) {
        localStorage.setItem('adminPromptValidacao', pV);
        localStorage.setItem('adminPromptSimples', pS);
        localStorage.setItem('adminPromptAgressivo', pA);
        localStorage.setItem('adminPromptAts', pATS);
        if (emailSuporte) localStorage.setItem('adminEmailSuporte', emailSuporte);
        showToast('Configurações salvas!');
    } else {
        alert('Os prompts não podem ficar vazios.');
    }
}


export async function abrirGestaoUsuarios() {
    irPara('tela-admin-usuarios');
    const tabela = document.getElementById('corpo-tabela-usuarios');
    if (!tabela) return;
    tabela.innerHTML = '<tr><td colspan="3" style="text-align: center;">Buscando...</td></tr>';
    const { data, error } = await sb.rpc('admin_listar_usuarios');
    if (error) {
        tabela.innerHTML = `<tr><td colspan="3" style="color: red;">Erro: ${error.message}</td></tr>`;
        return;
    }
    tabela.innerHTML = '';
    if (!data || data.length === 0) {
        tabela.innerHTML = '<tr><td colspan="3">Nenhum usuário.</td></tr>';
        return;
    }
    data.forEach(u => {
        const ehAdmin = u.email === 'dop.jr82@gmail.com';
        const inativo = u.email.includes('_inativo.local');
        let botoesAcao = '-';
        if (!ehAdmin) {
            const btnStatus = inativo
                ? `<button class="btn-base btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="reabilitarUsuarioAdmin('${u.id}', '${u.email}')">Reabilitar</button>`
                : `<button class="btn-base btn-neutral" style="padding: 6px 12px; font-size: 11px;" onclick="deletarUsuarioAdmin('${u.id}', '${u.email}')">Desativar</button>`;

            const btnExcluir = `<button class="btn-base btn-danger" style="padding: 6px 10px; font-size: 12px; border: 1px solid var(--danger);" onclick="excluirUsuarioDefinitivo('${u.id}', '${u.email}')" title="Excluir Definitivamente">🗑️</button>`;

            botoesAcao = `<div style="display: flex; gap: 8px; align-items: center;">${btnStatus}${btnExcluir}</div>`;
        }
        tabela.innerHTML += `<tr><td style="${inativo ? 'text-decoration: line-through; color: #999;' : ''}"><strong>${u.email}</strong> ${ehAdmin ? '(Você)' : ''} ${inativo ? '<span style="color:red; font-size:10px;">[Desativado]</span>' : ''}</td><td>${new Date(u.criado_em).toLocaleDateString('pt-BR')}</td><td>${botoesAcao}</td></tr>`;
    });
}

export async function deletarUsuarioAdmin(userId, userEmail) {
    if (confirm(`ATENÇÃO: Deseja suspender o acesso de ${userEmail}?`)) {
        const { error } = await sb.rpc('admin_deletar_usuario', { alvo_id: userId });
        if (error) alert('Erro: ' + error.message);
        else {
            showToast('Usuário desativado!');
            abrirGestaoUsuarios();
        }
    }
}

export async function reabilitarUsuarioAdmin(userId, userEmail) {
    if (confirm(`Deseja REABILITAR o acesso de ${userEmail}?`)) {
        const { error } = await sb.rpc('admin_reabilitar_usuario', { alvo_id: userId });
        if (error) {
            alert('Erro: O banco de dados não encontrou a função admin_reabilitar_usuario. Certifique-se de criá-la no Supabase.');
        } else {
            showToast('Usuário reabilitado com sucesso!');
            abrirGestaoUsuarios();
        }
    }
}

export async function excluirUsuarioDefinitivo(userId, userEmail) {
    if (confirm(`⚠️ CUIDADO! Você está prestes a EXCLUIR DEFINITIVAMENTE o usuário:\n\n${userEmail}\n\nEsta ação apagará a conta do banco de dados e NÃO PODE SER DESFEITA. Deseja continuar?`)) {
        const { error } = await sb.rpc('admin_excluir_usuario_definitivo', { alvo_id: userId });
        if (error) alert('Erro ao excluir: ' + error.message);
        else {
            showToast('Usuário excluído permanentemente do sistema!');
            abrirGestaoUsuarios();
        }
    }
}

export function alternarModoLogin() {
    appState.modoCriarConta = !appState.modoCriarConta;
    const bx = document.getElementById('box-confirma-senha');
    if (bx) bx.style.display = appState.modoCriarConta ? 'flex' : 'none';
    const bt = document.getElementById('btn-acao-login');
    if (bt) bt.innerText = appState.modoCriarConta ? 'Criar Conta Segura' : 'Entrar no Sistema';
    const tx = document.getElementById('txt-troca-login');
    if (tx) {
        tx.innerHTML = appState.modoCriarConta
            ? `Já tem conta? <a href="#" onclick="alternarModoLogin(); return false;" style="color: var(--primary); font-weight: bold; text-decoration: none;">Entrar</a>`
            : `Não tem conta? <a href="#" onclick="alternarModoLogin(); return false;" style="color: var(--primary); font-weight: bold; text-decoration: none;">Criar agora</a>`;
    }
}

export async function processarFormularioLogin() {
    const email = getValSafe('login-email');
    const password = getValSafe('login-senha');
    if (!email || !password) return alert('Preencha e-mail e senha.');
    const msgLog = document.getElementById('msg-login');
    if (msgLog) msgLog.style.display = 'block';

    if (appState.modoCriarConta) {
        const conf = getValSafe('login-senha-conf');
        if (password !== conf) {
            alert('As senhas não coincidem.');
            if (msgLog) msgLog.style.display = 'none';
            return;
        }
        if (!validarSenha(password)) {
            alert('A senha deve ter no mínimo 8 caracteres, contendo pelo menos 1 número e 1 letra maiúscula.');
            if (msgLog) msgLog.style.display = 'none';
            return;
        }
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) {
            alert('Erro: ' + error.message);
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
            alert('E-mail já em uso.');
        } else {
            alert('✉️ Link de confirmação enviado! Verifique seu e-mail.');
            setValSafe('login-email', '');
            setValSafe('login-senha', '');
            setValSafe('login-senha-conf', '');
            alternarModoLogin();
        }
    } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
            if (msgLog) msgLog.style.display = 'none';
            if (error.message.toLowerCase().includes('ban') || error.message.toLowerCase().includes('inativo') || error.message.toLowerCase().includes('suspen') || error.message.toLowerCase().includes('block')) {
                const emailSuporte = localStorage.getItem('adminEmailSuporte') || 'suporte@cvedipro.com';
                document.getElementById('texto-email-suporte').innerText = emailSuporte;
                document.getElementById('modal-bloqueado').style.display = 'flex';
            } else {
                alert('Erro: E-mail ou senha incorretos.');
            }
        }
    }
    if (msgLog) msgLog.style.display = 'none';
}

export async function recuperarSenha() {
    const email = prompt('E-mail para recuperação:');
    if (!email) return;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        alert('✉️ Link enviado se o e-mail existir no sistema.');
    }
}

export async function atualizarEmail() {
    const novoEmail = getValSafe('novo-email');
    if (!novoEmail) return alert('Digite o novo e-mail.');
    const { error } = await sb.auth.updateUser({ email: novoEmail });
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        alert('✉️ Links enviados para confirmar a troca.');
        setValSafe('novo-email', '');
    }
}

export async function atualizarSenhaConta() {
    const s1 = getValSafe('nova-senha');
    const s2 = getValSafe('nova-senha-conf');
    if (s1 !== s2) return alert('As senhas não coincidem.');
    if (!validarSenha(s1)) return alert('A senha deve ter no mínimo 8 caracteres, 1 número e 1 letra maiúscula.');
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
    if (confirm('TEM CERTEZA? O acesso à sua conta será bloqueado permanentemente e todos os currículos atrelados ao seu e-mail ficarão inacessíveis.')) {
        const { error } = await sb.rpc('desativar_minha_conta');
        if (error) alert('Erro ao desativar: ' + error.message);
        else {
            await fazerLogout();
            alert('Conta desativada com sucesso.');
        }
    }
}

export async function fazerLoginGoogle() {
    const msg = document.getElementById('msg-login');
    if (msg) msg.style.display = 'block';
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
        alert('Erro: ' + error.message);
        if (msg) msg.style.display = 'none';
    }
}

export async function fazerLogout() {
    await sb.auth.signOut();
    localStorage.removeItem('ultima_atividade_app');
    localStorage.removeItem('telaRecuperacao');
    localStorage.removeItem('cvRecuperacao');
}
