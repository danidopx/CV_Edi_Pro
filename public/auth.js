import {
    sb,
    appState,
    regexSenha,
    DEFAULT_PROMPTS_BY_NAME
} from './config.js';
import { carregarConfiguracaoIA, carregarTodosPromptsIA, getPromptCatalog, inicializarModeloIA } from './api.js';
import { getValSafe, setValSafe, showToast, irPara } from './ui.js';

function getAuthRedirectUrl() {
    return window.location.origin;
}

export function usuarioEhAdmin() {
    return appState.usuarioAtual?.email === 'dop.jr82@gmail.com';
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function bloquearSeAdmin() {
    if (!usuarioEhAdmin()) return false;
    alert('Por segurança, os dados cadastrais da conta admin principal não podem ser alterados por esta tela.');
    return true;
}

function atualizarControlesContaAdmin() {
    const admin = usuarioEhAdmin();
    const aviso = document.getElementById('aviso-conta-admin');
    if (aviso) aviso.style.display = admin ? 'block' : 'none';
    ['novo-nome', 'novo-email', 'nova-senha', 'nova-senha-conf'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.disabled = admin;
    });
    document.querySelectorAll('[data-bloqueia-admin="true"]').forEach(btn => {
        btn.disabled = admin;
        btn.style.opacity = admin ? '0.55' : '1';
        btn.style.cursor = admin ? 'not-allowed' : 'pointer';
    });
}

export function validarSenha(senha) {
    return regexSenha.test(senha);
}

export function verificarAdmin() {
    if (usuarioEhAdmin()) {
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
        setValSafe('novo-nome', nomeMeta);
    }
    atualizarControlesContaAdmin();
}

