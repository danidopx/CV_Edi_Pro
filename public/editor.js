import {
    sb,
    appState,
    atualizarSugestoesAtsEstruturadas,
    limparSugestoesAtsEstruturadas,
    obterSugestoesAtsEstruturadas,
    normalizarSugestaoAtsEstruturada,
    DEFAULT_PROMPT_MELHORAR_RESUMO,
    DEFAULT_PROMPT_MELHORAR_EXPERIENCIA
} from './config.js';
import { processarIA, PROMPT_NAMES } from './api.js';
import {
    getValSafe,
    setValSafe,
    showToast,
    irPara,
    ocultarCarregamento,
    mostrarCarregamento,
    atualizarStatusOrigem,
    syncNome,
    syncContato,
    mascaraWhats,
    mascaraCep,
    ajustarZoomMobile,
    fecharAbaPai,
    fecharFullscreenSeguro,
    iniciarTour,
    mostrarAviso,
    mostrarConfirmacao
} from './ui.js';

export function marcarAlteracao() {
    appState.temAlteracoesNaoSalvas = true;
    if (appState.analiseAtsAtual && appState.vagaOriginalAtual) {
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'flex';
    }
}

function estruturarSugestaoAtsParaEditor(sugestao) {
    const item = normalizarSugestaoAtsEstruturada(sugestao);
    if (!item || !item.descricao) return null;

    return {
        tipo: item.tipo,
        alvo: item.alvo,
        descricao: item.descricao,
        prioridade: item.prioridade,
        aplicavel_automaticamente: item.aplicavel_automaticamente
    };
}

export function obterSugestoesAtsParaEditor() {
    return obterSugestoesAtsEstruturadas()
        .map(estruturarSugestaoAtsParaEditor)
        .filter(Boolean);
}

export function fluxoNovo() {
    appState.idAtual = null;
    localStorage.removeItem('cvRecuperacao');
    limparTudo();
    const st = document.getElementById('status-nome');
    if (st) st.innerText = '📄 Currículo: NOVO';

    if (appState.usuarioAtual) {
        setValSafe('onb-email', appState.usuarioAtual.email);
        if (appState.usuarioAtual.user_metadata?.full_name || appState.usuarioAtual.user_metadata?.name) {
            setValSafe('onb-nome', appState.usuarioAtual.user_metadata.full_name || appState.usuarioAtual.user_metadata.name);
        }
    }

    const mod = document.getElementById('modal-onboarding');
    if (mod) mod.style.display = 'flex';
}

export function abrirFluxoEditorCurriculo() {
    fluxoNovo();
}

function obterResumoBaseParaMelhoria() {
    const resumoDigitado = getValSafe('resIn').trim();
    if (resumoDigitado) return resumoDigitado;

    const resumosSalvos = Array.from(document.querySelectorAll('#preRes .texto-justificado'))
        .map(el => {
            const raw = el.dataset.raw ? JSON.parse(el.dataset.raw) : null;
            return raw?.texto || el.innerText || '';
        })
        .map(texto => String(texto || '').trim())
        .filter(Boolean);

    return resumosSalvos.join('\n\n').trim();
}

export async function melhorarResumoProfissional() {
    const resumoBase = obterResumoBaseParaMelhoria();
    if (!resumoBase) {
        mostrarAviso('Escreva um resumo ou carregue um currículo com resumo antes de pedir a melhoria.', {
            title: 'Melhorar resumo',
            tone: 'info'
        });
        return;
    }

    mostrarCarregamento();
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.innerText = 'Melhorando resumo profissional...';

    const prompt = DEFAULT_PROMPT_MELHORAR_RESUMO.replace('{{RESUMO_BASE}}', resumoBase);

    try {
        const resposta = await processarIA(prompt, {
            promptNameFallback: PROMPT_NAMES.melhorarResumo,
            transformPromptContent: template => template.replace('{{RESUMO_BASE}}', resumoBase)
        });

        const resumoSugerido = String(resposta?.resumo || '').trim();
        if (!resumoSugerido) {
            throw new Error('A IA não retornou um resumo válido.');
        }

        setValSafe('resIn', resumoSugerido);
        showToast('✨ Sugestão de resumo pronta para sua revisão!');
    } catch (err) {
        mostrarAviso(`Não foi possível melhorar o resumo agora.\n\nDetalhe: ${err.message}`, {
            title: 'Melhorar resumo',
            tone: 'erro'
        });
    } finally {
        ocultarCarregamento();
    }
}

export async function melhorarDescricaoExperiencia() {
    const cargo = getValSafe('expC').trim();
    const empresa = getValSafe('expE').trim();
    const descricaoBase = getValSafe('expDes').trim();

    if (!cargo || !empresa || !descricaoBase) {
        mostrarAviso('Preencha cargo, empresa e descrição antes de pedir a melhoria da experiência.', {
            title: 'Melhorar descrição',
            tone: 'info'
        });
        return;
    }

    mostrarCarregamento();
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.innerText = 'Melhorando descrição da experiência...';

    const prompt = DEFAULT_PROMPT_MELHORAR_EXPERIENCIA
        .replace('{{CARGO}}', cargo)
        .replace('{{EMPRESA}}', empresa)
        .replace('{{DESCRICAO_BASE}}', descricaoBase);

    try {
        const resposta = await processarIA(prompt, {
            promptNameFallback: PROMPT_NAMES.melhorarExperiencia,
            transformPromptContent: template => template
                .replace('{{CARGO}}', cargo)
                .replace('{{EMPRESA}}', empresa)
                .replace('{{DESCRICAO_BASE}}', descricaoBase)
        });

        const descricaoSugerida = String(resposta?.descricao || '').trim();
        if (!descricaoSugerida) {
            throw new Error('A IA não retornou uma descrição válida.');
        }

        setValSafe('expDes', descricaoSugerida);
        showToast('✨ Sugestão de descrição pronta para sua revisão!');
    } catch (err) {
        mostrarAviso(`Não foi possível melhorar a descrição agora.\n\nDetalhe: ${err.message}`, {
            title: 'Melhorar descrição',
            tone: 'erro'
        });
    } finally {
        ocultarCarregamento();
    }
}

function atualizarTelaRevisaoCurriculo(identificador) {
    const nome = document.getElementById('revisao-curriculo-identificador');
    const origem = document.getElementById('revisao-curriculo-origem');

    if (nome) {
        nome.innerText = identificador || 'Currículo não identificado';
    }

    if (origem) {
        origem.innerText = appState.origemAtual
            ? `Origem atual: ${appState.origemAtual}`
            : 'Origem atual: currículo salvo';
    }
}

