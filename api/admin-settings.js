const SUPABASE_URL_PADRAO = 'https://gjrnaavkyalwolldexft.supabase.co';
const ADMIN_EMAILS = ['dop.jr82@gmail.com', 'dopjr82@gmail.com'];
const SETTINGS_PERMITIDAS = new Map([
    ['active_home_visual', ['visual1', 'visual2', 'visual3']],
    ['modelo_forcado', null]
]);

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function enviarJson(res, status, payload) {
    setCorsHeaders(res);
    return res.status(status).json(payload);
}

function normalizarEmail(valor) {
    return String(valor || '').trim().toLowerCase();
}

async function obterUsuario(req, supabaseUrl, anonKey) {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.toLowerCase().startsWith('bearer ')) return null;

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            apikey: anonKey,
            Authorization: authorization
        }
    });

    if (!response.ok) return null;
    return response.json();
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

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_PADRAO;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return enviarJson(res, 500, { ok: false, error: 'Supabase não configurado no backend.' });
    }

    const settingKey = String(req.body?.setting_key || '').trim();
    const settingValue = String(req.body?.setting_value || '').trim();
    const valoresPermitidos = SETTINGS_PERMITIDAS.get(settingKey);

    if (!SETTINGS_PERMITIDAS.has(settingKey) || (valoresPermitidos && !valoresPermitidos.includes(settingValue))) {
        return enviarJson(res, 400, { ok: false, error: 'Configuração inválida.' });
    }

    const usuario = await obterUsuario(req, supabaseUrl, anonKey);
    const email = normalizarEmail(usuario?.email || usuario?.user_metadata?.email);

    if (!ADMIN_EMAILS.includes(email)) {
        return enviarJson(res, 403, { ok: false, error: 'Apenas administradores podem alterar esta configuração.' });
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/ai_settings?on_conflict=setting_key`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
            setting_key: settingKey,
            setting_value: settingValue,
            description: settingKey === 'active_home_visual'
                ? 'Layout visual ativo da tela inicial pos-login'
                : 'Modelo Gemini forçado manualmente pelo admin',
            user_id: usuario.id,
            is_system_setting: true
        })
    });

    if (!response.ok) {
        const detalhe = await response.text().catch(() => '');
        console.error('Erro ao salvar admin setting:', response.status, detalhe);
        return enviarJson(res, 502, { ok: false, error: 'Não foi possível salvar a configuração.' });
    }

    const data = await response.json().catch(() => []);
    return enviarJson(res, 200, { ok: true, data: Array.isArray(data) ? data[0] : data });
}