export async function atualizarNomeConta() {
    if (bloquearSeAdmin()) return;
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

export async function abrirConfigAdmin() {
    const [promptsSalvos, configModelo, modelResp] = await Promise.all([
        carregarTodosPromptsIA().catch(() => []),
        carregarConfiguracaoIA('modelo_forcado', { logMissing: false }).catch(() => null),
        fetch('/api/modelos').catch(() => null)
    ]);

    const catalogo = getPromptCatalog();
    const promptsMap = new Map(promptsSalvos.map(prompt => [prompt.prompt_name, prompt]));
    const promptsParaRenderizar = Object.entries(catalogo).map(([promptName, meta]) => ({
        prompt_name: promptName,
        description: meta.description,
        label: meta.label,
        prompt_content: promptsMap.get(promptName)?.prompt_content || meta.content
    }));

    promptsSalvos.forEach(prompt => {
        if (!catalogo[prompt.prompt_name]) {
            promptsParaRenderizar.push({
                prompt_name: prompt.prompt_name,
                description: prompt.description || 'Prompt personalizado salvo no banco.',
                label: prompt.prompt_name,
                prompt_content: prompt.prompt_content
            });
        }
    });

    const lista = document.getElementById('admin-prompts-dinamicos');
    if (lista) {
        lista.innerHTML = promptsParaRenderizar.map(prompt => `
            <details class="admin-prompt-card" style="margin-bottom: 12px; border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px; background: var(--bg-body);">
                <summary style="cursor: pointer; font-weight: bold; color: var(--primary);">${escaparHtml(prompt.label)}</summary>
                <div style="margin-top: 12px;">
                    <input data-prompt-name value="${escaparHtml(prompt.prompt_name)}" placeholder="Identificador do prompt" style="margin-bottom: 8px; font-family: monospace;">
                    <input data-prompt-description value="${escaparHtml(prompt.description || '')}" placeholder="Descrição" style="margin-bottom: 8px;">
                    <textarea data-prompt-content style="width: 100%; height: 150px; background: var(--bg-panel); color: var(--text-main); font-family: monospace; font-size: 12px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); resize: vertical;">${escaparHtml(prompt.prompt_content)}</textarea>
                </div>
            </details>
        `).join('');
    }

    let modelosDisponiveis = [];
    if (modelResp?.ok) {
        const modelData = await modelResp.json();
        modelosDisponiveis = modelData.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
            .map(m => m.name.split('/')[1])
            .sort();
    }

    const modeloForcado = configModelo?.setting_value || '';
    setValSafe('admin-modelo-manual', modeloForcado);
    const selectModelo = document.getElementById('admin-modelo-select');
    if (selectModelo) {
        selectModelo.innerHTML = ['<option value="">Automático (lógica atual)</option>', ...modelosDisponiveis.map(modelo => `<option value="${modelo}">${modelo}</option>`)].join('');
        selectModelo.value = modeloForcado && modelosDisponiveis.includes(modeloForcado) ? modeloForcado : '';
    }

    const textoModeloAtual = document.getElementById('admin-modelo-atual');
    if (textoModeloAtual) {
        textoModeloAtual.innerText = appState.modeloIAPreferido || 'Não definido';
    }

    setValSafe('admin-email-suporte', localStorage.getItem('adminEmailSuporte') || 'suporte@cvedipro.com');
    document.getElementById('modal-admin').style.display = 'flex';
}

export async function salvarConfigAdmin() {
    const emailSuporte = getValSafe('admin-email-suporte').trim();
    const modeloSelecionado = getValSafe('admin-modelo-select').trim();
    const modeloManual = getValSafe('admin-modelo-manual').trim();
    const modeloFinal = modeloManual || modeloSelecionado;
    const promptCards = Array.from(document.querySelectorAll('#admin-prompts-dinamicos .admin-prompt-card'));

    const promptsParaSalvar = promptCards.map(card => ({
        prompt_name: card.querySelector('[data-prompt-name]')?.value.trim(),
        description: card.querySelector('[data-prompt-description]')?.value.trim() || null,
        prompt_content: card.querySelector('[data-prompt-content]')?.value.trim(),
        user_id: appState.usuarioAtual?.id || null,
        is_system_prompt: true
    })).filter(prompt => prompt.prompt_name && prompt.prompt_content);

    if (promptsParaSalvar.length > 0) {
        const catalogo = getPromptCatalog();
        localStorage.setItem('adminPromptSimples', promptsParaSalvar.find(item => item.prompt_name === 'ajuste_simples')?.prompt_content || catalogo.ajuste_simples.content);
        localStorage.setItem('adminPromptAgressivo', promptsParaSalvar.find(item => item.prompt_name === 'ajuste_agressivo')?.prompt_content || catalogo.ajuste_agressivo.content);
        localStorage.setItem('adminPromptAts', promptsParaSalvar.find(item => item.prompt_name === 'analise_ats')?.prompt_content || catalogo.analise_ats.content);
        if (emailSuporte) localStorage.setItem('adminEmailSuporte', emailSuporte);

        const { error } = await sb.from('ai_prompts').upsert(promptsParaSalvar, { onConflict: 'prompt_name' });

        if (error) {
            alert('Erro ao salvar prompts no banco: ' + error.message);
            return;
        }

        const { error: settingError } = await sb.from('ai_settings').upsert({
            setting_key: 'modelo_forcado',
            setting_value: modeloFinal,
            description: 'Modelo Gemini forçado manualmente pelo admin',
            user_id: appState.usuarioAtual?.id || null,
            is_system_setting: true
        }, { onConflict: 'setting_key' });

        if (settingError) {
            alert('Erro ao salvar modelo da IA no banco: ' + settingError.message);
            return;
        }

        appState.modeloIAForcado = modeloFinal;
        await inicializarModeloIA();

        document.getElementById('modal-admin').style.display = 'none';
        showToast();
    } else {
        alert('Os prompts não podem ficar vazios.');
    }
}

export function adicionarPromptAdmin() {
    const lista = document.getElementById('admin-prompts-dinamicos');
    if (!lista) return;

    const bloco = document.createElement('details');
    bloco.className = 'admin-prompt-card';
    bloco.open = true;
    bloco.style.cssText = 'margin-bottom: 12px; border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px; background: var(--bg-body);';
    bloco.innerHTML = `
        <summary style="cursor: pointer; font-weight: bold; color: var(--primary);">Novo Prompt</summary>
        <div style="margin-top: 12px;">
            <input data-prompt-name placeholder="Identificador do prompt" style="margin-bottom: 8px; font-family: monospace;">
            <input data-prompt-description placeholder="Descrição" style="margin-bottom: 8px;">
            <textarea data-prompt-content style="width: 100%; height: 150px; background: var(--bg-panel); color: var(--text-main); font-family: monospace; font-size: 12px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); resize: vertical;"></textarea>
        </div>
    `;
    lista.appendChild(bloco);
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
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() });
    if (error) {
        alert('Erro: ' + error.message);
    } else {
        alert('✉️ Link enviado se o e-mail existir no sistema.');
    }
}

export async function atualizarEmail() {
    if (bloquearSeAdmin()) return;
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
    if (bloquearSeAdmin()) return;
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
    if (usuarioEhAdmin()) {
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
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getAuthRedirectUrl() }
    });
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