function contarPalavras(texto) {
    return String(texto || '').trim().split(/\s+/).filter(Boolean).length;
}

function analisarDataExperiencia(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return { ok: true, score: 0 };
    if (/^até o momento$/i.test(texto) || /^atual$/i.test(texto)) return { ok: true, score: 999999 };

    const matchMesAno = texto.match(/^(\d{1,2})\/(\d{4})$/);
    if (matchMesAno) {
        const mes = Number(matchMesAno[1]);
        const ano = Number(matchMesAno[2]);
        const anoAtual = new Date().getFullYear() + 1;
        return {
            ok: mes >= 1 && mes <= 12 && ano >= 1950 && ano <= anoAtual,
            score: ano * 100 + mes
        };
    }

    const matchAno = texto.match(/^(\d{4})$/);
    if (matchAno) {
        const ano = Number(matchAno[1]);
        const anoAtual = new Date().getFullYear() + 1;
        return {
            ok: ano >= 1950 && ano <= anoAtual,
            score: ano * 100
        };
    }

    return { ok: false, score: 0 };
}

function obterResumoEmEdicao() {
    return getValSafe('resIn').trim();
}

function obterExperienciaEmEdicao() {
    const cargo = getValSafe('expC').trim();
    const empresa = getValSafe('expE').trim();
    const ini = getValSafe('expIni').trim();
    const fim = (document.getElementById('expAtual')?.checked ? 'Até o momento' : getValSafe('expFim').trim());
    const desc = getValSafe('expDes').trim();
    const temRascunho = Boolean(cargo || empresa || ini || fim || desc);

    if (!temRascunho) return null;

    return { cargo, empresa, ini, fim, desc, emEdicao: true };
}

function obterFormacaoEmEdicao() {
    const curso = getValSafe('escC').trim();
    const inst = getValSafe('escI').trim();
    const ini = getValSafe('escIni').trim();
    const status = getValSafe('escStatus').trim();
    return Boolean(curso || inst || ini || status);
}

function obterHabilidadeEmEdicao() {
    return getValSafe('habIn').trim();
}

function coletarDiagnosticoCurriculoAtual() {
    const resumos = Array.from(document.querySelectorAll('#preRes .texto-justificado'))
        .map(el => el.innerText.trim())
        .filter(Boolean);

    const resumoEmEdicao = obterResumoEmEdicao();
    if (resumoEmEdicao) {
        resumos.push(resumoEmEdicao);
    }

    const experiencias = Array.from(document.querySelectorAll('#preExp .bloco-exp')).map((el, index) => {
        const raw = el.dataset.raw ? JSON.parse(el.dataset.raw) : {};
        return {
            index: index + 1,
            cargo: raw.cargo || '',
            empresa: raw.empresa || '',
            ini: raw.ini || '',
            fim: raw.fim || '',
            desc: raw.desc || ''
        };
    });

    const experienciaEmEdicao = obterExperienciaEmEdicao();
    if (experienciaEmEdicao) {
        experiencias.push({
            index: experiencias.length + 1,
            ...experienciaEmEdicao
        });
    }

    const habilidades = Array.from(document.querySelectorAll('#preHab .item-lista'))
        .map(el => el.innerText.trim())
        .filter(Boolean);

    const habilidadeEmEdicao = obterHabilidadeEmEdicao();
    if (habilidadeEmEdicao) {
        habilidades.push(habilidadeEmEdicao);
    }

    const formacoes = Array.from(document.querySelectorAll('#preEsc .item-lista'))
        .map(el => el.innerText.trim())
        .filter(Boolean);

    if (obterFormacaoEmEdicao()) {
        formacoes.push('[Formação em edição]');
    }

    return { resumos, experiencias, habilidades, formacoes };
}

export function gerarRevisaoCurriculoBase() {
    const { resumos, experiencias, habilidades } = coletarDiagnosticoCurriculoAtual();
    const apontamentos = [];

    if (resumos.length === 0) {
        apontamentos.push('Adicione um resumo profissional para apresentar seu perfil logo no início do currículo.');
    } else {
        const resumoPrincipal = resumos.join(' ').trim();
        if (contarPalavras(resumoPrincipal) < 25) {
            apontamentos.push('Seu resumo está curto. Vale explicar melhor especialidade, tempo de experiência e principais resultados.');
        }
    }

    if (experiencias.length === 0) {
        apontamentos.push('Cadastre pelo menos uma experiência profissional para dar contexto ao seu histórico.');
    }

    if (habilidades.length === 0) {
        apontamentos.push('Inclua habilidades técnicas ou comportamentais para reforçar seus pontos fortes.');
    }

    experiencias.forEach(exp => {
        const inicio = analisarDataExperiencia(exp.ini);
        const fim = analisarDataExperiencia(exp.fim);
        const titulo = exp.cargo || exp.empresa || `experiência ${exp.index}`;

        if ((exp.ini && !inicio.ok) || (exp.fim && !fim.ok)) {
            apontamentos.push(`Revise as datas da ${titulo}: use formatos como MM/AAAA, AAAA ou "Até o momento".`);
        } else if (inicio.ok && fim.ok && inicio.score && fim.score && fim.score !== 999999 && inicio.score > fim.score) {
            apontamentos.push(`As datas da ${titulo} parecem invertidas. Verifique início e fim.`);
        }

        if (contarPalavras(exp.desc) > 0 && contarPalavras(exp.desc) < 12) {
            apontamentos.push(`A descrição da ${titulo} está curta. Tente detalhar atividades, entregas ou resultados.`);
        }
    });

    return apontamentos;
}

function renderizarRevisaoCurriculoBase() {
    const lista = document.getElementById('revisao-curriculo-lista');
    const vazio = document.getElementById('revisao-curriculo-vazio');
    if (!lista || !vazio) return;

    const apontamentos = gerarRevisaoCurriculoBase();
    lista.innerHTML = '';

    if (apontamentos.length === 0) {
        vazio.style.display = 'block';
        vazio.innerText = 'Nenhum alerta básico encontrado. Seu currículo-base já tem uma boa estrutura para seguir revisando.';
        return;
    }

    vazio.style.display = 'none';
    apontamentos.forEach(texto => {
        const item = document.createElement('li');
        item.style.marginBottom = '10px';
        item.style.lineHeight = '1.6';
        item.textContent = texto;
        lista.appendChild(item);
    });
}

