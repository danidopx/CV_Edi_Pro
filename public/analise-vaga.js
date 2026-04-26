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
import { carregar, abrirCurriculosSalvos, limparTudo, marcarAlteracao, preencherEditor, sincronizarCurriculoPadraoPersistido } from './editor.js';

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

function contarOcorrencias(texto, termos) {
    return termos.reduce((total, termo) => total + (texto.includes(termo) ? 1 : 0), 0);
}

function validarConteudoVagaLocal(texto) {
    const textoOriginal = String(texto || '').trim();
    const textoSemLinks = textoSemUrls(textoOriginal);
    const normalizado = normalizarTextoBusca(textoSemLinks);

    if (!textoSemLinks || textoSemLinks.length < 80) {
        return {
            ok: false,
            motivo: 'O conteúdo da vaga está muito curto. Cole mais detalhes sobre cargo, requisitos ou responsabilidades.'
        };
    }

    const motivoInativa = detectarVagaInativa(textoSemLinks);
    if (motivoInativa) {
        return { ok: false, motivo: motivoInativa };
    }

    const termosBloqueados = [
        'login',
        'entrar',
        'sign in',
        'sign up',
        'cadastre-se',
        'cadastre se',
        'esqueceu sua senha',
        'criar conta',
        'newsletter',
        'politica de privacidade',
        'termos de uso',
        'cookies',
        'compartilhe',
        'comentarios',
        'comentários',
        'leia mais',
        'promoção',
        'promocao',
        'frete gratis',
        'frete grátis',
        'compre agora',
        'adicionar ao carrinho'
    ];

    const termosVaga = [
        'vaga',
        'oportunidade',
        'cargo',
        'requisitos',
        'responsabilidades',
        'atividades',
        'beneficios',
        'benefícios',
        'salario',
        'salário',
        'empresa',
        'candidatar',
        'candidate-se',
        'curriculo',
        'currículo',
        'experiencia',
        'experiência'
    ];

    const termosRuido = contarOcorrencias(normalizado, termosBloqueados);
    const termosDeVaga = contarOcorrencias(normalizado, termosVaga);

    if (termosRuido >= 3 && termosDeVaga === 0) {
        return {
            ok: false,
            motivo: 'O conteúdo parece ser uma página de login, artigo, propaganda ou página genérica, e não uma vaga.'
        };
    }

    if (termosDeVaga === 0) {
        return {
            ok: false,
            motivo: 'Não encontrei sinais suficientes de uma vaga real, como cargo, requisitos, responsabilidades ou instruções de candidatura.'
        };
    }

    return {
        ok: true,
        motivo: ''
    };
}

