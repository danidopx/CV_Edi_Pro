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

export function validarSenha(senha) { return regexSenha.test(senha); }

export function verificarAdmin() {
    const isAdmin = appState.usuarioAtual && appState.usuarioAtual.email === 'dop.jr82@gmail.com';
    const c = document.getElementById('btn-admin-config');
    if (c) c.style.display = isAdmin ? 'flex' : 'none';
}

export function alternarAbasAdmin(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (btn) btn.classList.add('active');
}

export function abrirConfigAdmin() {
    const lista = JSON.parse(localStorage.getItem('cache_modelos_lista') || '[]');
    const dataH = localStorage.getItem('cache_modelos_data') || '--';

    const syncEl = document.getElementById('sync-data-hora');
    const histEl = document.getElementById('historico-modelos-ia');
    if (syncEl) syncEl.innerText = dataH;
    if (histEl) histEl.innerHTML = lista.map(m => `<div class="model-item-badge">${m}</div>`).join('');

    setValSafe('cfg-prompt-simples', localStorage.getItem('prompt_simples') || DEFAULT_PROMPT_SIMPLES);
    setValSafe('cfg-prompt-agressivo', localStorage.getItem('prompt_agressivo') || DEFAULT_PROMPT_AGRESSIVO);
    setValSafe('cfg-prompt-ats', localStorage.getItem('prompt_ats') || DEFAULT_PROMPT_ATS);
    setValSafe('cfg-prompt-validacao', localStorage.getItem('prompt_validacao') || DEFAULT_PROMPT_VALIDACAO);

    document.getElementById('modal-admin').style.display = 'flex';
    alternarAbasAdmin('tab-modelos');
}

export function salvarConfigAdmin() {
    localStorage.setItem('prompt_simples', getValSafe('cfg-prompt-simples'));
    localStorage.setItem('prompt_agressivo', getValSafe('cfg-prompt-agressivo'));
    localStorage.setItem('prompt_ats', getValSafe('cfg-prompt-ats'));
    localStorage.setItem('prompt_validacao', getValSafe('cfg-prompt-validacao'));
    showToast('Configurações salvas!');
    document.getElementById('modal-admin').style.display = 'none';
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
    irPara('tela-landing');
}