async function recuperarCurriculoParaRevisao() {
    if (appState.idAtual) {
        return appState.idAtual;
    }

    const cvRecuperacao = localStorage.getItem('cvRecuperacao') || '';
    const cvPadrao = obterCurriculoPadraoId();
    const candidatoId = cvRecuperacao || cvPadrao;

    if (!candidatoId) {
        return '';
    }

    await carregar(candidatoId, { irParaEditor: false, iniciarTourDepois: false });
    return appState.idAtual || '';
}

export async function abrirFluxoRevisaoCurriculo() {
    const identificador = await recuperarCurriculoParaRevisao();

    if (!identificador) {
        mostrarAviso('Crie ou carregue um currículo antes de iniciar a revisão.', {
            title: 'Revisão do currículo',
            tone: 'info'
        });
        return;
    }

    atualizarTelaRevisaoCurriculo(identificador);
    irPara('tela-revisao-curriculo');
    renderizarRevisaoCurriculoBase();
}

function obterChaveCurriculoPadraoLocal() {
    return appState.usuarioAtual ? `cv_padrao_${appState.usuarioAtual.id}` : '';
}

function obterCurriculoPadraoMetadata() {
    const valor = appState.usuarioAtual?.user_metadata?.cv_padrao_id;
    return typeof valor === 'string' && valor.trim() ? valor.trim() : '';
}

function salvarCurriculoPadraoLocal(id) {
    const chave = obterChaveCurriculoPadraoLocal();
    if (!chave) return;
    if (id) localStorage.setItem(chave, id);
    else localStorage.removeItem(chave);
}

export function obterCurriculoPadraoId() {
    const metadataId = obterCurriculoPadraoMetadata();
    if (metadataId) {
        salvarCurriculoPadraoLocal(metadataId);
        return metadataId;
    }

    const chave = obterChaveCurriculoPadraoLocal();
    return chave ? (localStorage.getItem(chave) || '') : '';
}

export async function sincronizarCurriculoPadraoPersistido() {
    if (!appState.usuarioAtual) return '';

    const metadataId = obterCurriculoPadraoMetadata();
    const localId = obterCurriculoPadraoId();

    if (metadataId) return metadataId;
    if (!localId) return '';

    const { data, error } = await sb.auth.updateUser({
        data: {
            ...appState.usuarioAtual.user_metadata,
            cv_padrao_id: localId
        }
    });

    if (!error && data?.user) {
        appState.usuarioAtual = data.user;
    }

    salvarCurriculoPadraoLocal(localId);
    return localId;
}

export function salvarOnboardingEContinuar() {
    const n = getValSafe('onb-nome');
    const e = getValSafe('onb-email');
    const w = getValSafe('onb-whats');
    if (!n || !e || w === undefined) return mostrarAviso('Preencha os campos obrigatórios para criar a base do seu currículo.');

    setValSafe('inNome', n);
    setValSafe('inEmail', e);
    setValSafe('inWhats', w);
    setValSafe('inData', getValSafe('onb-data'));
    setValSafe('inIdade', getValSafe('onb-idade'));
    setValSafe('inCep', getValSafe('onb-cep'));
    setValSafe('inEnd', getValSafe('onb-end'));
    setValSafe('inLinkedin', getValSafe('onb-linkedin'));
    setValSafe('inVaga', getValSafe('onb-vaga'));
    setValSafe('inStatus', getValSafe('onb-status'));
    setValSafe('inPretensao', getValSafe('onb-pretensao'));
    const whatsEl = document.getElementById('inWhats');
    if (whatsEl) mascaraWhats(whatsEl);
    const cepEl = document.getElementById('inCep');
    if (cepEl) mascaraCep(cepEl);
    syncNome();
    syncContato();
    const mod = document.getElementById('modal-onboarding');
    if (mod) mod.style.display = 'none';

    document.getElementById('panel-ia-extracao').style.display = 'block';

    appState.origemAtual = 'Criado do zero';
    atualizarStatusOrigem();

    marcarAlteracao();
    irPara('tela-editor');
    iniciarTour();
}

export async function definirPadrao(id) {
    if (!appState.usuarioAtual) return;

    const { data, error } = await sb.auth.updateUser({
        data: {
            ...appState.usuarioAtual.user_metadata,
            cv_padrao_id: id
        }
    });

    if (error) {
        mostrarAviso('Não foi possível fixar o currículo padrão agora. Tente novamente em alguns instantes.', {
            title: 'Currículo padrão',
            tone: 'erro'
        });
        return;
    }

    if (data?.user) {
        appState.usuarioAtual = data.user;
    }

    salvarCurriculoPadraoLocal(id);
    showToast('⭐ Currículo padrão fixado na sua conta!');
    abrirCurriculosSalvos();
}

export async function fluxoLista() {
    irPara('tela-lista');
    const grid = document.getElementById('grid-salvos');
    if (!grid) return;
    grid.innerHTML = '<p>Carregando...</p>';

    const padraoId = await sincronizarCurriculoPadraoPersistido();

    const { data } = await sb.from('curriculos_saas').select('identificador, conteudo').eq('user_id', appState.usuarioAtual.id).order('identificador', { ascending: true });
    grid.innerHTML = '';

    if (!data || data.length === 0) {
        grid.innerHTML = '<p>Nenhum currículo salvo.</p>';
        return;
    }

    grid.innerHTML = `
            <div style="grid-column: 1 / -1; background: var(--primary-dim); border: 1px solid var(--primary); padding: 15px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; color: var(--text-main);">
                <strong>💡 Dica de Mestre:</strong> Crie um currículo contendo <b>todas</b> as suas experiências, habilidades e formações (mesmo que fique grande). Salve-o e depois clique em <b>"⭐ Definir Padrão"</b>. Ele será a sua base oficial para a IA gerar currículos perfeitos para cada vaga!
            </div>
        `;

    data.forEach(item => {
        const isPadrao = item.identificador === padraoId;
        const btnPadrao = isPadrao
            ? '<span style="font-size: 12px; color: var(--primary); font-weight: bold;">⭐ Padrão da Conta</span>'
            : `<button class="btn-base btn-neutral" style="padding: 6px 12px; font-size:11px;" onclick="definirPadrao('${item.identificador}')">⭐ Definir Padrão</button>`;

        let linhaAtualizado = 'Atualizado: —';
        if (item.conteudo && item.conteudo.data_atualizacao) {
            const d = new Date(item.conteudo.data_atualizacao);
            const dataAtual = d.toLocaleDateString('pt-BR');
            const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            linhaAtualizado = `Atualizado: ${dataAtual} às ${hora}`;
        }

        const card = document.createElement('div');
        card.className = 'card-salvo';
        card.innerHTML = `
                <div style="flex:1; min-width: 150px; cursor:pointer;" onclick="carregar('${item.identificador}')">
                    <strong style="display:block; font-size: 15px;">${item.identificador}</strong>
                    <span style="font-size: 11px; color: var(--text-light); margin-top: 5px; display: block;">${linhaAtualizado}</span>
                </div>
                <div style="display:flex; gap:10px; align-items: center; flex-wrap: wrap;">
                    ${btnPadrao}
                    <button class="btn-base btn-neutral" style="padding: 6px 12px; font-size:12px;" onclick="duplicar('${item.identificador}')">📑 Duplicar</button>
                    <button class="btn-base btn-danger" onclick="deletar('${item.identificador}')">🗑️ Apagar</button>
                </div>
            `;
        if (isPadrao) card.style.borderLeft = '5px solid var(--accent)';
        grid.appendChild(card);
    });
}

