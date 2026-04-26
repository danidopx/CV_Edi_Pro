const MAX_HTML_CHARS = 800000;
const MAX_TEXT_CHARS = 30000;
const BLOCKED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1'
]);

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function enviarJson(res, status, payload) {
    setCorsHeaders(res);
    return res.status(status).json(payload);
}

function hostnameBloqueado(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return true;
    if (BLOCKED_HOSTS.has(host)) return true;
    if (host.endsWith('.local')) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        if (host.startsWith('10.') || host.startsWith('127.') || host.startsWith('192.168.')) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    }
    return false;
}

function decodificarHtml(texto) {
    return String(texto || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, '\'')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function extrairTextoHtml(html) {
    const semScripts = String(html || '')
        .slice(0, MAX_HTML_CHARS)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|br|tr)>/gi, '\n');

    return decodificarHtml(semScripts.replace(/<[^>]+>/g, ' '))
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, MAX_TEXT_CHARS);
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return enviarJson(res, 405, { ok: false, error: 'Método não permitido. Use POST.' });
    }

    const urlBruta = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!urlBruta) {
        return enviarJson(res, 400, { ok: false, error: 'Informe o link da vaga.' });
    }

    let url;
    try {
        url = new URL(urlBruta);
    } catch {
        return enviarJson(res, 400, { ok: false, error: 'Link da vaga inválido.' });
    }

    if (!['http:', 'https:'].includes(url.protocol) || hostnameBloqueado(url.hostname)) {
        return enviarJson(res, 400, { ok: false, error: 'Esse link não pode ser processado pelo sistema.' });
    }

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CVEdiProBot/1.0; +https://cv-edi-pro.onrender.com)',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            }
        });

        if (!response.ok) {
            return enviarJson(res, 502, {
                ok: false,
                error: `Não foi possível abrir a vaga pelo link. HTTP ${response.status}.`
            });
        }

        const html = await response.text();
        const texto = extrairTextoHtml(html);

        if (texto.length < 80) {
            return enviarJson(res, 422, {
                ok: false,
                error: 'O link abriu, mas o conteúdo extraído foi insuficiente para identificar a vaga.'
            });
        }

        return enviarJson(res, 200, {
            ok: true,
            url: url.toString(),
            texto
        });
    } catch (error) {
        console.error('Erro na Vercel Function (extrair-vaga-url.js):', error);
        return enviarJson(res, 500, {
            ok: false,
            error: 'Erro interno ao buscar a vaga por link.'
        });
    }
}
