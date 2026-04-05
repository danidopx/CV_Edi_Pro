export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { prompt, modelo } = req.body;
    const apiKey = process.env.GEMINI_KEY; 

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const corpoGoogle = await response.text();
            throw new Error(corpoGoogle || `HTTP ${response.status} (corpo vazio)`);
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro na Vercel Function (ia.js):', error);
        const mensagem = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: mensagem });
    }
}