export async function abrirCurriculosSalvos() {
    await fluxoLista();
}

export async function duplicar(idOriginal) {
    const novoId = prompt('Nome para a cópia (ex: Versão 2):', idOriginal + ' - Cópia');
    if (!novoId) return;
    const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', idOriginal).eq('user_id', appState.usuarioAtual.id).single();
    if (data) {
        const payload = { identificador: novoId, user_id: appState.usuarioAtual.id, conteudo: data.conteudo };
        const { error } = await sb.from('curriculos_saas').insert(payload);
        if (error) mostrarAviso('Não foi possível duplicar este currículo. O nome informado provavelmente já existe.', { tone: 'erro' });
        else {
            showToast();
            abrirCurriculosSalvos();
        }
    }
}

export async function salvarComo() {
    if (!appState.idAtual) return mostrarAviso('Salve o currículo normalmente primeiro para depois criar uma cópia.');
    const novoId = prompt('Guardar como nova versão. Escreva o novo nome:', appState.idAtual + ' - v2');
    if (!novoId) return;
    appState.idAtual = novoId;
    await salvar();
}

export async function salvar() {
    const id = appState.idAtual || prompt('Nome do currículo (ex: TI Banco Itaú):');
    if (!id) return;
    const regexClean = /\[editar\]|\[remover\]|\[x\]/g;
    const dataAtualizacao = new Date().toISOString();
    const payload = {
        identificador: id,
        user_id: appState.usuarioAtual.id,
        conteudo: {
            origem: appState.origemAtual,
            data_atualizacao: dataAtualizacao,
            analise_ats: appState.analiseAtsAtual,
            vaga_original: appState.vagaOriginalAtual,
            pessoais: {
                nome: getValSafe('inNome'),
                data: getValSafe('inData'),
                idade: getValSafe('inIdade'),
                cep: getValSafe('inCep'),
                end: getValSafe('inEnd'),
                email: getValSafe('inEmail'),
                whats: getValSafe('inWhats'),
                linkedin: getValSafe('inLinkedin'),
                vaga: getValSafe('inVaga'),
                status: getValSafe('inStatus'),
                pretensao: getValSafe('inPretensao'),
                mostrarPretensao: document.getElementById('chkPretensao')?.checked
            },
            resumo: Array.from(document.querySelectorAll('#preRes .texto-justificado')).map(el => el.innerText.replace(regexClean, '').trim()),
            experiencias: Array.from(document.querySelectorAll('.bloco-exp')).map(el => ({
                cargo: el.querySelector('.exp-header span:first-child').innerText,
                data: el.querySelector('.exp-header span:last-child').innerText,
                empresa: el.querySelector('.exp-empresa').innerText,
                desc: el.querySelector('.texto-justificado').innerText.replace(regexClean, '').trim()
            })),
            escolaridade: Array.from(document.querySelectorAll('#preEsc .item-lista')).map(el => el.innerText.replace(regexClean, '').trim()),
            idiomas: Array.from(document.querySelectorAll('#preIdi .item-lista')).map(el => el.innerText.replace(regexClean, '').trim()),
            habilidades: Array.from(document.querySelectorAll('#preHab .item-lista')).map(el => el.innerText.replace(regexClean, '').trim())
        }
    };
    const { error } = await sb.from('curriculos_saas').upsert(payload, { onConflict: 'identificador, user_id' });
    if (!error) {
        appState.idAtual = id;
        localStorage.setItem('cvRecuperacao', appState.idAtual);
        const sn = document.getElementById('status-nome');
        if (sn) sn.innerText = '📄 Currículo: ' + id;
        appState.temAlteracoesNaoSalvas = false;
        showToast();
    } else {
        mostrarAviso('Não foi possível salvar o currículo agora.', { tone: 'erro' });
    }
}