function extrairPrimeiraUrl(texto) {
    const match = String(texto || '').match(/https?:\/\/[^\s<>"')]+/i);
    return match ? match[0].trim() : '';
}

function ehUrlValida(url) {
    try {
        const parsed = new URL(String(url || '').trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function textoSemUrls(texto) {
    return String(texto || '')
        .replace(/https?:\/\/[^\s<>"')]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function moverLinkDoTextoParaCampo({ silencioso = false } = {}) {
    const campoTexto = document.getElementById('texto-vaga');
    const campoLink = document.getElementById('link-vaga');
    if (!campoTexto || !campoLink) return false;

    const textoAtual = String(campoTexto.value || '').trim();
    if (!textoAtual) return false;

    const url = extrairPrimeiraUrl(textoAtual);
    if (!ehUrlValida(url)) return false;

    const restante = textoSemUrls(textoAtual);
    if (restante.length > 20) return false;

    campoLink.value = campoLink.value.trim() || url;
    campoTexto.value = restante;

    if (!silencioso) {
        showToast('Link detectado e movido para o campo de URL da vaga.');
    }

    return true;
}

export function configurarEntradaLinkVaga() {
    const campoTexto = document.getElementById('texto-vaga');
    if (!campoTexto || campoTexto.dataset.linkBindingReady === 'true') return;

    campoTexto.dataset.linkBindingReady = 'true';
    campoTexto.addEventListener('blur', () => {
        moverLinkDoTextoParaCampo();
    });
    campoTexto.addEventListener('paste', () => {
        setTimeout(() => {
            moverLinkDoTextoParaCampo();
        }, 0);
    });
}

async function obterTextoVagaParaAnalise() {
    moverLinkDoTextoParaCampo({ silencioso: true });

    const textoManual = getValSafe('texto-vaga').trim();
    const linkVaga = getValSafe('link-vaga').trim();

    if (!textoManual && !linkVaga) {
        return { ok: false, error: 'Cole a descrição da vaga ou informe o link antes de gerar o ajuste.' };
    }

    if (textoManual && !linkVaga) {
        return { ok: true, textoVaga: textoManual, origem: 'texto_manual', origemLabel: 'Texto copiado' };
    }

    if (linkVaga && !ehUrlValida(linkVaga) && textoManual) {
        showToast('O link informado é inválido. O sistema vai usar o texto manual informado.');
        return { ok: true, textoVaga: textoManual, origem: 'texto_manual', origemLabel: 'Texto manual (link inválido)' };
    }

    if (linkVaga && !ehUrlValida(linkVaga)) {
        return { ok: false, error: 'O link informado não é válido.' };
    }

    if (!linkVaga) {
        return { ok: true, textoVaga: textoManual, origem: 'texto_manual', origemLabel: 'Texto copiado' };
    }

    document.getElementById('loading-text').innerText = 'Lendo a vaga pelo link...';

    const response = await fetch('/api/extrair-vaga-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkVaga })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || !payload?.texto) {
        if (textoManual) {
            showToast('Não foi possível ler o link. O sistema vai usar o texto manual informado.');
            return {
                ok: true,
                textoVaga: textoManual,
                origem: 'texto_manual',
                origemLabel: 'Texto manual (fallback do link)'
            };
        }
        return {
            ok: false,
            error: `${payload?.error || 'Não foi possível ler a vaga pelo link informado.'} Cole o texto da vaga manualmente para continuar.`
        };
    }

    const textoFinal = textoManual
        ? `${textoManual}\n\n[LINK DA VAGA: ${payload.url}]\n\n${payload.texto}`.trim()
        : `[ORIGEM DA VAGA: Link]\n[LINK DA VAGA: ${payload.url}]\n\n${payload.texto}`.trim();

    return {
        ok: true,
        textoVaga: textoFinal,
        origem: 'link',
        origemLabel: payload.url
    };
}

async function validarVagaNormalizada(texto, origem) {
    const validacaoLocal = validarConteudoVagaLocal(texto);
    if (!validacaoLocal.ok) {
        return {
            ok: false,
            motivo: validacaoLocal.motivo,
            textoNormalizado: ''
        };
    }

    const response = await fetch('/api/validar-vaga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            texto,
            origem: origem === 'link' ? 'pagina' : 'selecao',
            truncado: texto.length >= 30000
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        return {
            ok: false,
            motivo: payload?.motivo || 'Não foi possível validar a vaga agora. Revise o texto ou tente novamente em instantes.',
            textoNormalizado: ''
        };
    }

    if (payload?.valido !== true) {
        return {
            ok: false,
            motivo: payload?.motivo || 'O conteúdo informado não parece ser uma vaga real.',
            textoNormalizado: ''
        };
    }

    const textoNormalizado = String(payload?.texto_normalizado || texto || '').trim();
    const validacaoFinalLocal = validarConteudoVagaLocal(textoNormalizado);
    if (!validacaoFinalLocal.ok) {
        return {
            ok: false,
            motivo: validacaoFinalLocal.motivo,
            textoNormalizado: ''
        };
    }

    return {
        ok: true,
        motivo: payload?.motivo || '',
        textoNormalizado
    };
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

function atualizarDisponibilidadeAplicacaoVaga(podeAplicar = false) {
    const btn = document.getElementById('btn-aplicar-ajustes-vaga');
    if (!btn) return;
    btn.style.display = podeAplicar ? 'inline-flex' : 'none';
}

function extrairLinkDaVaga(texto) {
    const matchLinkMarcado = String(texto || '').match(/\[LINK DA VAGA:\s*(.*?)\]/i);
    if (matchLinkMarcado?.[1]) return matchLinkMarcado[1].trim();
    return extrairPrimeiraUrl(texto);
}

function atualizarVagaVinculadaAtual({ texto = '', origem = '', origemLabel = '', motivoValidacao = '' } = {}) {
    const textoFinal = String(texto || '').trim();
    if (!textoFinal) {
        appState.vagaVinculadaAtual = null;
        return null;
    }

    const vaga = {
        texto: textoFinal,
        origem_tipo: String(origem || '').trim() || 'texto_manual',
        origem_label: String(origemLabel || '').trim() || 'Texto manual',
        link: extrairLinkDaVaga(textoFinal),
        motivo_validacao: String(motivoValidacao || '').trim(),
        data_vinculacao: new Date().toISOString()
    };

    appState.vagaVinculadaAtual = vaga;
    return vaga;
}

function preencherEntradaVagaComVinculoAtual() {
    const campoTexto = document.getElementById('texto-vaga');
    const campoLink = document.getElementById('link-vaga');
    const vaga = appState.vagaVinculadaAtual;
    if (!campoTexto || !campoLink || !vaga) return;

    campoTexto.value = vaga.texto || '';
    campoLink.value = vaga.link || '';
}

function montarDadosDoHistoricoParaIA(conteudo) {
    const c = conteudo || {};
    const regexLimpa = /\[editar\]|\[remover\]|\[x\]/g;

    return {
        nome: c.pessoais?.nome || '',
        endereco: c.pessoais?.end || '',
        cep: c.pessoais?.cep || '',
        email: c.pessoais?.email || '',
        whatsapp: c.pessoais?.whats || '',
        linkedin: c.pessoais?.linkedin || '',
        resumo: c.resumo ? c.resumo.join('\n').replace(regexLimpa, '') : '',
        experiencias: c.experiencias ? c.experiencias.map(e => {
            const dates = String(e.data || '').split(' — ');
            return { cargo: e.cargo, empresa: e.empresa, ini: dates[0] || '', fim: dates[1] || '', desc: String(e.desc || '').replace(regexLimpa, '') };
        }) : [],
        formacao: c.escolaridade ? c.escolaridade.map(esc => {
            const p = String(esc || '').replace(regexLimpa, '').split(':');
            return { curso: p[0] ? p[0].trim() : '', inst: '', ini: '', status: p[1] ? p[1].trim() : '' };
        }) : [],
        idiomas: c.idiomas ? c.idiomas.map(i => {
            const p = String(i || '').replace(regexLimpa, '').split(':');
            return { nome: p[0] ? p[0].trim() : '', nivel: p[1] ? p[1].trim() : '' };
        }) : [],
        habilidades: c.habilidades ? c.habilidades.map(h => String(h || '').replace(regexLimpa, '')) : []
    };
}

function montarCurriculoAtualDoEditor() {
    const regexClean = /\[editar\]|\[remover\]|\[x\]/g;
    return {
        nome: getValSafe('inNome'),
        resumo: Array.from(document.querySelectorAll('#preRes .texto-justificado')).map(el => el.innerText.replace(regexClean, '').trim()).join('\n'),
        experiencias: Array.from(document.querySelectorAll('.bloco-exp')).map(el => ({
            cargo: el.querySelector('.exp-header span:first-child')?.innerText || '',
            fim: el.querySelector('.exp-header span:last-child')?.innerText || '',
            empresa: el.querySelector('.exp-empresa')?.innerText || '',
            desc: el.querySelector('.texto-justificado')?.innerText.replace(regexClean, '').trim() || ''
        })),
        formacao: Array.from(document.querySelectorAll('#preEsc .item-lista')).map(el => {
            const raw = el.dataset.raw ? JSON.parse(el.dataset.raw) : {};
            return { curso: raw.curso || el.innerText.replace(regexClean, '').trim(), status: raw.status || '' };
        }),
        idiomas: Array.from(document.querySelectorAll('#preIdi .item-lista')).map(el => ({ nome: el.innerText.replace(regexClean, '').trim() })),
        habilidades: Array.from(document.querySelectorAll('#preHab .item-lista')).map(el => el.innerText.replace(regexClean, '').trim())
    };
}

async function obterHistoricoSelecionado(idBase) {
    const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', idBase).eq('user_id', appState.usuarioAtual.id).single();
    if (!data) throw new Error('Erro ao ler o Histórico Profissional.');
    return data;
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
            mostrarAviso('Antes de ajustar uma vaga, cadastre primeiro seu Histórico Profissional.\n\nVocê pode criar manualmente ou importar um currículo existente. Depois envie a vaga novamente pela extensão para análise.', {
                title: 'Falta seu Histórico Profissional'
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

        showToast('✨ Vaga capturada com sucesso! Selecione seu Histórico Profissional.');
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
        mostrarAviso('Antes de ajustar uma vaga, cadastre primeiro seu Histórico Profissional.\n\nVocê pode criar manualmente ou importar um currículo existente. Depois envie a vaga novamente para análise.', {
            title: 'Falta seu Histórico Profissional'
        });
        irPara('tela-menu');
        return;
    }
    await abrirFluxoAnaliseVaga();
    const txtEl = document.getElementById('texto-vaga');
    if (txtEl) txtEl.value = textoCompleto;
    showToast('📱 Vaga recebida do celular! Selecione seu Histórico Profissional e clique em Gerar.');
}

export async function abrirTelaVaga() {
    irPara('tela-vaga');
    atualizarDisponibilidadeAplicacaoVaga(false);
    const select = document.getElementById('select-curriculo-base');
    if (!select) return;
    select.innerHTML = '<option>Carregando...</option>';
    const aviso = document.getElementById('aviso-cv-incompleto');
    if (aviso) aviso.style.display = 'none';

    const { data, error } = await sb.from('curriculos_saas').select('identificador').eq('user_id', appState.usuarioAtual.id);
    if (error || !data || data.length === 0) {
        select.innerHTML = "<option value=''>Nenhum currículo salvo.</option>";
        if (aviso) {
            aviso.innerHTML = '<b>⚠️ Cadastre seu Histórico Profissional primeiro:</b> crie manualmente ou importe um currículo existente. Ele será usado como sua base principal e então você poderá enviar a vaga novamente para análise.';
            aviso.style.display = 'block';
        }
        return;
    }

    const padraoId = await sincronizarCurriculoPadraoPersistido();

    select.innerHTML = "<option value=''>-- Selecione o seu currículo --</option>";
    data.forEach(item => {
        const isSelected = item.identificador === padraoId ? 'selected' : '';
        select.innerHTML += `<option value="${item.identificador}" ${isSelected}>${item.identificador} ${item.identificador === padraoId ? '(⭐ Histórico Principal)' : ''}</option>`;
    });

    if (padraoId) verificarCurriculoBase();

    moverLinkDoTextoParaCampo({ silencioso: true });
    preencherEntradaVagaComVinculoAtual();
}

export async function abrirFluxoAnaliseVaga() {
    await abrirTelaVaga();
}

export async function verificarCurriculoBase() {
    const idBase = getValSafe('select-curriculo-base');
    const aviso = document.getElementById('aviso-cv-incompleto');
    if (!aviso) return;
    if (idBase !== appState.historicoProfissionalAlvoId) {
        atualizarDisponibilidadeAplicacaoVaga(false);
    }
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
    return aplicarAjustesVaga();
}

export async function analisarVagaATS() {
    const idBase = getValSafe('select-curriculo-base');
    if (!idBase) return mostrarAviso('Cadastre ou selecione seu Histórico Profissional antes de analisar a vaga.');

    mostrarCarregamento();

    try {
        const cargaVaga = await obterTextoVagaParaAnalise();
        if (!cargaVaga.ok) {
            ocultarCarregamento();
            mostrarAviso(cargaVaga.error, { title: 'Não foi possível seguir' });
            return;
        }

        const textoVagaBruto = cargaVaga.textoVaga;
        const campoTextoVaga = document.getElementById('texto-vaga');
        if (campoTextoVaga) {
            campoTextoVaga.value = textoVagaBruto;
        }

        document.getElementById('loading-text').innerText = 'Validando a vaga...';
        const validacao = await validarVagaNormalizada(textoVagaBruto, cargaVaga.origem);
        if (!validacao.ok) {
            ocultarCarregamento();
            mostrarAviso(validacao.motivo, {
                title: 'Não foi possível seguir'
            });
            return;
        }

        const textoVaga = validacao.textoNormalizado;
        if (campoTextoVaga) {
            campoTextoVaga.value = textoVaga;
        }

        document.getElementById('loading-text').innerText = 'Calculando a análise ATS...';

        const data = await obterHistoricoSelecionado(idBase);
        const dadosDoCandidato = montarDadosDoHistoricoParaIA(data.conteudo);
        appState.vagaOriginalAtual = textoVaga;
        appState.vagaAnalisadaAtual = textoVaga;
        appState.historicoProfissionalAlvoId = idBase;
        atualizarVagaVinculadaAtual({
            texto: textoVaga,
            origem: cargaVaga.origem,
            origemLabel: cargaVaga.origemLabel,
            motivoValidacao: validacao.motivo
        });
        await gerarAtsEmSegundoPlano(textoVaga, dadosDoCandidato, true, '📊 Análise ATS da Vaga');
        atualizarDisponibilidadeAplicacaoVaga(true);
        showToast('📊 Análise ATS concluída! Revise o resultado e aplique os ajustes somente se desejar.');
    } catch (err) {
        if (err.message !== 'Erro JSON.') mostrarAviso('Não foi possível analisar esta vaga agora.\n\nDetalhe: ' + err.message, { tone: 'erro' });
    } finally {
        ocultarCarregamento();
    }
}

export async function aplicarAjustesVaga() {
    const idBase = getValSafe('select-curriculo-base');
    const nivelAjuste = getValSafe('nivel-ajuste');
    if (!idBase) return mostrarAviso('Cadastre ou selecione seu Histórico Profissional antes de aplicar ajustes.');

    if (!appState.vagaAnalisadaAtual || appState.historicoProfissionalAlvoId !== idBase) {
        return mostrarAviso('Analise a vaga primeiro antes de aplicar os ajustes no currículo.');
    }

    mostrarCarregamento();
    try {
        document.getElementById('loading-text').innerText = 'Aplicando ajustes no currículo...';
        const data = await obterHistoricoSelecionado(idBase);
        const c = data.conteudo;
        const dadosDoCandidato = montarDadosDoHistoricoParaIA(c);
        const textoVaga = appState.vagaAnalisadaAtual;
        const analiseAnterior = appState.analiseAtsAtual;

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
        appState.vagaAnalisadaAtual = textoVaga;
        appState.historicoProfissionalAlvoId = idBase;
        atualizarVagaVinculadaAtual({
            texto: textoVaga,
            origem: appState.vagaVinculadaAtual?.origem_tipo || 'texto_manual',
            origemLabel: appState.vagaVinculadaAtual?.origem_label || 'Texto manual',
            motivoValidacao: appState.vagaVinculadaAtual?.motivo_validacao || ''
        });
        appState.analiseAtsAtual = analiseAnterior;
        atualizarSugestoesAtsEstruturadas(appState.analiseAtsAtual);

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
        const matchLink = textoVaga.match(/\[LINK DA VAGA: (.*?)\]/);
        appState.origemAtual = matchOrigem
            ? `Adaptado da vaga (${matchOrigem[1]})`
            : matchLink
                ? `Adaptado da vaga (${matchLink[1]})`
                : 'Adaptado da vaga (Texto copiado)';
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
        if (appState.analiseAtsAtual) {
            renderizarATS(appState.analiseAtsAtual);
        }
        marcarAlteracao();
        irPara('tela-editor');
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'none';
    } catch (err) {
        if (err.message !== 'Erro JSON.') mostrarAviso('Não foi possível aplicar os ajustes nesta vaga.\n\nDetalhe: ' + err.message, { tone: 'erro' });
    } finally {
        ocultarCarregamento();
    }
}

async function gerarAtsEmSegundoPlano(textoVaga, curriculoAdaptado, abrirPainel = true, contextoTitulo = '📊 Análise ATS') {
    mostrarCarregamentoATS(abrirPainel);
    try {
        let resultadoAts;

        if (textoVaga) {
            const promptAtsBase = (await carregarPromptIA(PROMPT_NAMES.ats, { logMissing: false }))?.prompt_content
                || localStorage.getItem('adminPromptAts')
                || DEFAULT_PROMPT_ATS;
            const promptFinalAts = promptAtsBase.replace('{{VAGA}}', textoVaga).replace('{{CURRICULO}}', JSON.stringify(curriculoAdaptado));
            resultadoAts = await processarIA(promptFinalAts);
        } else {
            const promptGeral = `Você é um avaliador de currículos. Analise a qualidade geral do currículo abaixo sem usar vaga específica.
Retorne APENAS um JSON válido no formato:
{
  "pontos_fortes": ["Ponto 1"],
  "pontos_medios": ["Ponto 1"],
  "pontos_fracos": ["Ponto 1"],
  "score": 85,
  "risco": "Baixo",
  "motivo_risco": "Breve explicação",
  "sugestoes": ["Sugestão 1"]
}
CURRÍCULO: ${JSON.stringify(curriculoAdaptado)}`;
            resultadoAts = await processarIA(promptGeral);
        }

        appState.analiseAtsAtual = {
            ...resultadoAts,
            contexto_titulo: contextoTitulo
        };
        atualizarSugestoesAtsEstruturadas(resultadoAts);
        renderizarATS(appState.analiseAtsAtual);
    } catch (errAts) {
        console.error('Erro na Análise ATS assíncrona.', errAts);
        const titulo = document.getElementById('titulo-ats-lateral');
        if (titulo) titulo.innerText = '⚠️ Erro ao gerar Score. Tente novamente.';
    }
}

export async function acionarRecalculoATS(e) {
    if (e?.stopPropagation) e.stopPropagation();
    const btn = document.getElementById('btn-recalcular-ats');

    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳';
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
    }

    const cvAtualMontado = montarCurriculoAtualDoEditor();
    const textoVaga = appState.vagaOriginalAtual || '';
    const titulo = textoVaga ? '📊 Análise ATS da Vaga' : '📊 Análise ATS Geral';

    await gerarAtsEmSegundoPlano(textoVaga, cvAtualMontado, false, titulo);

    if (btn) {
        btn.innerText = '🔄';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.display = 'none';
    }
}

export const FLUXO_ANALISE_VAGA = Object.freeze({
    atualizarBotaoVagaCapturadaAdmin,
    alternarModalVagaCapturadaAdmin,
    abrirFluxoAnaliseVaga,
    receberVagaExterna,
    receberVagaMobile,
    abrirTelaVaga,
    configurarEntradaLinkVaga,
    verificarCurriculoBase,
    analisarVagaATS,
    aplicarAjustesVaga,
    acionarRecalculoATS,
    ajustarCurriculoVaga
});
