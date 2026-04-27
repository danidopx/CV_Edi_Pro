import {
    sb,
    appState,
    regexSenha,
    DEFAULT_PROMPTS_BY_NAME
} from './config.js';
import {
    carregarConfiguracaoIA,
    carregarTodosPromptsIA,
    getPromptCatalog,
    inicializarModeloIA,
    atualizarVisibilidadePainelDebug,
    detectarAmbienteAtual,
    carregarVersaoAtualApp,
    carregarHistoricoVersoesApp,
    registrarVersaoApp
} from './api.js';
import { getValSafe, setValSafe, showToast, irPara, mostrarAviso, mostrarConfirmacao } from './ui.js';

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

const MOCKUPS_HOME_VALIDOS = ['mockup1', 'mockup2', 'mockup3'];

function normalizarMockupHome(valor) {
    return MOCKUPS_HOME_VALIDOS.includes(valor) ? valor : 'mockup1';
}

function atualizarMockupHomeAdmin(mockup, { salvo = false } = {}) {
    const mockupNormalizado = normalizarMockupHome(mockup);
    const input = document.getElementById('admin-home-mockup-ativo');
    const status = document.getElementById('admin-home-mockup-status');

    if (input) input.value = mockupNormalizado;
    visualizarMockupHomeAdmin(mockupNormalizado);

    if (status) {
        status.textContent = `Mockup ativo: ${mockupNormalizado.replace('mockup', 'Mockup ')}${salvo ? ' (salvo)' : ''}`;
    }
}

export function visualizarMockupHomeAdmin(mockup) {
    const mockupNormalizado = normalizarMockupHome(mockup);
    const frame = document.getElementById('admin-home-mockup-preview');
    if (frame) frame.src = `/mockup/${mockupNormalizado}.html`;
}