export async function carregar(id, options = {}) {
    const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', id).eq('user_id', appState.usuarioAtual.id).single();
    if (data) {
        limparTudo();
        appState.idAtual = id;
        localStorage.setItem('cvRecuperacao', appState.idAtual);
        const sn = document.getElementById('status-nome');
        if (sn) sn.innerText = '📄 Currículo: ' + id;
        const c = data.conteudo || {};
        const regexLimpa = /\[editar\]|\[remover\]|\[x\]/g;

        appState.origemAtual = c.origem || 'Não identificada';
        atualizarStatusOrigem();

        appState.vagaOriginalAtual = c.vaga_original || '';

        appState.analiseAtsAtual = c.analise_ats || null;
        atualizarSugestoesAtsEstruturadas(appState.analiseAtsAtual);
        if (appState.analiseAtsAtual) {
            renderizarATS(appState.analiseAtsAtual);
            const atsPainel = document.getElementById('details-ats');
            if (atsPainel) atsPainel.removeAttribute('open');
        }

        if (c.dados_mercado) {
            setValSafe('inData', c.dados_mercado.data || '');
            setValSafe('inIdade', c.dados_mercado.idade || '');
            setValSafe('inVaga', c.dados_mercado.vaga || '');
            setValSafe('inStatus', c.dados_mercado.status || 'Ativo (Empregado)');
            setValSafe('inPretensao', c.dados_mercado.pretensao || '');
        }
        if (c.pessoais) {
            setValSafe('inNome', c.pessoais.nome || '');
            if (c.pessoais.data) setValSafe('inData', c.pessoais.data);
            if (c.pessoais.idade) setValSafe('inIdade', c.pessoais.idade);
            setValSafe('inEnd', c.pessoais.end || '');
            setValSafe('inCep', c.pessoais.cep || '');
            setValSafe('inEmail', c.pessoais.email || '');
            setValSafe('inLinkedin', c.pessoais.linkedin || '');
            setValSafe('inVaga', c.pessoais.vaga || c.dados_mercado?.vaga || '');
            setValSafe('inStatus', c.pessoais.status || c.dados_mercado?.status || 'Ativo (Empregado)');
            setValSafe('inPretensao', c.pessoais.pretensao || c.dados_mercado?.pretensao || '');
            const chk = document.getElementById('chkPretensao');
            if (chk) chk.checked = !!c.pessoais.mostrarPretensao;
            const inputWhats = document.getElementById('inWhats');
            if (inputWhats && c.pessoais.whats) {
                inputWhats.value = c.pessoais.whats;
                mascaraWhats(inputWhats);
            }
        }
        syncNome();
        syncContato();

        if (c.resumo) c.resumo.forEach(r => adicionarResumo(r.replace(regexLimpa, '')));
        if (c.experiencias) {
            c.experiencias.forEach(e => {
                const dates = e.data ? e.data.split(' — ') : ['', ''];
                adicionarExperiencia({
                    cargo: e.cargo || '',
                    empresa: e.empresa || '',
                    ini: dates[0] || '',
                    fim: dates[1] || '',
                    desc: (e.desc || '').replace(regexLimpa, '')
                });
            });
        }
        if (c.escolaridade) {
            c.escolaridade.forEach(esc => {
                const raw = esc.replace(regexLimpa, '');
                const p = raw.split(':');
                adicionarEscolaridade({ curso: p[0] ? p[0].trim() : '', status: p[1] ? p[1].trim() : '' });
            });
        }
        if (c.idiomas) {
            c.idiomas.forEach(i => {
                const p = i.replace(regexLimpa, '').split(':');
                adicionarIdioma({ nome: p[0] ? p[0].trim() : '', nivel: p[1] ? p[1].trim() : '' });
            });
        }
        if (c.habilidades) c.habilidades.forEach(h => adicionarHabilidade(h.replace(regexLimpa, '')));

        document.getElementById('panel-ia-extracao').style.display = 'none';

        appState.temAlteracoesNaoSalvas = false;
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'none';

        if (options.irParaEditor !== false) {
            irPara('tela-editor');
        }

        if (options.iniciarTourDepois !== false) {
            iniciarTour();
        }
    }
}

export async function deletar(id) {
    if (await mostrarConfirmacao(`Tem certeza que deseja apagar o currículo "${id}" definitivamente?`, {
        title: 'Apagar currículo',
        confirmLabel: 'Apagar',
        cancelLabel: 'Cancelar',
        tone: 'erro'
    })) {
        const { error } = await sb.from('curriculos_saas').delete().eq('identificador', id).eq('user_id', appState.usuarioAtual.id);
        if (error) {
            mostrarAviso('Não foi possível apagar o currículo.\n\nDetalhe: ' + error.message, { tone: 'erro' });
        } else {
            showToast('🗑️ Currículo apagado com sucesso!');
            abrirCurriculosSalvos();
        }
    }
}

export async function extrairDadosIA() {
    const txt = getValSafe('texto-ia');
    if (!txt) return mostrarAviso('Cole o texto do currículo antes de pedir a extração pela IA.');

    mostrarCarregamento();
    document.getElementById('loading-text').innerText = 'Processando Inteligência Artificial...';

    const prompt = `Aja como conversor estrito de texto para JSON. Formato obrigatório: { "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "texto", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "status":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill1"] } STATUS FORMAÇÃO: Obrigatório retornar um dos: "Concluído", "Cursando", "Trancado". Texto: ${txt}`;

    try {
        const extraido = await processarIA(prompt, {
            promptNameFallback: PROMPT_NAMES.extracaoTextoCv,
            transformPromptContent: template => template.replace('{{TEXTO_BRUTO}}', txt)
        });
        limparTudo();
        appState.idAtual = null;
        localStorage.removeItem('cvRecuperacao');
        const sn = document.getElementById('status-nome');
        if (sn) sn.innerText = '📄 Currículo: NOVO';

        appState.origemAtual = 'Extraído via IA (Texto colado)';
        atualizarStatusOrigem();

        preencherEditor(extraido);
        marcarAlteracao();
    } catch (err) {
        if (err.message !== 'Erro JSON.') mostrarAviso('Não foi possível extrair os dados pela IA.\n\nDetalhe: ' + err.message, { tone: 'erro' });
    } finally {
        ocultarCarregamento();
    }
}

export function editarResumo(btn) {
    fecharFullscreenSeguro();
    const div = btn.parentElement.parentElement;
    const raw = JSON.parse(div.dataset.raw);
    setValSafe('resIn', raw.texto);
    if (appState.editResumoNode) {
        appState.editResumoNode.style.borderLeft = 'none';
        appState.editResumoNode.style.paddingLeft = '0';
    }
    appState.editResumoNode = div;
    div.style.borderLeft = '3px solid var(--primary)';
    div.style.paddingLeft = '10px';
    const inputEdit = document.getElementById('resIn');
    if (inputEdit) {
        inputEdit.closest('details').open = true;
        inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEdit.focus();
    }
    const btnAdd = document.getElementById('btn-add-res');
    if (btnAdd) {
        btnAdd.innerText = '💾 Salvar Edição';
        btnAdd.classList.replace('btn-primary', 'btn-accent');
    }
}

export function adicionarResumo(txt = null) {
    let val = txt || getValSafe('resIn');
    if (!val) return;

    val = higienizarTexto(val);

    const rawStr = JSON.stringify({ texto: val });
    const htmlStr = `<div style="white-space: pre-wrap;">${val}</div> <div style="text-align:right; margin-top:5px"><small style="color:var(--primary);cursor:pointer;padding:5px;" onclick="editarResumo(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:8px;padding:5px;" onclick="this.parentElement.parentElement.remove(); marcarAlteracao();">[remover]</small></div>`;
    if (!txt && appState.editResumoNode) {
        appState.editResumoNode.dataset.raw = rawStr;
        appState.editResumoNode.innerHTML = htmlStr;
        appState.editResumoNode.style.borderLeft = 'none';
        appState.editResumoNode.style.paddingLeft = '0';
        appState.editResumoNode = null;
    } else {
        const div = document.createElement('div');
        div.className = 'texto-justificado';
        div.dataset.raw = rawStr;
        div.innerHTML = htmlStr;
        const pr = document.getElementById('preRes');
        if (pr) pr.appendChild(div);
    }
    setValSafe('resIn', '');
    const btnAdd = document.getElementById('btn-add-res');
    if (btnAdd) {
        btnAdd.innerText = '+ Adicionar Resumo';
        btnAdd.classList.replace('btn-accent', 'btn-primary');
    }
    fecharAbaPai('resIn');
    marcarAlteracao();
}

