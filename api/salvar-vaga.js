const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXTO_CHARS = 30000;
const MIN_TEXTO_CHARS = 40;
const SUPABASE_URL_PADRAO = 'https://gjrnaavkyalwolldexft.supabase.co';

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function enviarJson(res, status, payload) {
    setCorsHeaders(res);
    return res.status(status).json(payload);
}

function normalizarTexto(texto) {
    return typeof texto === 'string'
        ? texto.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO_CHARS)
        : '';
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return enviarJson(res, 405, {
            ok: false,
            error: 'Método não permitido. Use POST.'
        });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_PADRAO;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return enviarJson(res, 500, {
            ok: false,
            error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no backend.'
        });
    }

    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const texto = normalizarTexto(req.body?.texto);

    if (!UUID_REGEX.test(id)) {
        return enviarJson(res, 400, {
            ok: false,
            error: 'ID da vaga inválido.'
        });
    }

    if (texto.length < MIN_TEXTO_CHARS) {
        return enviarJson(res, 400, {
            ok: false,
            error: 'Texto da vaga vazio ou insuficiente.'
        });
    }

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/transferencias_vagas`, {
            method: 'POST',
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
            },
            body: JSON.stringify({ id, texto })
        });

        if (!response.ok && response.status !== 201) {
            const detalhe = await response.text().catch(() => '');
            console.error('Erro ao salvar transferencia de vaga:', response.status, detalhe);
            return enviarJson(res, 502, {
                ok: false,
                error: 'Não foi possível salvar a vaga validada.'
            });
        }

        return enviarJson(res, 200, {
            ok: true,
            id
        });
    } catch (error) {
    console.error('Erro na API Render (salvar-vaga.js):', error);
        return enviarJson(res, 500, {
            ok: false,
            error: 'Erro interno ao salvar a vaga.'
        });
    }
}
