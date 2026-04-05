import { sb, appState, DEFAULT_PROMPT_SIMPLES, DEFAULT_PROMPT_AGRESSIVO, DEFAULT_PROMPT_ATS } from './config.js';
import { logDebug, processarIA } from './api.js';
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
    renderizarATS,
    mostrarCarregamentoATS,
    ajustarZoomMobile,
    fecharAbaPai,
    fecharFullscreenSeguro,
    iniciarTour
} from './ui.js';
import { abrirGestaoUsuarios } from './auth.js';

export function marcarAlteracao() {
    appState.temAlteracoesNaoSalvas = true;
    if (appState.analiseAtsAtual && appState.vagaOriginalAtual) {
        const btnRecalcular = document.getElementById('btn-recalcular-ats');
        if (btnRecalcular) btnRecalcular.style.display = 'flex';
    }
}

export function recuperarEstadoTela() {
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

        const promptValidacao = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Motivo da reprovação"}. Texto: ${textoVaga.substring(0, 1000)}`;

        const validacao = await processarIA(promptValidacao);
        logDebug(`Resposta da IA recebida: ${JSON.stringify(validacao)}`);

        if (validacao && validacao.valida === false) {
            logDebug('⛔ IA reprovou o conteúdo da vaga.', true);
            alert("⚠️ Ops! Não foi possível importar esta vaga.\n\nMotivo apontado pela IA: " + (validacao.motivo || "Conteúdo não reconhecido como vaga de emprego.") + "\n\nSe a vaga for real, tente copiar e colar o texto manualmente.");
            localStorage.removeItem('vaga_pendente_importacao');
            irPara('tela-menu');
            return;
        }

        logDebug('✅ Vaga Aprovada. Preenchendo a tela...');
        localStorage.removeItem('vaga_pendente_importacao');
        await abrirTelaVaga();

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
    await abrirTelaVaga();
    const txtEl = document.getElementById('texto-vaga');
    if (txtEl) txtEl.value = textoCompleto;
    showToast('📱 Vaga recebida do celular! Selecione o seu currículo base e clique em Gerar.');
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

export function salvarOnboardingEContinuar() {
    const n = getValSafe('onb-nome');
    const e = getValSafe('onb-email');
    const w = getValSafe('onb-whats');
    if (!n || !e || w === undefined) return alert('Por favor, preencha os campos obrigatórios para criar a base do seu currículo.');

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

export function definirPadrao(id) {
    if (!appState.usuarioAtual) return;
    localStorage.setItem('cv_padrao_' + appState.usuarioAtual.id, id);
    showToast('⭐ Currículo Padrão atualizado!');
    fluxoLista();
}

export async function fluxoLista() {
    irPara('tela-lista');
    const grid = document.getElementById('grid-salvos');
    if (!grid) return;
    grid.innerHTML = '<p>Carregando...</p>';

    const padraoId = localStorage.getItem('cv_padrao_' + appState.usuarioAtual.id);

    const { data, error } = await sb.from('curriculos_saas').select('identificador, conteudo').eq('user_id', appState.usuarioAtual.id).order('identificador', { ascending: true });
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
            const data = d.toLocaleDateString('pt-BR');
            const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            linhaAtualizado = `Atualizado: ${data} às ${hora}`;
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

export async function duplicar(idOriginal) {
    const novoId = prompt('Nome para a cópia (ex: Versão 2):', idOriginal + ' - Cópia');
    if (!novoId) return;
    const { data } = await sb.from('curriculos_saas').select('*').eq('identificador', idOriginal).eq('user_id', appState.usuarioAtual.id).single();
    if (data) {
        const payload = { identificador: novoId, user_id: appState.usuarioAtual.id, conteudo: data.conteudo };
        const { error } = await sb.from('curriculos_saas').insert(payload);
        if (error) alert('Erro ao duplicar: O nome já deve existir.');
        else {
            showToast();
            fluxoLista();
        }
    }
}

export async function salvarComo() {
    if (!appState.idAtual) return alert('Por favor, guarde o currículo normalmente primeiro antes de criar uma cópia.');
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
        alert('Erro ao salvar.');
    }
}

export async function carregar(id) {
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

        irPara('tela-editor');
        iniciarTour();
    }
}

export async function deletar(id) {
    if (confirm(`Tem certeza que deseja apagar o currículo "${id}" definitivamente?`)) {
        const { error } = await sb.from('curriculos_saas').delete().eq('identificador', id).eq('user_id', appState.usuarioAtual.id);
        if (error) {
            alert('Erro ao apagar: ' + error.message);
        } else {
            showToast('🗑️ Currículo apagado com sucesso!');
            fluxoLista();
        }
    }
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

            if (!valido) aviso.style.display = 'block';
            else aviso.style.display = 'none';
        }
    } catch (e) {
        console.error('Erro validação base', e);
    }
}