function parseDataParaSort(dataStr) {
    if (!dataStr) return 0;
    const str = dataStr.toLowerCase().trim();
    if (str === 'até o momento' || str === 'atual') return 999999;

    const matchMMAAAA = str.match(/(\d{1,2})\/(\d{4})/);
    if (matchMMAAAA) return parseInt(matchMMAAAA[2], 10) * 100 + parseInt(matchMMAAAA[1], 10);

    const matchAAAA = str.match(/(\d{4})/);
    if (matchAAAA) return parseInt(matchAAAA[1], 10) * 100;

    return 0;
}

function reordenarExperienciasDOM() {
    const container = document.getElementById('preExp');
    if (!container) return;
    const blocos = Array.from(container.querySelectorAll('.bloco-exp'));

    blocos.sort((a, b) => {
        const textoDataA = a.querySelector('.exp-header span:last-child')?.innerText || '';
        const textoDataB = b.querySelector('.exp-header span:last-child')?.innerText || '';

        const fimA = textoDataA.split('—')[1] || textoDataA.split('—')[0];
        const fimB = textoDataB.split('—')[1] || textoDataB.split('—')[0];

        return parseDataParaSort(fimB) - parseDataParaSort(fimA);
    });

    blocos.forEach(bloco => container.appendChild(bloco));
}

export function editarExperiencia(btn) {
    fecharFullscreenSeguro();
    const div = btn.parentElement.parentElement;
    const raw = JSON.parse(div.dataset.raw);
    setValSafe('expC', raw.cargo);
    setValSafe('expE', raw.empresa);
    setValSafe('expIni', raw.ini);
    setValSafe('expFim', raw.fim === 'Até o momento' ? '' : raw.fim);
    const expAtual = document.getElementById('expAtual');
    if (expAtual) expAtual.checked = raw.fim === 'Até o momento';
    const expFim = document.getElementById('expFim');
    if (expFim) expFim.disabled = raw.fim === 'Até o momento';
    setValSafe('expDes', raw.desc);
    if (appState.editExpNode) {
        appState.editExpNode.style.borderLeft = 'none';
        appState.editExpNode.style.paddingLeft = '0';
    }
    appState.editExpNode = div;
    div.style.borderLeft = '3px solid var(--primary)';
    div.style.paddingLeft = '10px';
    const inputEdit = document.getElementById('expC');
    if (inputEdit) {
        inputEdit.closest('details').open = true;
        inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEdit.focus();
    }
    const btnAdd = document.getElementById('btn-add-exp');
    if (btnAdd) {
        btnAdd.innerText = '💾 Salvar Experiência';
        btnAdd.classList.replace('btn-primary', 'btn-accent');
    }
}

export function adicionarExperiencia(dados = null) {
    let cargo = dados?.cargo || getValSafe('expC');
    let emp = dados?.empresa || getValSafe('expE');
    let ini = dados?.ini || getValSafe('expIni');
    const expAtual = document.getElementById('expAtual');
    let fim = dados?.fim || ((expAtual && expAtual.checked) ? 'Até o momento' : getValSafe('expFim'));
    let des = dados?.desc || getValSafe('expDes');
    if (!cargo || !emp) return;

    cargo = higienizarTexto(cargo).replace(/^[•\-\*]+/, '').trim();
    des = higienizarTexto(des);

    const rawStr = JSON.stringify({ cargo, empresa: emp, ini, fim, desc: des });
    const headerData = (ini || fim) ? `<span>${ini || ''}${ini && fim ? ' — ' : ''}${fim || ''}</span>` : '';

    const htmlStr = `<div class="exp-header"><span>${cargo}</span>${headerData}</div><div class="exp-empresa">${emp}</div><div class="texto-justificado" style="white-space: pre-wrap;">${des}</div><div style="text-align:right; margin-top:-5px"><small style="color:var(--primary);cursor:pointer;padding:5px;" onclick="editarExperiencia(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:8px;padding:5px;" onclick="this.parentElement.parentElement.remove(); marcarAlteracao();">[remover]</small></div>`;
    if (!dados && appState.editExpNode) {
        appState.editExpNode.dataset.raw = rawStr;
        appState.editExpNode.innerHTML = htmlStr;
        appState.editExpNode.style.borderLeft = 'none';
        appState.editExpNode.style.paddingLeft = '0';
        appState.editExpNode = null;
    } else {
        const div = document.createElement('div');
        div.className = 'bloco-exp';
        div.style.marginBottom = '15px';
        div.dataset.raw = rawStr;
        div.innerHTML = htmlStr;
        const pe = document.getElementById('preExp');
        if (pe) pe.appendChild(div);
    }
    ['expC', 'expE', 'expIni', 'expFim', 'expDes'].forEach(i => setValSafe(i, ''));
    if (expAtual) expAtual.checked = false;
    const eFim = document.getElementById('expFim');
    if (eFim) eFim.disabled = false;
    const btnAdd = document.getElementById('btn-add-exp');
    if (btnAdd) {
        btnAdd.innerText = '+ Adicionar Experiência';
        btnAdd.classList.replace('btn-accent', 'btn-primary');
    }
    fecharAbaPai('expC');
    reordenarExperienciasDOM();
    marcarAlteracao();
}

export function editarEscolaridade(btn) {
    fecharFullscreenSeguro();
    const div = btn.parentElement;
    const raw = JSON.parse(div.dataset.raw);
    setValSafe('escC', raw.curso);
    setValSafe('escI', raw.inst);
    setValSafe('escIni', raw.ini);
    setValSafe('escStatus', raw.status || 'Concluído');
    if (appState.editEscNode) {
        appState.editEscNode.style.borderLeft = 'none';
        appState.editEscNode.style.paddingLeft = '0';
    }
    appState.editEscNode = div;
    div.style.borderLeft = '3px solid var(--primary)';
    div.style.paddingLeft = '10px';
    const inputEdit = document.getElementById('escC');
    if (inputEdit) {
        inputEdit.closest('details').open = true;
        inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEdit.focus();
    }
    const btnAdd = document.getElementById('btn-add-esc');
    if (btnAdd) {
        btnAdd.innerText = '💾 Salvar Formação';
        btnAdd.classList.replace('btn-primary', 'btn-accent');
    }
}

