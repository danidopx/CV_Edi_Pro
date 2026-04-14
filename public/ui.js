import { appState, tourTextos } from './config.js';

let resolverConfirmacaoAtual = null;
let valorConfirmacaoSecundaria = 'secondary';

export function setValSafe(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
}

export function getValSafe(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

export function fecharAbaPai(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        const details = el.closest('details');
        if (details) details.removeAttribute('open');
    }
}

export function syncNome() {
    const el = document.getElementById('inNome');
    const prev = document.getElementById('nomePreview');
    if (el && prev) prev.innerText = el.value || 'NOME COMPLETO';
}

export function atualizarStatusOrigem() {
    const el = document.getElementById('status-origem');
    if (el) el.innerText = 'Origem: ' + appState.origemAtual;
}

export function syncContato() {
    const idade = getValSafe('inIdade');
    const end = getValSafe('inEnd');
    const email = getValSafe('inEmail');
    const whats = getValSafe('inWhats');
    const linkedin = getValSafe('inLinkedin');
    const pretensao = getValSafe('inPretensao');
    const mostrarPretensao = document.getElementById('chkPretensao')?.checked;
    const partes = [];
    if (idade) partes.push(`${idade} anos`);
    if (end) partes.push(end);
    if (email) partes.push(email);
    if (whats) partes.push(whats);
    if (linkedin) partes.push(linkedin);
    if (mostrarPretensao && pretensao) partes.push(`Pretensão: ${pretensao}`);
    const prev = document.getElementById('contatoPreview');
    if (prev) prev.innerText = partes.length > 0 ? partes.join(' | ') : '...';
}

export function mascaraWhats(i) {
    if (!i) return;
    let v = i.value.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
    i.value = v.substring(0, 15);
    syncContato();
}

export function mascaraCep(i) {
    if (!i) return;
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/^(\d{5})(\d)/, '$1-$2');
    i.value = v.substring(0, 9);
    syncContato();
}

export function mascaraCpf(i) {
    if (!i) return;
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    i.value = v.substring(0, 14);
}

export function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = msg || '✔ Operação realizada com sucesso!';
        t.style.background = msg && msg.includes('login') ? 'var(--primary)' : 'var(--accent)';
        t.style.display = 'block';
        setTimeout(() => { t.style.display = 'none'; }, 4000);
    }
}

function escaparHtmlAviso(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function mostrarAviso(mensagem, options = {}) {
    const modal = document.getElementById('modal-aviso');
    const titulo = document.getElementById('modal-aviso-titulo');
    const corpo = document.getElementById('modal-aviso-mensagem');
    const botao = document.getElementById('modal-aviso-botao');
    const tone = options.tone || 'info';

    if (!modal || !titulo || !corpo || !botao) {
        window.alert(mensagem);
        return;
    }

    const tituloPadrao = tone === 'erro'
        ? 'Algo precisa da sua atenção'
        : tone === 'sucesso'
            ? 'Tudo certo'
            : 'Aviso';

    const cores = {
        info: 'var(--primary)',
        erro: 'var(--danger)',
        sucesso: 'var(--accent)'
    };

    titulo.textContent = options.title || tituloPadrao;
    titulo.style.color = cores[tone] || cores.info;
    corpo.innerHTML = escaparHtmlAviso(mensagem).replace(/\n/g, '<br>');
    botao.textContent = options.buttonLabel || 'Entendi';
    modal.style.display = 'flex';
}

export function fecharAviso() {
    const modal = document.getElementById('modal-aviso');
    if (modal) modal.style.display = 'none';
}

export function mostrarConfirmacao(mensagem, options = {}) {
    const modal = document.getElementById('modal-confirmacao');
    const titulo = document.getElementById('modal-confirmacao-titulo');
    const corpo = document.getElementById('modal-confirmacao-mensagem');
    const botaoConfirmar = document.getElementById('modal-confirmacao-confirmar');
    const botaoCancelar = document.getElementById('modal-confirmacao-cancelar');
    const botaoSecundario = document.getElementById('modal-confirmacao-secundario');
    const tone = options.tone || 'info';

    if (!modal || !titulo || !corpo || !botaoConfirmar || !botaoCancelar || !botaoSecundario) {
        return Promise.resolve(window.confirm(mensagem));
    }

    if (resolverConfirmacaoAtual) {
        resolverConfirmacaoAtual(false);
        resolverConfirmacaoAtual = null;
    }

    const tituloPadrao = tone === 'erro' ? 'Confirme esta ação' : 'Deseja continuar?';
    const cores = {
        info: 'var(--primary)',
        erro: 'var(--danger)',
        sucesso: 'var(--accent)'
    };

    titulo.textContent = options.title || tituloPadrao;
    titulo.style.color = cores[tone] || cores.info;
    corpo.innerHTML = escaparHtmlAviso(mensagem).replace(/\n/g, '<br>');
    botaoConfirmar.textContent = options.confirmLabel || 'Continuar';
    botaoCancelar.textContent = options.cancelLabel || 'Cancelar';
    botaoConfirmar.className = `btn-base ${tone === 'erro' ? 'btn-danger' : 'btn-accent'}`;
    valorConfirmacaoSecundaria = options.secondaryValue ?? 'secondary';
    if (options.secondaryLabel) {
        botaoSecundario.textContent = options.secondaryLabel;
        botaoSecundario.style.display = 'inline-flex';
    } else {
        botaoSecundario.style.display = 'none';
    }
    modal.style.display = 'flex';

    return new Promise(resolve => {
        resolverConfirmacaoAtual = resolve;
    });
}

export function responderConfirmacao(confirmado) {
    const modal = document.getElementById('modal-confirmacao');
    if (modal) modal.style.display = 'none';
    if (resolverConfirmacaoAtual) {
        if (confirmado === 'secondary') {
            resolverConfirmacaoAtual(valorConfirmacaoSecundaria);
        } else {
            resolverConfirmacaoAtual(confirmado);
        }
        resolverConfirmacaoAtual = null;
    }
}

export function fecharConfirmacao() {
    responderConfirmacao(false);
}

export function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        const b = document.querySelector('.btn-luz');
        if (b) b.innerText = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        const b = document.querySelector('.btn-luz');
        if (b) b.innerText = '💡';
    }
}