export async function extrairDadosIA() {
    const txt = getValSafe('texto-ia');
    if (!txt) return alert('Cole texto!');

    mostrarCarregamento();
    document.getElementById('loading-text').innerText = 'Processando Inteligência Artificial...';

    const prompt = `Aja como conversor estrito de texto para JSON. Formato obrigatório: { "nome": "", "endereco": "", "cep": "", "email": "", "whatsapp": "", "linkedin": "", "resumo": "texto", "experiencias": [{"cargo":"", "empresa":"", "ini":"", "fim":"", "desc":""}], "formacao": [{"curso":"", "inst":"", "ini":"", "status":""}], "idiomas": [{"nome":"", "nivel":""}], "habilidades": ["skill1"] } STATUS FORMAÇÃO: Obrigatório retornar um dos: "Concluído", "Cursando", "Trancado". Texto: ${txt}`;

    try {
        const extraido = await processarIA(prompt);
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
        if (err.message !== 'Erro JSON.') alert('Erro: ' + err.message);
    } finally {
        ocultarCarregamento();
    }
}

async function gerarAtsEmSegundoPlano(textoVaga, curriculoAdaptado, abrirPainel = true) {
    mostrarCarregamentoATS(abrirPainel);
    try {
        const promptAtsBase = localStorage.getItem('adminPromptAts') || DEFAULT_PROMPT_ATS;
        const promptFinalAts = promptAtsBase.replace('{{VAGA}}', textoVaga).replace('{{CURRICULO}}', JSON.stringify(curriculoAdaptado));

        const resultadoAts = await processarIA(promptFinalAts);
        appState.analiseAtsAtual = resultadoAts;
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

export async function ajustarCurriculoVaga() {
    const idBase = getValSafe('select-curriculo-base');
    const textoVaga = getValSafe('texto-vaga');
    const nivelAjuste = getValSafe('nivel-ajuste');
    if (!idBase || !textoVaga) return alert('Preencha todos os campos da tela.');

    mostrarCarregamento();

    try {
        document.getElementById('loading-text').innerText = 'Analisando a vaga...';
        const promptValidacao = `Aja como um classificador estrito. O texto abaixo é uma descrição de vaga de emprego ATIVA ou requisitos de uma posição? Se o texto indicar explicitamente que a vaga está ENCERRADA, EXPIRADA ou com prazo de inscrição VENCIDO, retorne "valida": false e o motivo. Retorne APENAS um JSON válido. Formato: {"valida": true, "motivo": ""} ou {"valida": false, "motivo": "Explique resumidamente por que não parece uma vaga ativa"}. Texto: ${textoVaga.substring(0, 1500)}`;
        const validacao = await processarIA(promptValidacao);

        if (validacao && validacao.valida === false) {
            ocultarCarregamento();
            alert("⚠️ Aviso da IA sobre a vaga:\n\n" + (validacao.motivo || "O texto inserido não parece conter os dados de uma vaga de emprego."));
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
        const basePrompt = nivelAjuste === 'agressivo'
            ? (localStorage.getItem('adminPromptAgressivo') || DEFAULT_PROMPT_AGRESSIVO)
            : (localStorage.getItem('adminPromptSimples') || DEFAULT_PROMPT_SIMPLES);

        const promptAjustado = basePrompt + ' STATUS FORMAÇÃO: Obrigatório manter/reescrever para um dos: "Concluído", "Cursando", "Trancado".';

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
        if (matchOrigem) {
            appState.origemAtual = `Adaptado da vaga (${matchOrigem[1]})`;
        } else {
            appState.origemAtual = 'Adaptado da vaga (Texto copiado)';
        }
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
        if (err.message !== 'Erro JSON.') alert('Erro: ' + err.message);
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
                alert('⚠️ Por favor, insira um e-mail válido.');
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

