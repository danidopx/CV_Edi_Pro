import { sb, appState } from './config.js';
import { logDebug, initDebugPanel, inicializarModeloIA, sincronizarVersaoAppNaTela } from './api.js';
import {
    applyTheme,
    irPara,
    ajustarZoomMobile,
    toggleTheme,
    fecharTour,
    proximoTour,
    iniciarTourMenuPrincipal,
    fecharOnboarding,
    mascaraWhats,
    calcularIdadeOnboarding,
    mascaraCep,
    mascaraCpf,
    syncNome,
    calcularIdadeEditor,
    syncContato,
    voltarTela,
    mostrarAlteracoes,
    toggleFullscreenCV,
    mostrarAviso,
    fecharAviso,
    fecharConfirmacao,
    responderConfirmacao
} from './ui.js';
import {
    verificarAdmin,
    atualizarInfosUsuarioTopo,
    atualizarNomeConta,
    abrirConfigAdmin,
    adicionarPromptAdmin,
    salvarConfigAdmin,
    registrarVersaoAdmin,
    abrirGestaoUsuarios,
    deletarUsuarioAdmin,
    reabilitarUsuarioAdmin,
    excluirUsuarioDefinitivo,
    alternarModoLogin,
    processarFormularioLogin,
    recuperarSenha,
    initCadastroSenhaEmTempoReal,
    atualizarEmail,
    atualizarSenhaConta,
    solicitarExclusao,
    fazerLoginGoogle,
    fazerLogout
} from './auth.js';
import {
    marcarAlteracao,
    recuperarEstadoTela,
    receberVagaExterna,
    receberVagaMobile,
    abrirFluxoEditorCurriculo,
    abrirCurriculosSalvos,
    salvarOnboardingEContinuar,
    definirPadrao,
    duplicar,
    salvarComo,
    salvar,
    carregar,
    deletar,
    abrirFluxoAnaliseVaga,
    configurarEntradaLinkVaga,
    verificarCurriculoBase,
    analisarVagaATS,
    aplicarAjustesVaga,
    extrairDadosIA,
    acionarRecalculoATS,
    ajustarCurriculoVaga,
    editarResumo,
    adicionarResumo,
    editarExperiencia,
    adicionarExperiencia,
    editarEscolaridade,
    adicionarEscolaridade,
    editarIdioma,
    adicionarIdioma,
    editarHabilidade,
    adicionarHabilidade,
    sincronizarCurriculoPadraoPersistido,
    initEditorFieldGuards,
    atualizarBotaoVagaCapturadaAdmin,
    alternarModalVagaCapturadaAdmin
} from './cv-builder.js';
import { abrirFluxoRevisaoCurriculo } from './editor.js';
import { gerarPDF } from './pdf.js';

function bindWindowGlobals() {
    Object.assign(window, {
        toggleTheme,
        fecharTour,
        proximoTour,
        iniciarTourMenuPrincipal,
        abrirConfigAdmin,
        adicionarPromptAdmin,
        abrirGestaoUsuarios,
        salvarConfigAdmin,
        registrarVersaoAdmin,
        fecharOnboarding,
        mascaraWhats,
        calcularIdadeOnboarding,
        mascaraCep,
        mascaraCpf,
        salvarOnboardingEContinuar,
        irPara,
        voltarTela,
        processarFormularioLogin,
        recuperarSenha,
        alternarModoLogin,
        fazerLoginGoogle,
        fazerLogout,
        abrirFluxoEditorCurriculo,
        abrirFluxoRevisaoCurriculo,
        abrirCurriculosSalvos,
        abrirFluxoAnaliseVaga,
        configurarEntradaLinkVaga,
        atualizarNomeConta,
        atualizarEmail,
        atualizarSenhaConta,
        solicitarExclusao,
        verificarCurriculoBase,
        analisarVagaATS,
        aplicarAjustesVaga,
        ajustarCurriculoVaga,
        definirPadrao,
        carregar,
        duplicar,
        deletar,
        mostrarAlteracoes,
        salvarComo,
        salvar,
        gerarPDF,
        extrairDadosIA,
        syncNome,
        calcularIdadeEditor,
        syncContato,
        adicionarResumo,
        adicionarExperiencia,
        adicionarEscolaridade,
        adicionarIdioma,
        adicionarHabilidade,
        acionarRecalculoATS,
        toggleFullscreenCV,
        editarResumo,
        editarExperiencia,
        editarEscolaridade,
        editarIdioma,
        editarHabilidade,
        marcarAlteracao,
        deletarUsuarioAdmin,
        reabilitarUsuarioAdmin,
        excluirUsuarioDefinitivo,
        atualizarBotaoVagaCapturadaAdmin,
        alternarModalVagaCapturadaAdmin,
        fecharAviso,
        fecharConfirmacao,
        responderConfirmacao
    });
}