export function toggleTheme() {
    const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('themePreference', newTheme);
    applyTheme(newTheme);
}

async function confirmarSaidaComAlteracoes() {
    return mostrarConfirmacao('Existem alterações não salvas. Deseja sair desta tela mesmo assim?', {
        title: 'Alterações não salvas',
        confirmLabel: 'Salvar e sair',
        secondaryLabel: 'Sair sem salvar',
        secondaryValue: 'discard',
        cancelLabel: 'Continuar editando',
        tone: 'erro'
    });
}

export async function irPara(id) {
    const telaEditor = document.getElementById('tela-editor');
    const saindoDoEditor = telaEditor && telaEditor.classList.contains('ativa') && id !== 'tela-editor';

    if (saindoDoEditor && appState.temAlteracoesNaoSalvas) {
        const acaoSaida = await confirmarSaidaComAlteracoes();
        if (!acaoSaida) return;
        if (acaoSaida === true) {
            const salvou = await window.salvar?.();
            if (!salvou) return;
        } else if (acaoSaida === 'discard') {
            appState.temAlteracoesNaoSalvas = false;
        }
    }

    const telaAtiva = document.querySelector('.tela.ativa');
    if (telaAtiva && telaAtiva.id !== id && telaAtiva.id !== 'tela-landing' && telaAtiva.id !== 'tela-login') {
        appState.historicoTelas.push(telaAtiva.id);
    }
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const dest = document.getElementById(id);
    if (dest) dest.classList.add('ativa');

    if (id !== 'tela-landing' && id !== 'tela-login') {
        localStorage.setItem('telaRecuperacao', id);
        if (appState.idAtual) localStorage.setItem('cvRecuperacao', appState.idAtual);
        else localStorage.removeItem('cvRecuperacao');
    }

    window.scrollTo(0, 0);
    setTimeout(ajustarZoomMobile, 50);
}

