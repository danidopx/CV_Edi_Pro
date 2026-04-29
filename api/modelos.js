export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_KEY; 

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) throw new Error("Erro na API do Google Models");
        
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
    console.error("Erro na API Render (modelos.js):", error);
        res.status(500).json({ error: 'Erro interno ao buscar modelos' });
    }
}