export function adicionarEscolaridade(dados = null) {
    let cur = dados?.curso || getValSafe('escC');
    let ins = dados?.inst || getValSafe('escI');
    let ini = dados?.ini || getValSafe('escIni');
    let status = dados?.status || getValSafe('escStatus');
    if (!cur) return;
    cur = cur.replace(/^[•\-\*\s]+/, '');
    const rawStr = JSON.stringify({ curso: cur, inst: ins, ini, status });
    let html = `• <strong>${cur}</strong>`;
    if (ins) html += ` — ${ins}`;
    const infoExtra = [];
    if (ini) infoExtra.push(ini);
    if (status) infoExtra.push(status);
    if (infoExtra.length > 0) html += ` (${infoExtra.join(' - ')})`;
    const htmlStr = `${html} <small style="color:var(--primary);cursor:pointer;margin-left:10px;padding:5px;" onclick="editarEscolaridade(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:5px;padding:5px;" onclick="this.parentElement.remove(); marcarAlteracao();">[x]</small>`;
    if (!dados && appState.editEscNode) {
        appState.editEscNode.dataset.raw = rawStr;
        appState.editEscNode.innerHTML = htmlStr;
        appState.editEscNode.style.borderLeft = 'none';
        appState.editEscNode.style.paddingLeft = '0';
        appState.editEscNode = null;
    } else {
        const div = document.createElement('div');
        div.className = 'item-lista';
        div.dataset.raw = rawStr;
        div.innerHTML = htmlStr;
        const pe = document.getElementById('preEsc');
        if (pe) pe.appendChild(div);
    }
    ['escC', 'escI', 'escIni'].forEach(i => setValSafe(i, ''));
    setValSafe('escStatus', 'Concluído');
    const btnAdd = document.getElementById('btn-add-esc');
    if (btnAdd) {
        btnAdd.innerText = '+ Adicionar Formação';
        btnAdd.classList.replace('btn-accent', 'btn-primary');
    }
    fecharAbaPai('escC');
    marcarAlteracao();
}

export function editarIdioma(btn) {
    fecharFullscreenSeguro();
    const div = btn.parentElement;
    const raw = JSON.parse(div.dataset.raw);
    setValSafe('idiIn', raw.nome);
    setValSafe('idiNivel', raw.nivel);
    if (appState.editIdiNode) {
        appState.editIdiNode.style.borderLeft = 'none';
        appState.editIdiNode.style.paddingLeft = '0';
    }
    appState.editIdiNode = div;
    div.style.borderLeft = '3px solid var(--primary)';
    div.style.paddingLeft = '10px';
    const inputEdit = document.getElementById('idiIn');
    if (inputEdit) {
        inputEdit.closest('details').open = true;
        inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEdit.focus();
    }
    const btnAdd = document.getElementById('btn-add-idi');
    if (btnAdd) {
        btnAdd.innerText = '💾 Salvar Idioma';
        btnAdd.classList.replace('btn-primary', 'btn-accent');
    }
}

export function adicionarIdioma(d = null) {
    let nome = d?.nome || getValSafe('idiIn');
    let nivel = d?.nivel || getValSafe('idiNivel');
    if (!nome) return;
    nome = nome.replace(/^[•\-\*\s]+/, '');
    const rawStr = JSON.stringify({ nome, nivel });
    let html = `• <strong>${nome}</strong>`;
    if (nivel) html += `: ${nivel}`;
    const htmlStr = `${html} <small style="color:var(--primary);cursor:pointer;margin-left:10px;padding:5px;" onclick="editarIdioma(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:5px;padding:5px;" onclick="this.parentElement.remove(); marcarAlteracao();">[x]</small>`;
    if (!d && appState.editIdiNode) {
        appState.editIdiNode.dataset.raw = rawStr;
        appState.editIdiNode.innerHTML = htmlStr;
        appState.editIdiNode.style.borderLeft = 'none';
        appState.editIdiNode.style.paddingLeft = '0';
        appState.editIdiNode = null;
    } else {
        const div = document.createElement('div');
        div.className = 'item-lista';
        div.dataset.raw = rawStr;
        div.innerHTML = htmlStr;
        const pi = document.getElementById('preIdi');
        if (pi) pi.appendChild(div);
    }
    setValSafe('idiIn', '');
    const btnAdd = document.getElementById('btn-add-idi');
    if (btnAdd) {
        btnAdd.innerText = '+ Adicionar Idioma';
        btnAdd.classList.replace('btn-accent', 'btn-primary');
    }
    fecharAbaPai('idiIn');
    marcarAlteracao();
}

export function editarHabilidade(btn) {
    fecharFullscreenSeguro();
    const div = btn.parentElement;
    const raw = JSON.parse(div.dataset.raw);
    setValSafe('habIn', raw.hab);
    if (appState.editHabNode) {
        appState.editHabNode.style.borderLeft = 'none';
        appState.editHabNode.style.paddingLeft = '0';
    }
    appState.editHabNode = div;
    div.style.borderLeft = '3px solid var(--primary)';
    div.style.paddingLeft = '10px';
    const inputEdit = document.getElementById('habIn');
    if (inputEdit) {
        inputEdit.closest('details').open = true;
        inputEdit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEdit.focus();
    }
    const btnAdd = document.getElementById('btn-add-hab');
    if (btnAdd) {
        btnAdd.innerText = '💾 Salvar Edição';
        btnAdd.classList.replace('btn-primary', 'btn-accent');
    }
}

export function adicionarHabilidade(h = null) {
    let v = h || getValSafe('habIn');
    if (!v) return;
    v = v.replace(/^[•\-\*\s]+/, '');
    const rawStr = JSON.stringify({ hab: v });
    const htmlStr = `• <span class="hab-text">${v}</span> <small style="color:var(--primary);cursor:pointer;margin-left:10px;padding:5px;" onclick="editarHabilidade(this)">[editar]</small><small style="color:var(--danger);cursor:pointer;margin-left:5px;padding:5px;" onclick="this.parentElement.remove(); marcarAlteracao();">[x]</small>`;
    if (!h && appState.editHabNode) {
        appState.editHabNode.dataset.raw = rawStr;
        appState.editHabNode.innerHTML = htmlStr;
        appState.editHabNode.style.borderLeft = 'none';
        appState.editHabNode.style.paddingLeft = '0';
        appState.editHabNode = null;
    } else {
        const div = document.createElement('div');
        div.className = 'item-lista';
        div.dataset.raw = rawStr;
        div.innerHTML = htmlStr;
        const ph = document.getElementById('preHab');
        if (ph) ph.appendChild(div);
    }
    setValSafe('habIn', '');
    const btnAdd = document.getElementById('btn-add-hab');
    if (btnAdd) {
        btnAdd.innerText = '+ Adicionar Habilidade';
        btnAdd.classList.replace('btn-accent', 'btn-primary');
    }
    fecharAbaPai('habIn');
    marcarAlteracao();
}