export async function voltarTela() {
    const telaEditor = document.getElementById('tela-editor');
    const saindoDoEditor = telaEditor && telaEditor.classList.contains('ativa');

    if (saindoDoEditor && appState.temAlteracoesNaoSalvas) {
        const acaoSaida = await confirmarSaidaComAlteracoes();
        if (!acaoSaida) return;
        if (acaoSaida === true) {
            const salvou = await window.salvar?.();
            if (!salvou) return;
        } else if (acaoSaida === 'discard') {
            appState.temAlteracoesNaoSalvas = false;
        }
    }

    if (appState.historicoTelas.length > 0) {
        const id = appState.historicoTelas.pop();

        if (id === 'tela-lista' && typeof window.abrirCurriculosSalvos === 'function') {
            window.abrirCurriculosSalvos();
            return;
        }

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

export function mostrarCarregamento() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

export function ocultarCarregamento() {
    document.getElementById('loading-overlay').style.display = 'none';
}

export function mostrarAlteracoes() {
    document.getElementById('texto-alteracoes-ia').innerText = appState.ultimasAlteracoesIA || 'Nenhum resumo de alteração foi gerado pela IA para este currículo.';
    document.getElementById('modal-alteracoes').style.display = 'flex';
}

export function mostrarCarregamentoATS(abrirPainel = true) {
    const detailsAts = document.getElementById('details-ats');
    const painelConteudo = document.getElementById('painel-ats-conteudo');
    const badgeScore = document.getElementById('badge-score-ats');
    const titulo = document.getElementById('titulo-ats-lateral');

    if (titulo) titulo.innerText = '⏳ Analisando vaga...';
    if (badgeScore) {
        badgeScore.innerHTML = ' ... ';
        badgeScore.style.background = 'var(--text-light)';
    }

    if (painelConteudo) {
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

export function renderizarATS(dados) {
    const detailsAts = document.getElementById('details-ats');
    const painelConteudo = document.getElementById('painel-ats-conteudo');
    const badgeScore = document.getElementById('badge-score-ats');
    const titulo = document.getElementById('titulo-ats-lateral');

    if (!dados || !painelConteudo || !badgeScore) {
        if (detailsAts) detailsAts.style.display = 'none';
        return;
    }

    if (titulo) titulo.innerText = '📊 Análise da Vaga';

    const pontuacao = dados.score || 0;
    const corScore = pontuacao >= 75 ? 'var(--accent)' : (pontuacao >= 50 ? '#f39c12' : 'var(--danger)');

    badgeScore.innerHTML = `<span style="font-size: 10px; font-weight: normal; opacity: 0.9; margin-right: 4px; letter-spacing: 0.5px;">SCORE</span>${pontuacao}`;
    badgeScore.style.background = corScore;

    const riscoTxt = (dados.risco || '').toLowerCase();
    const corRisco = riscoTxt.includes('baixo') ? 'var(--accent)' : (riscoTxt.includes('médio') || riscoTxt.includes('medio') ? '#f39c12' : 'var(--danger)');

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

export function ajustarZoomMobile() {
    const wrapper = document.getElementById('curriculo-wrapper');
    const curriculo = document.getElementById('curriculo');
    if (wrapper && curriculo) {
        if (window.innerWidth <= 1024 && !wrapper.classList.contains('wrapper-fullscreen')) {
            const larguraDisponivel = wrapper.clientWidth - 30;
            const escala = larguraDisponivel / 680;
            curriculo.style.transformOrigin = 'top center';
            curriculo.style.transform = `scale(${escala})`;
            wrapper.style.height = `${curriculo.offsetHeight * escala}px`;
            wrapper.scrollTo(0, 0);
        } else if (!wrapper.classList.contains('wrapper-fullscreen')) {
            curriculo.style.transform = 'none';
            wrapper.style.height = 'auto';
            wrapper.scrollTo(0, 0);
        }
    }
}

export function toggleFullscreenCV() {
    const wrapper = document.getElementById('curriculo-wrapper');
    const cv = document.getElementById('curriculo');
    if (!wrapper || !cv) return;

    if (wrapper.classList.contains('wrapper-fullscreen')) {
        wrapper.classList.remove('wrapper-fullscreen');
        wrapper.scrollTo(0, 0);
        ajustarZoomMobile();
    } else {
        wrapper.classList.add('wrapper-fullscreen');
        cv.style.transform = 'none';
        wrapper.style.height = '100vh';
    }
}

export function fecharFullscreenSeguro() {
    const wrapper = document.getElementById('curriculo-wrapper');
    if (wrapper && wrapper.classList.contains('wrapper-fullscreen')) {
        wrapper.classList.remove('wrapper-fullscreen');
        wrapper.scrollTo(0, 0);
        ajustarZoomMobile();
    }
}

export function calcularIdadeOnboarding() {
    const dateInput = getValSafe('onb-data');
    if (dateInput) {
        const diff = Date.now() - new Date(dateInput).getTime();
        const age = new Date(diff);
        setValSafe('onb-idade', Math.abs(age.getUTCFullYear() - 1970));
    }
}

export function calcularIdadeEditor() {
    const dateInput = getValSafe('inData');
    if (dateInput) {
        const diff = Date.now() - new Date(dateInput).getTime();
        const age = new Date(diff);
        setValSafe('inIdade', Math.abs(age.getUTCFullYear() - 1970));
        syncContato();
    }
}

export function iniciarTour() {
    if (!localStorage.getItem('tourV2')) {
        document.getElementById('tour-panel').style.display = 'block';
        mostrarPassoTour();
    }
}

export function mostrarPassoTour() {
    document.getElementById('tour-text').innerHTML = tourTextos[appState.passoTour];
}

export function proximoTour() {
    appState.passoTour++;
    if (appState.passoTour >= tourTextos.length) {
        fecharTour();
    } else {
        mostrarPassoTour();
    }
}

export function fecharTour() {
    document.getElementById('tour-panel').style.display = 'none';
    localStorage.setItem('tourV2', 'concluido');
}

export function fecharOnboarding() {
    const mod = document.getElementById('modal-onboarding');
    if (mod) mod.style.display = 'none';
    irPara('tela-menu');
}
