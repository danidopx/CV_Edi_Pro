const MODELOS_FALLBACK = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
];

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function chamarGemini({ prompt, modelo, apiKey }) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    let corpo = null;
    try {
        corpo = await response.text();
    } catch {
        corpo = '';
    }

    return { response, corpo };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { prompt, modelo } = req.body;
    const apiKey = process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY;

    try {
        if (!apiKey) {
            return res.status(500).json({ error: 'Variável GEMINI_KEY não configurada no ambiente.' });
        }

        const modelosParaTentar = [modelo, ...MODELOS_FALLBACK.filter(item => item !== modelo)];
        let ultimoStatus = 500;
        let ultimoErro = 'Erro desconhecido ao chamar a API Gemini.';

        for (const modeloAtual of modelosParaTentar) {
            for (let tentativa = 0; tentativa < 2; tentativa++) {
                const { response, corpo } = await chamarGemini({ prompt, modelo: modeloAtual, apiKey });

                if (response.ok) {
                    const data = JSON.parse(corpo);
                    return res.status(200).json(data);
                }

                ultimoStatus = response.status;
                ultimoErro = corpo || `HTTP ${response.status} (corpo vazio)`;

                const indisponivel = response.status === 503 && ultimoErro.includes('"status": "UNAVAILABLE"');
                if (indisponivel && tentativa === 0) {
                    await esperar(1200);
                    continue;
                }

                if (!indisponivel) {
                    break;
                }
            }
        }

        res.status(ultimoStatus).json({ error: ultimoErro });
    } catch (error) {
    console.error('Erro na API Render (ia.js):', error);
        const mensagem = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: mensagem });
    }
}