export function preencherEditor(extraido) {
    setValSafe('inNome', extraido.nome || '');
    setValSafe('inEnd', extraido.endereco || '');
    setValSafe('inCep', extraido.cep || '');
    setValSafe('inEmail', extraido.email || '');
    setValSafe('inLinkedin', extraido.linkedin || '');
    const inputWhats = document.getElementById('inWhats');
    if (inputWhats && extraido.whatsapp) {
        inputWhats.value = extraido.whatsapp;
        mascaraWhats(inputWhats);
    }
    syncNome();
    syncContato();
    if (extraido.resumo) {
        setValSafe('resIn', extraido.resumo);
        adicionarResumo();
    }
    if (extraido.experiencias) extraido.experiencias.forEach(e => adicionarExperiencia(e));
    if (extraido.formacao) extraido.formacao.forEach(f => adicionarEscolaridade(f));
    if (extraido.idiomas) extraido.idiomas.forEach(i => adicionarIdioma(i));
    if (extraido.habilidades) extraido.habilidades.forEach(h => adicionarHabilidade(h));
    showToast();
    setTimeout(ajustarZoomMobile, 100);
}

export function limparTudo() {
    appState.ultimasAlteracoesIA = '';
    appState.analiseAtsAtual = null;
    appState.vagaOriginalAtual = '';
    limparSugestoesAtsEstruturadas();

    document.getElementById('btn-ver-alteracoes').style.display = 'none';
    document.getElementById('alerta-email-vaga').style.display = 'none';
    document.getElementById('details-ats').style.display = 'none';
    document.getElementById('painel-ats-conteudo').innerHTML = '';

    appState.origemAtual = 'Criado do zero';
    atualizarStatusOrigem();

    appState.editResumoNode = null;
    appState.editExpNode = null;
    appState.editEscNode = null;
    appState.editIdiNode = null;
    appState.editHabNode = null;
    ['preRes', 'preExp', 'preEsc', 'preIdi', 'preHab'].forEach(i => {
        const el = document.getElementById(i);
        if (el) el.innerHTML = '';
    });
    ['inNome', 'inData', 'inIdade', 'inEnd', 'inCep', 'inEmail', 'inWhats', 'inLinkedin', 'inPretensao', 'texto-ia'].forEach(i => setValSafe(i, ''));
    const chk = document.getElementById('chkPretensao');
    if (chk) chk.checked = false;
    const np = document.getElementById('nomePreview');
    if (np) np.innerText = 'NOME COMPLETO';
    const prev = document.getElementById('contatoPreview');
    if (prev) prev.innerText = '...';

    document.querySelectorAll('#editor details').forEach(d => d.removeAttribute('open'));

    document.querySelectorAll('.btn-add-block').forEach(btn => {
        btn.innerText = btn.innerText.replace('💾 Salvar Edição', '+ Adicionar').replace('💾 Salvar Experiência', '+ Adicionar Experiência').replace('💾 Salvar Formação', '+ Adicionar Formação').replace('💾 Salvar Idioma', '+ Adicionar Idioma');
        btn.classList.remove('btn-accent');
        btn.classList.add('btn-primary');
    });

    const btnRecalcular = document.getElementById('btn-recalcular-ats');
    if (btnRecalcular) btnRecalcular.style.display = 'none';

    setTimeout(ajustarZoomMobile, 100);
}

function higienizarTexto(texto) {
    if (!texto) return '';
    return texto
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[▪]/g, '•')
        .replace(/\t/g, '  ')
        .trim();
}

export function initEditorFieldGuards() {
    const inIdade = document.getElementById('inIdade');
    if (inIdade) {
        inIdade.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 3);
            syncContato();
        });
    }

    const inEmail = document.getElementById('inEmail');
    if (inEmail) {
        inEmail.addEventListener('blur', function () {
            const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !regexEmail.test(this.value)) {
                mostrarAviso('Digite um e-mail válido para continuar.');
                this.value = '';
                syncContato();
            }
        });
    }

    ['expIni', 'expFim', 'escIni'].forEach(id => {
        const inputData = document.getElementById(id);
        if (inputData) {
            inputData.addEventListener('input', function () {
                let v = this.value.replace(/\D/g, '');
                if (v.length >= 2) {
                    let mes = parseInt(v.substring(0, 2), 10);
                    if (mes > 12) v = '12' + v.substring(2);
                    if (mes === 0 && v.length >= 2) v = '01' + v.substring(2);

                    v = v.replace(/^(\d{2})(\d)/, '$1/$2');
                }
                this.value = v.substring(0, 7);
            });
        }
    });

    const inPretensao = document.getElementById('inPretensao');
    if (inPretensao) {
        inPretensao.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '');
            if (v) {
                v = (parseInt(v, 10) / 100).toFixed(2) + '';
                v = v.replace('.', ',');
                v = v.replace(/(\d)(\d{3})(\d{3}),/g, '$1.$2.$3,');
                v = v.replace(/(\d)(\d{3}),/g, '$1.$2,');
                this.value = 'R$ ' + v;
            } else {
                this.value = '';
            }
            syncContato();
        });
    }
}

window.melhorarResumoProfissional = melhorarResumoProfissional;
window.melhorarDescricaoExperiencia = melhorarDescricaoExperiencia;

export const FLUXO_EDITOR_CURRICULO = Object.freeze({
    marcarAlteracao,
    obterSugestoesAtsParaEditor,
    abrirFluxoEditorCurriculo,
    abrirCurriculosSalvos,
    fluxoNovo,
    salvarOnboardingEContinuar,
    definirPadrao,
    fluxoLista,
    duplicar,
    salvarComo,
    salvar,
    carregar,
    deletar,
    extrairDadosIA,
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
    preencherEditor,
    limparTudo,
    initEditorFieldGuards
});