bindWindowGlobals();

window.addEventListener('beforeunload', function (e) {
    const telaEditor = document.getElementById('tela-editor');
    if (telaEditor && telaEditor.classList.contains('ativa') && appState.temAlteracoesNaoSalvas) {
        e.preventDefault();
        e.returnValue = 'Deseja seguir com a atualização da página? Todos seus dados não salvos serão perdidos!';
        return e.returnValue;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initDebugPanel();
    sincronizarVersaoAppNaTela().catch(() => {});
    initCadastroSenhaEmTempoReal();

    const editorPanel = document.getElementById('editor');
    if (editorPanel) {
        editorPanel.addEventListener('input', marcarAlteracao);
    }

    initEditorFieldGuards();
    configurarEntradaLinkVaga();
});

window.addEventListener('load', async () => {
    logDebug('=== PÁGINA CARREGADA ===');
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
        logDebug('Vaga Mobile recebida via Share.');
        const conteudoMontado = `[ORIGEM DA VAGA: Celular]\n\n${tituloMobile || ''}\n${textoMobile || ''}\n${linkMobile || ''}`.trim();
        localStorage.setItem('vaga_mobile_pendente', conteudoMontado);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const ultimaAtividade = localStorage.getItem('ultima_atividade_app');
    if (ultimaAtividade && (Date.now() - parseInt(ultimaAtividade, 10) > 7200000)) {
        logDebug('Sessão expirada por inatividade.');
        await sb.auth.signOut();
        localStorage.removeItem('ultima_atividade_app');
        irPara('tela-landing');
        return;
    }

    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        logDebug('Usuário LOGADO detectado.');
        appState.usuarioAtual = session.user;
        localStorage.setItem('ultima_atividade_app', Date.now());
        await sincronizarCurriculoPadraoPersistido();
        atualizarInfosUsuarioTopo();
        verificarAdmin();
        atualizarBotaoVagaCapturadaAdmin();

        const idVagaPendente = localStorage.getItem('vaga_pendente_importacao');
        const textoMobilePendente = localStorage.getItem('vaga_mobile_pendente');

        if (idVagaPendente) {
            logDebug(`Chamando receberVagaExterna() com ID: ${idVagaPendente}`);
            receberVagaExterna(idVagaPendente);
        } else if (textoMobilePendente) {
            logDebug('Processando vaga mobile pendente.');
            receberVagaMobile(textoMobilePendente);
        } else {
            logDebug('Sem vaga pendente. Recuperando estado da tela.');
            recuperarEstadoTela();
        }
    } else {
        logDebug('Usuário DESLOGADO.');
        const idVagaPendente = localStorage.getItem('vaga_pendente_importacao');
        const textoMobilePendente = localStorage.getItem('vaga_mobile_pendente');
        if (idVagaPendente || textoMobilePendente) {
            logDebug('Exibindo alerta de login obrigatório para o usuário.');
            mostrarAviso('Sua vaga já foi capturada e está aguardando processamento.\n\nFaça login ou crie sua conta agora para que a Inteligência Artificial preencha o seu currículo.', {
                title: 'Vaga aguardando você'
            });
        }
        irPara('tela-landing');
    }

    sb.auth.onAuthStateChange(async (event, session) => {
        logDebug(`Auth State Alterado: ${event}`);
        if (event === 'SIGNED_IN' && session) {
            appState.usuarioAtual = session.user;
            localStorage.setItem('ultima_atividade_app', Date.now());
            await sincronizarCurriculoPadraoPersistido();
            atualizarInfosUsuarioTopo();
            verificarAdmin();

            const idVagaPendente = localStorage.getItem('vaga_pendente_importacao');
            const textoMobilePendente = localStorage.getItem('vaga_mobile_pendente');

            if (idVagaPendente) {
                logDebug('Pós-login: Vaga pendente encontrada. Chamando receberVagaExterna()');
                receberVagaExterna(idVagaPendente);
            } else if (textoMobilePendente) {
                receberVagaMobile(textoMobilePendente);
            } else {
                const tl = document.getElementById('tela-login');
                const tld = document.getElementById('tela-landing');
                if ((tl && tl.classList.contains('ativa')) || (tld && tld.classList.contains('ativa'))) {
                    recuperarEstadoTela();
                }
            }
        } else if (event === 'SIGNED_OUT') {
            appState.usuarioAtual = null;
            verificarAdmin();
            irPara('tela-landing');
        }
    });

    const cv = document.getElementById('curriculo');
    if (cv) {
        const observer = new MutationObserver(ajustarZoomMobile);
        observer.observe(cv, { childList: true, subtree: true, characterData: true });
    }
    setTimeout(ajustarZoomMobile, 100);
});

window.addEventListener('resize', ajustarZoomMobile);
