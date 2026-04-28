const SUPABASE_URL_PADRAO = 'https://gjrnaavkyalwolldexft.supabase.co';
const ADMIN_EMAILS = ['dop.jr82@gmail.com', 'dopjr82@gmail.com'];

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

    const usuario = await obterUsuario(req, supabaseUrl, anonKey);
    const email = normalizarEmail(usuario?.email || usuario?.user_metadata?.email);

    if (!ADMIN_EMAILS.includes(email)) {
        return enviarJson(res, 403, { ok: false, error: 'Apenas administradores podem alterar prompts.' });
    }

    const prompts = Array.isArray(req.body?.prompts) ? req.body.prompts : [];
    const promptsValidos = prompts.map(prompt => ({
        prompt_name: String(prompt?.prompt_name || '').trim(),
        prompt_content: String(prompt?.prompt_content || '').trim(),
        description: prompt?.description ? String(prompt.description).trim() : null,
        user_id: usuario.id,
        is_system_prompt: true
    })).filter(prompt => prompt.prompt_name && prompt.prompt_content);

    if (promptsValidos.length === 0) {
        return enviarJson(res, 400, { ok: false, error: 'Nenhum prompt válido para salvar.' });
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/ai_prompts?on_conflict=prompt_name`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(promptsValidos)
    });

    if (!response.ok && response.status !== 201) {
        const detalhe = await response.text().catch(() => '');
        console.error('Erro ao salvar admin prompts:', response.status, detalhe);
        return enviarJson(res, 502, { ok: false, error: 'Não foi possível salvar os prompts.' });
    }

    return enviarJson(res, 200, { ok: true });
}
