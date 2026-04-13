import {
    sb,
    appState,
    DEFAULT_PROMPT_SIMPLES,
    DEFAULT_PROMPT_AGRESSIVO,
    DEFAULT_PROMPT_ATS,
    atualizarSugestoesAtsEstruturadas
} from './config.js';
import { carregarPromptIA, logDebug, processarIA, PROMPT_NAMES } from './api.js';
import {
    getValSafe,
    setValSafe,
    showToast,
    irPara,
    ocultarCarregamento,
    mostrarCarregamento,
    atualizarStatusOrigem,
    renderizarATS,
    mostrarCarregamentoATS,
    mostrarAviso
} from './ui.js';
import { abrirGestaoUsuarios, usuarioEhAdmin } from './auth.js';
import { carregar, abrirCurriculosSalvos, limparTudo, marcarAlteracao, preencherEditor } from './editor.js';

function normalizarTextoBusca(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function detectarVagaInativa(texto) {
    const normalizado = normalizarTextoBusca(texto);
    const termoEncerrado = /(vaga|inscricoes|candidaturas|processo seletivo)\s+(encerrad[ao]s?|expirad[ao]s?|fechad[ao]s?|finalizad[ao]s?)|prazo\s+(encerrado|expirado|vencido)/i;
    if (termoEncerrado.test(normalizado)) {
        return 'O texto informa que a vaga ou as inscrições estão encerradas.';
    }

    const matchData = String(texto || '').match(/(?:vaga|inscri[cç][oõ]es?|candidaturas?|prazo)[^\n\r]{0,35}(?:encerrad[ao]s?|expirad[ao]s?|ate|até|limite|final)[^\d]{0,10}(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
    if (matchData) {
        const ano = Number(matchData[3].length === 2 ? `20${matchData[3]}` : matchData[3]);
        const dataLimite = new Date(ano, Number(matchData[2]) - 1, Number(matchData[1]), 23, 59, 59, 999);
        if (!Number.isNaN(dataLimite.getTime()) && dataLimite < new Date()) {
            return `O prazo da vaga terminou em ${matchData[1].padStart(2, '0')}/${matchData[2].padStart(2, '0')}/${matchData[3]}.`;
        }
    }

    return '';
}

async function usuarioTemCurriculoBase() {
    const { data, error } = await sb
        .from('curriculos_saas')
        .select('identificador')
        .eq('user_id', appState.usuarioAtual.id)
        .limit(1);
    return !error && Array.isArray(data) && data.length > 0;
}

function registrarVagaCapturadaAdmin(texto) {
    sessionStorage.setItem('ultima_vaga_capturada', texto || '');
    atualizarBotaoVagaCapturadaAdmin();
}

export function atualizarBotaoVagaCapturadaAdmin() {
    const btn = document.getElementById('btn-vaga-capturada-admin');
    if (!btn) return;
    const temTexto = Boolean(sessionStorage.getItem('ultima_vaga_capturada'));
    btn.style.display = usuarioEhAdmin() && temTexto ? 'block' : 'none';
}

export function alternarModalVagaCapturadaAdmin() {
    const modal = document.getElementById('modal-vaga-capturada-admin');
    const txt = document.getElementById('texto-vaga-capturada-admin');
    if (!modal || !txt) return;
    txt.value = sessionStorage.getItem('ultima_vaga_capturada') || '';
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

export function recuperarEstadoTela() {
    const telaSalva = localStorage.getItem('telaRecuperacao');
    const cvSalvo = localStorage.getItem('cvRecuperacao');

    if (telaSalva === 'tela-editor' && cvSalvo) {
        carregar(cvSalvo);
    } else if (telaSalva === 'tela-editor' && !cvSalvo) {
        irPara('tela-menu');
    } else if (telaSalva && document.getElementById(telaSalva)) {
        if (telaSalva === 'tela-lista') abrirCurriculosSalvos();
        else if (telaSalva === 'tela-vaga') abrirFluxoAnaliseVaga();
        else if (telaSalva === 'tela-admin-usuarios') abrirGestaoUsuarios();
        else irPara(telaSalva);
    } else {
        irPara('tela-menu');
    }
}

export async function receberVagaExterna(idTransferencia) {
    logDebug(`=== Início: receberVagaExterna (${idTransferencia}) ===`);
    if (window.isImportingVaga) {
        logDebug('⛔ Execução bloqueada: Trava anti-colisão ativa (window.isImportingVaga = true).');
        return;
    }
    window.isImportingVaga = true;
    logDebug('Trava anti-colisão ativada.');

    try {
        mostrarCarregamento();
        document.getElementById('loading-text').innerText = 'Validando conteúdo da vaga importada...';

        logDebug('Buscando vaga no Supabase...');
        const { data, error } = await sb.from('transferencias_vagas').select('texto').eq('id', idTransferencia).single();

        if (error) {
            logDebug(`❌ ERRO BANCO (Supabase): ${error.message} (Code: ${error.code})`, true);
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        if (!data || !data.texto) {
            logDebug('❌ ERRO: Dados vieram em branco do Supabase.', true);
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        logDebug('✅ Vaga encontrada no banco. Acionando a IA para validação...');
        const textoVaga = data.texto;
        registrarVagaCapturadaAdmin(textoVaga);

        const motivoInativa = detectarVagaInativa(textoVaga);
        if (motivoInativa) {
            logDebug(`⛔ Vaga bloqueada por validação local: ${motivoInativa}`, true);
            mostrarAviso(`Esta vaga não será importada.\n\n${motivoInativa}`, {
                title: 'Vaga encerrada ou inválida'
            });
            localStorage.removeItem('vaga_pendente_importacao');
            await sb.from('transferencias_vagas').delete().eq('id', idTransferencia);
            irPara('tela-menu');
            return;
        }

        const temCurriculo = await usuarioTemCurriculoBase();
        if (!temCurriculo) {
            mostrarAviso('Antes de ajustar uma vaga, cadastre primeiro um currículo base.\n\nVocê pode criar manualmente ou importar um currículo existente. Depois envie a vaga novamente pela extensão para análise.', {
                title: 'Falta seu currículo base'
            });
            localStorage.removeItem('vaga_pendente_importacao');
            await sb.from('transferencias_vagas').delete().eq('id', idTransferencia);
            irPara('tela-menu');
            return;
        }

        const promptValidacao = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Motivo da reprovação"}. Texto: ${textoVaga.substring(0, 1000)}`;
        const validacao = await processarIA(promptValidacao, {
            promptNameFallback: PROMPT_NAMES.validarVagaImportada,
            transformPromptContent: template => template.replace('{{TEXTO_VAGA}}', textoVaga.substring(0, 1000))
        });
        logDebug(`Resposta da IA recebida: ${JSON.stringify(validacao)}`);

        if (validacao && validacao.valida === false) {
            logDebug('⛔ IA reprovou o conteúdo da vaga.', true);
            mostrarAviso(`Não foi possível importar esta vaga.\n\nMotivo apontado pela IA: ${validacao.motivo || 'Conteúdo não reconhecido como vaga de emprego.'}\n\nSe a vaga for real, tente copiar e colar o texto manualmente.`, {
                title: 'Importação bloqueada'
            });
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        logDebug('✅ Vaga Aprovada. Preenchendo a tela...');
        localStorage.removeItem('vaga_pendente_importacao');
        await abrirFluxoAnaliseVaga();

        const txtEl = document.getElementById('texto-vaga');
        if (txtEl) {
            txtEl.value = textoVaga;
            txtEl.dispatchEvent(new Event('input'));
        }

        showToast('✨ Vaga capturada com sucesso! Selecione seu currículo base.');
        logDebug('Deletando vaga temporária do banco...');
        await sb.from('transferencias_vagas').delete().eq('id', idTransferencia);
        logDebug('=== Processo Finalizado com Sucesso ===');
    } catch (e) {
        logDebug(`❌ ERRO FATAL no Try/Catch: ${e.message}`, true);
        console.error(e);
        localStorage.removeItem('vaga_pendente_importacao');
        irPara('tela-menu');
    } finally {
        window.isImportingVaga = false;
        logDebug('Trava anti-colisão liberada.');
        ocultarCarregamento();
    }
}

export async function receberVagaMobile(textoCompleto) {
    localStorage.removeItem('vaga_mobile_pendente');
    registrarVagaCapturadaAdmin(textoCompleto);
    const motivoInativa = detectarVagaInativa(textoCompleto);
    if (motivoInativa) {
        mostrarAviso(`Esta vaga não será importada.\n\n${motivoInativa}`, {
            title: 'Vaga encerrada ou inválida'
        });
        irPara('tela-menu');
        return;
    }
    if (!await usuarioTemCurriculoBase()) {
        mostrarAviso('Antes de ajustar uma vaga, cadastre primeiro um currículo base.\n\nVocê pode criar manualmente ou importar um currículo existente. Depois envie a vaga novamente para análise.', {
            title: 'Falta seu currículo base'
        });
        irPara('tela-menu');
        return;
    }
    await abrirFluxoAnaliseVaga();
    const txtEl = document.getElementById('texto-vaga');
    if (txtEl) txtEl.value = textoCompleto;
    showToast('📱 Vaga recebida do celular! Selecione o seu currículo base e clique em Gerar.');
}

export async function abrirTelaVaga() {
    irPara('tela-vaga');
    const select = document.getElementById('select-curriculo-base');
    if (!select) return;
    select.innerHTML = '<option>Carregando...</option>';
    const aviso = document.getElementById('aviso-cv-incompleto');
    if (aviso) aviso.style.display = 'none';

    const { data, error } = await sb.from('curriculos_saas').select('identificador').eq('user_id', appState.usuarioAtual.id);
    if (error || !data || data.length === 0) {
        select.innerHTML = "<option value=''>Nenhum currículo salvo.</option>";
        if (aviso) {
            aviso.innerHTML = '<b>⚠️ Cadastre um currículo primeiro:</b> crie manualmente ou importe um currículo existente. Ele será usado como base padrão e então você poderá enviar a vaga novamente para análise.';
            aviso.style.display = 'block';
        }
        return;
    }

    const padraoId = localStorage.getItem('cv_padrao_' + appState.usuarioAtual.id);

    select.innerHTML = "<option value=''>-- Selecione o seu currículo --</option>";
    data.forEach(item => {
        const isSelected = item.identificador === padraoId ? 'selected' : '';
        select.innerHTML += `<option value="${item.identificador}" ${isSelected}>${item.identificador} ${item.identificador === padraoId ? '(⭐ Padrão)' : ''}</option>`;
    });

    if (padraoId) verificarCurriculoBase();
}

export async function abrirFluxoAnaliseVaga() {
    await abrirTelaVaga();
}

export async function verificarCurriculoBase() {
    const idBase = getValSafe('select-curriculo-base');
    const aviso = document.getElementById('aviso-cv-incompleto');
    if (!aviso) return;
    if (!idBase) {
        aviso.style.display = 'none';
        return;
    }

    try {
        const { data } = await sb.from('curriculos_saas').select('conteudo').eq('identificador', idBase).eq('user_id', appState.usuarioAtual.id).single();
        if (data && data.conteudo) {
            const c = data.conteudo;
            let valido = true;

            const resumoText = c.resumo ? c.resumo.join(' ') : '';
            if (resumoText.length < 50) valido = false;
            if (!c.experiencias || c.experiencias.length === 0) valido = false;
            if (!c.habilidades || c.habilidades.length === 0) valido = false;

            aviso.style.display = !valido ? 'block' : 'none';
        }
    } catch (e) {
        console.error('Erro validação base', e);
    }
}

export async function ajustarCurriculoVaga() {
    const idBase = getValSafe('select-curriculo-base');
    const textoVaga = getValSafe('texto-vaga');
    const nivelAjuste = getValSafe('nivel-ajuste');
    if (!idBase) return mostrarAviso('Cadastre ou selecione um currículo base antes de ajustar a vaga.');
    if (!textoVaga) return mostrarAviso('Cole ou envie uma descrição de vaga antes de gerar o ajuste.');

    const motivoInativa = detectarVagaInativa(textoVaga);
    if (motivoInativa) return mostrarAviso(`Esta vaga não parece ativa.\n\n${motivoInativa}`, {
        title: 'Vaga encerrada ou inválida'
    });

    mostrarCarregamento();

    try {
        document.getElementById('loading-text').innerText = 'Analisando a vaga...';
        const promptValidacao = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Explique resumidamente por que não parece uma vaga ativa"}. Texto: ${textoVaga.substring(0, 1500)}`;
        const validacao = await processarIA(promptValidacao, {
            promptNameFallback: PROMPT_NAMES.validarVagaAjuste,
            transformPromptContent: template => template.replace('{{TEXTO_VAGA}}', textoVaga.substring(0, 1500))
        });

        if (validacao && validacao.valida === false) {
            ocultarCarregamento();
            mostrarAviso(`Aviso da IA sobre a vaga:\n\n${validacao.motivo || 'O texto inserido não parece conter os dados de uma vaga de emprego.'}`, {
                title: 'Não foi possível seguir'
            });
            return;
        }

        document.getElementById('loading-text').innerText = 'Reescrevendo o seu currículo...';

        const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', idBase).eq('user_id', appState.usuarioAtual.id).single();
        if (!data) throw new Error('Erro ao ler currículo base.');
        const c = data.conteudo;
        const regexLimpa = /\[editar\]|\[remover\]|\[x\]/g;
        const dadosDoCandidato = {
            nome: c.pessoais.nome,
            endereco: c.pessoais.end,
            cep: c.pessoais.cep,
            email: c.pessoais.email,
            whatsapp: c.pessoais.whats,
            linkedin: c.pessoais.linkedin,
            resumo: c.resumo ? c.resumo.join('\n').replace(regexLimpa, '') : '',
            experiencias: c.experiencias ? c.experiencias.map(e => {
                const dates = e.data.split(' — ');
                return { cargo: e.cargo, empresa: e.empresa, ini: dates[0] || '', fim: dates[1] || '', desc: e.desc.replace(regexLimpa, '') };
            }) : [],
            formacao: c.escolaridade ? c.escolaridade.map(esc => {
                const p = esc.replace(regexLimpa, '').split(':');
                return { curso: p[0] ? p[0].trim() : '', inst: '', ini: '', status: p[1] ? p[1].trim() : '' };
            }) : [],
            idiomas: c.idiomas ? c.idiomas.map(i => {
                const p = i.replace(regexLimpa, '').split(':');
                return { nome: p[0] ? p[0].trim() : '', nivel: p[1] ? p[1].trim() : '' };
            }) : [],
            habilidades: c.habilidades ? c.habilidades.map(h => h.replace(regexLimpa, '')) : []
        };
        const promptAgressivoDb = await carregarPromptIA(PROMPT_NAMES.agressivo, { logMissing: false });
        const promptSimplesDb = await carregarPromptIA(PROMPT_NAMES.simples, { logMissing: false });

        const basePrompt = nivelAjuste === 'agressivo'
            ? (promptAgressivoDb?.prompt_content || localStorage.getItem('adminPromptAgressivo') || DEFAULT_PROMPT_AGRESSIVO)
            : (promptSimplesDb?.prompt_content || localStorage.getItem('adminPromptSimples') || DEFAULT_PROMPT_SIMPLES);

        const promptAjustado = `${basePrompt} STATUS FORMAÇÃO: Obrigatório manter/reescrever para um dos: "Concluído", "Cursando", "Trancado".`;
        const prompt = `${promptAjustado} DADOS: ${JSON.stringify(dadosDoCandidato)} VAGA: ${textoVaga}`;
        const extraido = await processarIA(prompt);

        limparTudo();
        appState.vagaOriginalAtual = textoVaga;

        const alertaMail = document.getElementById('alerta-email-vaga');
        if (extraido.email_envio_vaga && extraido.email_envio_vaga.includes('@')) {
            document.getElementById('texto-email-vaga').innerText = extraido.email_envio_vaga;
            alertaMail.style.display = 'block';
        }

        if (extraido.resumo_alteracoes) {
            appState.ultimasAlteracoesIA = extraido.resumo_alteracoes;
            document.getElementById('btn-ver-alteracoes').style.display = 'inline-flex';
        }

        const matchOrigem = textoVaga.match(/\[ORIGEM DA VAGA: (.*?)\]/);
        appState.origemAtual = matchOrigem ? `Adaptado da vaga (${matchOrigem[1]})` : 'Adaptado da vaga (Texto copiado)';
        atualizarStatusOrigem();

        const primeiroNome = (extraido.nome || 'Candidato').split(' ')[0];
        const tituloVagaFormatado = extraido.titulo_vaga || 'Vaga Ajustada';
        appState.idAtual = `${primeiroNome} - ${tituloVagaFormatado}`;

        localStorage.setItem('cvRecuperacao', appState.idAtual);
        const sn = document.getElementById('status-nome');
        if (sn) sn.innerText = '📄 Currículo: ' + appState.idAtual;

        if (c.pessoais) {
            setValSafe('inData', c.pessoais.data || '');
            setValSafe('inIdade', c.pessoais.idade || '');
            setValSafe('inVaga', c.pessoais.vaga || '');
            setValSafe('inStatus', c.pessoais.status || 'Ativo (Empregado)');
            setValSafe('inPretensao', c.pessoais.pretensao || '');
            const chk = document.getElementById('chkPretensao');
            if (chk) chk.checked = !!c.pessoais.mostrarPretensao;
        }

        document.getElementById('panel-ia-extracao').style.display = 'none';

        preencherEditor(extraido);
        marcarAlteracao();
        irPara('tela-editor');
        gerarAtsEmSegundoPlano(textoVaga, extraido);

        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'none';
    } catch (err) {
        if (err.message !== 'Erro JSON.') mostrarAviso('Não foi possível ajustar o currículo para essa vaga.\n\nDetalhe: ' + err.message, { tone: 'erro' });
    } finally {
        ocultarCarregamento();
    }
}

async function gerarAtsEmSegundoPlano(textoVaga, curriculoAdaptado, abrirPainel = true) {
    mostrarCarregamentoATS(abrirPainel);
    try {
        const promptAtsBase = (await carregarPromptIA(PROMPT_NAMES.ats, { logMissing: false }))?.prompt_content
            || localStorage.getItem('adminPromptAts')
            || DEFAULT_PROMPT_ATS;
        const promptFinalAts = promptAtsBase.replace('{{VAGA}}', textoVaga).replace('{{CURRICULO}}', JSON.stringify(curriculoAdaptado));

        const resultadoAts = await processarIA(promptFinalAts);
        appState.analiseAtsAtual = resultadoAts;
        atualizarSugestoesAtsEstruturadas(resultadoAts);
        renderizarATS(resultadoAts);
    } catch (errAts) {
        console.error('Erro na Análise ATS assíncrona.', errAts);
        const titulo = document.getElementById('titulo-ats-lateral');
        if (titulo) titulo.innerText = '⚠️ Erro ao gerar Score. Tente novamente.';
    }
}

export async function acionarRecalculoATS(e) {
    e.stopPropagation();
    const btn = document.getElementById('btn-recalcular-ats');

    btn.disabled = true;
    btn.innerText = '⏳';
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

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
            return { curso: raw.curso || el.innerText.replace(regexClean, '').trim(), status: raw.status || '' };
        }),
        idiomas: Array.from(document.querySelectorAll('#preIdi .item-lista')).map(el => ({ nome: el.innerText.replace(regexClean, '').trim() })),
        habilidades: Array.from(document.querySelectorAll('#preHab .item-lista')).map(el => el.innerText.replace(regexClean, '').trim())
    };

    await gerarAtsEmSegundoPlano(appState.vagaOriginalAtual, cvAtualMontado, false);

    btn.innerText = '🔄';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.style.display = 'none';
}

export const FLUXO_ANALISE_VAGA = Object.freeze({
    atualizarBotaoVagaCapturadaAdmin,
    alternarModalVagaCapturadaAdmin,
    abrirFluxoAnaliseVaga,
    receberVagaExterna,
    receberVagaMobile,
    abrirTelaVaga,
    verificarCurriculoBase,
    acionarRecalculoATS,
    ajustarCurriculoVaga
});