export async function definirMockupHomeAdmin(mockup) {
    const mockupNormalizado = normalizarMockupHome(mockup);
    atualizarMockupHomeAdmin(mockupNormalizado);

    const { error } = await sb.from('ai_settings').upsert({
        setting_key: 'active_home_mockup',
        setting_value: mockupNormalizado,
        description: 'Layout ativo da tela inicial pos-login',
        user_id: appState.usuarioAtual?.id || null,
        is_system_setting: true
    }, { onConflict: 'setting_key' });

    if (error) {
        mostrarAviso('Não foi possível salvar o layout da tela inicial.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        return;
    }

    atualizarMockupHomeAdmin(mockupNormalizado, { salvo: true });
    showToast('Layout da tela inicial salvo.');
}

function bloquearSeAdmin() {
    if (!usuarioEhAdmin()) return false;
    mostrarAviso('Por segurança, os dados cadastrais da conta admin principal não podem ser alterados por esta tela.', {
        title: 'Acesso protegido'
    });
    return true;
}

function mensagemSenhaSegura() {
    return 'Crie uma senha com pelo menos 8 caracteres, incluindo 1 letra maiúscula e 1 número.';
}

function obterStatusSenhaCadastro() {
    const senha = getValSafe('login-senha');
    const confirmacao = getValSafe('login-senha-conf');
    const temConteudo = Boolean(senha || confirmacao);
    const temTamanho = senha.length >= 8;
    const temMaiuscula = /[A-Z]/.test(senha);
    const temNumero = /\d/.test(senha);
    const senhasCoincidem = !confirmacao || senha === confirmacao;

    return {
        senha,
        confirmacao,
        temConteudo,
        temTamanho,
        temMaiuscula,
        temNumero,
        senhasCoincidem,
        senhaValida: temTamanho && temMaiuscula && temNumero
    };
}

function atualizarItemValidacaoSenha(id, valido, rotulo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = `${valido ? '✓' : '•'} ${rotulo}`;
    el.style.color = valido ? 'var(--accent)' : 'var(--text-light)';
}

export function atualizarValidacaoSenhaCadastro() {
    const box = document.getElementById('box-validacao-senha');
    const resumo = document.getElementById('login-senha-resumo');
    const status = obterStatusSenhaCadastro();

    if (!box || !resumo) return status;

    box.style.display = appState.modoCriarConta ? 'block' : 'none';

    atualizarItemValidacaoSenha('senha-regra-tamanho', status.temTamanho, 'Pelo menos 8 caracteres');
    atualizarItemValidacaoSenha('senha-regra-maiuscula', status.temMaiuscula, '1 letra maiúscula');
    atualizarItemValidacaoSenha('senha-regra-numero', status.temNumero, '1 número');
    atualizarItemValidacaoSenha('senha-regra-coincide', status.senhasCoincidem && Boolean(status.confirmacao), 'Senhas iguais');

    if (!appState.modoCriarConta || !status.temConteudo) {
        resumo.textContent = 'Sua senha ficará protegida pelo Supabase Auth.';
        resumo.style.color = 'var(--text-light)';
        return status;
    }

    if (status.senhaValida && status.senhasCoincidem && status.confirmacao) {
        resumo.textContent = 'Senha pronta para criar a conta.';
        resumo.style.color = 'var(--accent)';
    } else if (!status.senhaValida) {
        resumo.textContent = mensagemSenhaSegura();
        resumo.style.color = 'var(--text-light)';
    } else if (status.confirmacao && !status.senhasCoincidem) {
        resumo.textContent = 'As duas senhas ainda não coincidem.';
        resumo.style.color = 'var(--danger)';
    } else {
        resumo.textContent = 'Confirme a senha para concluir o cadastro.';
        resumo.style.color = 'var(--text-light)';
    }

    return status;
}

export function initCadastroSenhaEmTempoReal() {
    ['login-senha', 'login-senha-conf'].forEach(id => {
        const campo = document.getElementById(id);
        if (!campo || campo.dataset.validacaoSenhaInit === 'true') return;
        campo.dataset.validacaoSenhaInit = 'true';
        campo.addEventListener('input', atualizarValidacaoSenhaCadastro);
    });

    atualizarValidacaoSenhaCadastro();
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

function formatarDataHoraInput(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

function formatarDataHoraTabela(valor) {
    if (!valor) return '—';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '—';
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function extrairVersaoDoRotuloAtual() {
    const texto = document.querySelector('[data-app-version-label]')?.textContent || '';
    const match = texto.match(/v(\d+\.\d+\.\d+)/i);
    return match ? match[1] : '';
}

function calcularVersaoAnteriorSugerida(versaoAtual) {
    const partes = String(versaoAtual || '').split('.').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return '';
    const [major, minor, patch] = partes;
    if (patch > 0) return `${major}.${minor}.${patch - 1}`;
    return '';
}

async function preencherPainelVersionamentoAdmin() {
    const ambienteAtual = detectarAmbienteAtual();
    const selectAmbiente = document.getElementById('admin-versao-ambiente');
    if (selectAmbiente) selectAmbiente.value = ambienteAtual;

    const infoAtual = document.getElementById('admin-versao-atual-info');
    const historicoBody = document.getElementById('admin-versoes-historico');

    try {
        const [versaoAtual, historico] = await Promise.all([
            carregarVersaoAtualApp(ambienteAtual),
            carregarHistoricoVersoesApp()
        ]);

        if (infoAtual) {
            if (versaoAtual) {
                const responsavel = versaoAtual.responsible_name || versaoAtual.responsible_email || 'Não informado';
                infoAtual.innerHTML = `<strong>Versão atual em ${ambienteAtual === 'production' ? 'Produção' : 'Preview'}:</strong> v${escaparHtml(versaoAtual.current_version)} | ${formatarDataHoraTabela(versaoAtual.release_date)} | ${escaparHtml(responsavel)}`;
            } else {
                infoAtual.innerHTML = '<strong>Nenhuma versão cadastrada ainda</strong> para este ambiente.';
            }
        }

        const versaoSugerida = versaoAtual?.current_version || extrairVersaoDoRotuloAtual();
        const versaoAnteriorSugerida = versaoAtual?.current_version || calcularVersaoAnteriorSugerida(versaoSugerida);

        setValSafe('admin-versao-atual', versaoSugerida);
        setValSafe('admin-versao-anterior', versaoAnteriorSugerida);
        setValSafe('admin-versao-responsavel', appState.usuarioAtual?.user_metadata?.full_name || appState.usuarioAtual?.user_metadata?.name || '');
        setValSafe('admin-versao-email', appState.usuarioAtual?.email || '');
        setValSafe('admin-versao-url', window.location.origin);
        setValSafe('admin-versao-commit', '');
        setValSafe('admin-versao-observacoes', '');
        setValSafe('admin-versao-data', formatarDataHoraInput(new Date().toISOString()));

        if (historicoBody) {
            historicoBody.innerHTML = historico.length === 0
                ? '<tr><td colspan="6" style="text-align: center;">Nenhum registro encontrado.</td></tr>'
                : historico.map(item => {
                    const ambiente = item.environment_name === 'production' ? 'Produção' : 'Preview';
                    const responsavel = item.responsible_name || item.responsible_email || '—';
                    return `
                        <tr>
                            <td>${ambiente}</td>
                            <td><strong>v${escaparHtml(item.current_version)}</strong></td>
                            <td>${escaparHtml(item.previous_version || '—')}</td>
                            <td>${formatarDataHoraTabela(item.release_date)}</td>
                            <td>${escaparHtml(responsavel)}</td>
                            <td>${item.is_current ? '<span style="color: var(--accent); font-weight: bold;">Atual</span>' : 'Histórico'}</td>
                        </tr>
                    `;
                }).join('');
        }
    } catch (error) {
        if (infoAtual) {
            infoAtual.innerHTML = `<span style="color: var(--danger);">Erro ao carregar versionamento: ${escaparHtml(error.message)}</span>`;
        }
        if (historicoBody) {
            historicoBody.innerHTML = `<tr><td colspan="6" style="color: var(--danger); text-align: center;">Erro ao carregar histórico: ${escaparHtml(error.message)}</td></tr>`;
        }
    }
}

export function validarSenha(senha) {
    return regexSenha.test(senha);
}

export function verificarAdmin() {
    const admin = usuarioEhAdmin();
    document.body.classList.toggle('is-admin', admin);
    atualizarVisibilidadePainelDebug(admin);

    const c = document.getElementById('btn-admin-config');
    const u = document.getElementById('btn-admin-users');
    const dc = document.getElementById('dropdown-admin-config');
    const du = document.getElementById('dropdown-admin-users');
    const dl = document.getElementById('dropdown-admin-logins');

    if (admin) {
        if (c) c.style.display = 'flex';
        if (u) u.style.display = 'flex';
        if (dc) dc.style.display = 'flex';
        if (du) du.style.display = 'flex';
        if (dl) dl.style.display = 'flex';
    } else {
        if (c) c.style.display = 'none';
        if (u) u.style.display = 'none';
        if (dc) dc.style.display = 'none';
        if (du) du.style.display = 'none';
        if (dl) dl.style.display = 'none';
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
    if (!novoNome) return mostrarAviso('Digite o nome que você deseja usar na conta.');
    const { data, error } = await sb.auth.updateUser({ data: { full_name: novoNome } });
    if (error) {
        mostrarAviso('Não foi possível atualizar o nome agora.\n\nDetalhe: ' + error.message, { tone: 'erro' });
    } else {
        appState.usuarioAtual = data.user;
        atualizarInfosUsuarioTopo();
        showToast('Nome atualizado com sucesso!');
    }
}

export async function abrirConfigAdmin() {
    const [promptsSalvos, configModelo, configMockupHome, modelResp] = await Promise.all([
        carregarTodosPromptsIA().catch(() => []),
        carregarConfiguracaoIA('modelo_forcado', { logMissing: false }).catch(() => null),
        carregarConfiguracaoIA('active_home_mockup', { logMissing: false }).catch(() => null),
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
    atualizarMockupHomeAdmin(configMockupHome?.setting_value || 'mockup1', { salvo: true });
    await preencherPainelVersionamentoAdmin();
    document.getElementById('modal-admin').style.display = 'flex';
}

export async function salvarConfigAdmin() {
    const emailSuporte = getValSafe('admin-email-suporte').trim();
    const modeloSelecionado = getValSafe('admin-modelo-select').trim();
    const modeloManual = getValSafe('admin-modelo-manual').trim();
    const modeloFinal = modeloManual || modeloSelecionado;
    const mockupHome = normalizarMockupHome(getValSafe('admin-home-mockup-ativo').trim());
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
            mostrarAviso('Não foi possível salvar os prompts no banco.\n\nDetalhe: ' + error.message, { tone: 'erro' });
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
            mostrarAviso('Não foi possível salvar o modelo da IA no banco.\n\nDetalhe: ' + settingError.message, { tone: 'erro' });
            return;
        }

        const { error: mockupError } = await sb.from('ai_settings').upsert({
            setting_key: 'active_home_mockup',
            setting_value: mockupHome,
            description: 'Layout ativo da tela inicial pos-login',
            user_id: appState.usuarioAtual?.id || null,
            is_system_setting: true
        }, { onConflict: 'setting_key' });

        if (mockupError) {
            mostrarAviso('Não foi possível salvar o layout da tela inicial.\n\nDetalhe: ' + mockupError.message, { tone: 'erro' });
            return;
        }

        appState.modeloIAForcado = modeloFinal;
        await inicializarModeloIA();

        document.getElementById('modal-admin').style.display = 'none';
        showToast();
    } else {
        mostrarAviso('Os prompts não podem ficar vazios.');
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

export async function registrarVersaoAdmin() {
    const environment_name = getValSafe('admin-versao-ambiente').trim();
    const current_version = getValSafe('admin-versao-atual').trim();

    if (!environment_name || !current_version) {
        mostrarAviso('Preencha ao menos o ambiente e a versão atual.');
        return;
    }

    try {
        await registrarVersaoApp({
            environment_name,
            current_version,
            previous_version: getValSafe('admin-versao-anterior').trim(),
            release_date: getValSafe('admin-versao-data') ? new Date(getValSafe('admin-versao-data')).toISOString() : new Date().toISOString(),
            responsible_name: getValSafe('admin-versao-responsavel').trim(),
            responsible_email: getValSafe('admin-versao-email').trim(),
            deployment_url: getValSafe('admin-versao-url').trim(),
            commit_ref: getValSafe('admin-versao-commit').trim(),
            release_notes: getValSafe('admin-versao-observacoes').trim(),
            source: 'manual'
        });

        await preencherPainelVersionamentoAdmin();
        showToast('Versionamento atualizado!');
    } catch (error) {
        mostrarAviso('Não foi possível registrar a versão.\n\nDetalhe: ' + error.message, { tone: 'erro' });
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
    if (await mostrarConfirmacao(`Deseja suspender o acesso de ${userEmail}?`, {
        title: 'Desativar usuário',
        confirmLabel: 'Desativar',
        cancelLabel: 'Cancelar',
        tone: 'erro'
    })) {
        const { error } = await sb.rpc('admin_deletar_usuario', { alvo_id: userId });
        if (error) mostrarAviso('Não foi possível desativar o usuário.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        else {
            showToast('Usuário desativado!');
            abrirGestaoUsuarios();
        }
    }
}

export async function reabilitarUsuarioAdmin(userId, userEmail) {
    if (await mostrarConfirmacao(`Deseja reabilitar o acesso de ${userEmail}?`, {
        title: 'Reabilitar usuário',
        confirmLabel: 'Reabilitar',
        cancelLabel: 'Cancelar',
        tone: 'sucesso'
    })) {
        const { error } = await sb.rpc('admin_reabilitar_usuario', { alvo_id: userId });
        if (error) {
            mostrarAviso('Não foi possível reabilitar o usuário.\n\nO banco não encontrou a função admin_reabilitar_usuario. Verifique essa função no Supabase.', { tone: 'erro' });
        } else {
            showToast('Usuário reabilitado com sucesso!');
            abrirGestaoUsuarios();
        }
    }
}

export async function excluirUsuarioDefinitivo(userId, userEmail) {
    if (await mostrarConfirmacao(`Você está prestes a excluir definitivamente o usuário:\n\n${userEmail}\n\nEssa ação apagará a conta do banco e não pode ser desfeita.`, {
        title: 'Excluir usuário definitivamente',
        confirmLabel: 'Excluir definitivamente',
        cancelLabel: 'Cancelar',
        tone: 'erro'
    })) {
        const { error } = await sb.rpc('admin_excluir_usuario_definitivo', { alvo_id: userId });
        if (error) mostrarAviso('Não foi possível excluir o usuário definitivamente.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        else {
            showToast('Usuário excluído permanentemente do sistema!');
            abrirGestaoUsuarios();
        }
    }
}

export async function registrarLoginNosBanco(userId, email) {
    try {
        const userAgent = navigator.userAgent || null;
        const ipAddress = null; // Será preenchido no servidor se necessário

        const { error } = await sb
            .from('login_logs')
            .insert({
                user_id: userId,
                email: email,
                user_agent: userAgent,
                ip_address: ipAddress,
                success: true
            });

        if (error) {
            console.warn('Erro ao registrar login no banco:', error);
        } else {
            console.log('Login registrado com sucesso no banco de dados');
        }
    } catch (erro) {
        console.warn('Erro ao registrar login:', erro);
    }
}

async function registrarTentativaLoginFalhada(email) {
    try {
        const userAgent = navigator.userAgent || null;
        const ipAddress = null;

        const { error } = await sb
            .from('login_logs')
            .insert({
                user_id: null,
                email: email,
                user_agent: userAgent,
                ip_address: ipAddress,
                success: false
            });

        if (error) {
            console.warn('Erro ao registrar tentativa falhada:', error);
        } else {
            console.log('Tentativa de login falhada registrada');
        }
    } catch (erro) {
        console.warn('Erro ao registrar tentativa falhada:', erro);
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
    atualizarValidacaoSenhaCadastro();
}

export async function processarFormularioLogin() {
    const email = getValSafe('login-email');
    const password = getValSafe('login-senha');
    if (!email || !password) return mostrarAviso('Preencha e-mail e senha para continuar.');
    const msgLog = document.getElementById('msg-login');
    if (msgLog) msgLog.style.display = 'block';

    if (appState.modoCriarConta) {
        const statusSenha = atualizarValidacaoSenhaCadastro();
        if (password !== statusSenha.confirmacao) {
            mostrarAviso('As senhas informadas não coincidem. Revise e tente novamente.');
            if (msgLog) msgLog.style.display = 'none';
            return;
        }
        if (!statusSenha.senhaValida) {
            mostrarAviso(mensagemSenhaSegura(), {
                title: 'Senha mais forte'
            });
            if (msgLog) msgLog.style.display = 'none';
            return;
        }
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) {
            mostrarAviso('Não foi possível criar sua conta agora.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
            mostrarAviso('Este e-mail já está em uso. Tente entrar ou recuperar a senha.');
        } else {
            mostrarAviso('Enviamos um link de confirmação para o seu e-mail. Verifique a caixa de entrada para concluir o cadastro.', {
                title: 'Quase lá',
                tone: 'sucesso'
            });
            setValSafe('login-email', '');
            setValSafe('login-senha', '');
            setValSafe('login-senha-conf', '');
            alternarModoLogin();
            atualizarValidacaoSenhaCadastro();
        }
    } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
            if (msgLog) msgLog.style.display = 'none';
            // Registrar tentativa de login falhada
            await registrarTentativaLoginFalhada(email);

            if (error.message.toLowerCase().includes('ban') || error.message.toLowerCase().includes('inativo') || error.message.toLowerCase().includes('suspen') || error.message.toLowerCase().includes('block')) {
                const emailSuporte = localStorage.getItem('adminEmailSuporte') || 'suporte@cvedipro.com';
                document.getElementById('texto-email-suporte').innerText = emailSuporte;
                document.getElementById('modal-bloqueado').style.display = 'flex';
            } else {
                mostrarAviso('E-mail ou senha incorretos. Revise os dados e tente novamente.', {
                    title: 'Não foi possível entrar',
                    tone: 'erro'
                });
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
        mostrarAviso('Não foi possível enviar o link de recuperação.\n\nDetalhe: ' + error.message, { tone: 'erro' });
    } else {
        mostrarAviso('Se o e-mail existir no sistema, você receberá um link para redefinir a senha.', {
            title: 'Verifique seu e-mail',
            tone: 'sucesso'
        });
    }
}

export async function atualizarEmail() {
    if (bloquearSeAdmin()) return;
    const novoEmail = getValSafe('novo-email');
    if (!novoEmail) return mostrarAviso('Digite o novo e-mail para continuar.');
    const { error } = await sb.auth.updateUser({ email: novoEmail });
    if (error) {
        mostrarAviso('Não foi possível atualizar o e-mail.\n\nDetalhe: ' + error.message, { tone: 'erro' });
    } else {
        mostrarAviso('Enviamos os links de confirmação para concluir a troca de e-mail.', {
            title: 'Confirmação enviada',
            tone: 'sucesso'
        });
        setValSafe('novo-email', '');
    }
}

export async function atualizarSenhaConta() {
    if (bloquearSeAdmin()) return;
    const s1 = getValSafe('nova-senha');
    const s2 = getValSafe('nova-senha-conf');
    if (s1 !== s2) return mostrarAviso('As senhas informadas não coincidem. Revise e tente novamente.');
    if (!validarSenha(s1)) return mostrarAviso(mensagemSenhaSegura(), { title: 'Senha mais forte' });
    const { error } = await sb.auth.updateUser({ password: s1 });
    if (error) {
        mostrarAviso('Não foi possível atualizar a senha.\n\nDetalhe: ' + error.message, { tone: 'erro' });
    } else {
        mostrarAviso('Sua senha foi atualizada com sucesso.', {
            title: 'Senha atualizada',
            tone: 'sucesso'
        });
        setValSafe('nova-senha', '');
        setValSafe('nova-senha-conf', '');
    }
}

export async function solicitarExclusao() {
    if (usuarioEhAdmin()) {
        return mostrarAviso('A conta de administrador principal não pode ser excluída.');
    }
    if (await mostrarConfirmacao('O acesso à sua conta será bloqueado permanentemente e todos os currículos atrelados ao seu e-mail ficarão inacessíveis.', {
        title: 'Desativar minha conta',
        confirmLabel: 'Desativar conta',
        cancelLabel: 'Cancelar',
        tone: 'erro'
    })) {
        const { error } = await sb.rpc('desativar_minha_conta');
        if (error) mostrarAviso('Não foi possível desativar a conta.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        else {
            await fazerLogout();
            mostrarAviso('Sua conta foi desativada com sucesso.', {
                title: 'Conta desativada',
                tone: 'sucesso'
            });
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
        mostrarAviso('Não foi possível iniciar o login com Google.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        if (msg) msg.style.display = 'none';
    }
}

export async function fazerLogout() {
    await sb.auth.signOut();
    localStorage.removeItem('ultima_atividade_app');
    localStorage.removeItem('telaRecuperacao');
    localStorage.removeItem('cvRecuperacao');
}

export async function abrirVisualizadorLoginsAdmin() {
    if (!usuarioEhAdmin()) {
        mostrarAviso('Apenas administradores podem acessar os logs de login.', { tone: 'erro' });
        return;
    }

    let filtroEmail = '';
    let filtroSucesso = 'todos';

    async function carregarLogs() {
        const tabela = document.getElementById('admin-logins-corpo-tabela');
        const infoCont = document.getElementById('admin-logins-info');

        if (!tabela || !infoCont) return;

        tabela.innerHTML = '<tr><td colspan="5" style="text-align: center;">Carregando...</td></tr>';

        let query = sb.from('login_logs').select('*').order('login_timestamp', { ascending: false }).limit(500);

        if (filtroEmail) {
            query = query.ilike('email', `%${filtroEmail}%`);
        }

        if (filtroSucesso === 'sucesso') {
            query = query.eq('success', true);
        } else if (filtroSucesso === 'falha') {
            query = query.eq('success', false);
        }

        const { data, error, count } = await query;

        if (error) {
            tabela.innerHTML = `<tr><td colspan="5" style="color: red;">Erro: ${escaparHtml(error.message)}</td></tr>`;
            infoCont.textContent = 'Erro ao carregar logs';
            return;
        }

        infoCont.textContent = data && data.length > 0 ? `Exibindo ${data.length} registros` : 'Nenhum registro encontrado';

        if (!data || data.length === 0) {
            tabela.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum log de login encontrado.</td></tr>';
            return;
        }

        tabela.innerHTML = data.map(log => {
            const data_fmt = new Date(log.login_timestamp).toLocaleString('pt-BR');
            const statusCor = log.success ? 'var(--accent)' : 'var(--danger)';
            const statusTexto = log.success ? '✓ Sucesso' : '✗ Falha';
            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td><strong>${escaparHtml(log.email)}</strong></td>
                    <td>${data_fmt}</td>
                    <td><span style="color: ${statusCor}; font-weight: bold;">${statusTexto}</span></td>
                    <td style="font-size: 11px; color: var(--text-light);">${log.user_agent ? log.user_agent.substring(0, 50) + '...' : 'N/A'}</td>
                    <td style="font-size: 11px; color: var(--text-light);">${log.ip_address || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    }

    const modal = document.createElement('div');
    modal.id = 'modal-logins-admin';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-body); border-radius: 15px; padding: 24px; max-width: 900px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>📊 Histórico de Logins</h2>
                <button onclick="document.getElementById('modal-logins-admin').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-light);">✕</button>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: flex-end;">
                <div>
                    <label style="display: block; font-size: 12px; color: var(--text-light); margin-bottom: 4px;">Filtrar por E-mail:</label>
                    <input id="admin-logins-filtro-email" type="text" placeholder="Digite o e-mail..." style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-panel);">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: var(--text-light); margin-bottom: 4px;">Status:</label>
                    <select id="admin-logins-filtro-status" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-panel);">
                        <option value="todos">Todos</option>
                        <option value="sucesso">Apenas Sucessos</option>
                        <option value="falha">Apenas Falhas</option>
                    </select>
                </div>
                <button id="admin-logins-btn-filtrar" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">🔍 Filtrar</button>
            </div>
            
            <div style="color: var(--text-light); font-size: 12px; margin-bottom: 12px;">
                <span id="admin-logins-info">Carregando...</span>
            </div>
            
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-panel); border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 12px; text-align: left; font-weight: bold;">E-mail</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold;">Data/Hora</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold;">Status</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold; font-size: 11px;">User Agent</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold; font-size: 11px;">IP</th>
                        </tr>
                    </thead>
                    <tbody id="admin-logins-corpo-tabela">
                        <tr><td colspan="5" style="text-align: center; padding: 20px;">Carregando...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const btnFiltrar = document.getElementById('admin-logins-btn-filtrar');
    const inputEmail = document.getElementById('admin-logins-filtro-email');
    const selectStatus = document.getElementById('admin-logins-filtro-status');

    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', async () => {
            filtroEmail = inputEmail.value;
            filtroSucesso = selectStatus.value;
            await carregarLogs();
        });
    }

    if (inputEmail) {
        inputEmail.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                filtroEmail = inputEmail.value;
                filtroSucesso = selectStatus.value;
                await carregarLogs();
            }
        });
    }

    await carregarLogs();
}
