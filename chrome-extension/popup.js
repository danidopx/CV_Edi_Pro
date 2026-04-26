const API_URL = "https://cv-edi-pro.onrender.com/api/salvar-vaga";
const APP_URL = "https://cv-edi-pro.onrender.com";

document.getElementById('captureBtn').addEventListener('click', async () => {
    const msgDiv = document.getElementById('resultMsg');
    msgDiv.textContent = "🔍 Lendo dados da página...";
    msgDiv.style.color = "#6c5ce7";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        msgDiv.textContent = "Erro: Aba não encontrada.";
        return;
    }

    try {
        // Envia mensagem para o content.js disparar a raspagem
        chrome.tabs.sendMessage(tab.id, { action: "GET_JOB_TEXT" }, async (response) => {
            if (!response || !response.text) {
                msgDiv.textContent = "⚠️ Não foi possível ler o texto da vaga nesta página.";
                msgDiv.style.color = "red";
                return;
            }

            msgDiv.textContent = "🚀 Enviando para o CV Edi Pro...";
            
            // Gera um UUID para a transferência
            const vagaId = crypto.randomUUID();

            const apiResponse = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: vagaId,
                    texto: response.text
                })
            });

            const result = await apiResponse.json();

            if (apiResponse.ok && result.ok) {
                msgDiv.textContent = "✅ Sucesso! Abrindo editor...";
                msgDiv.style.color = "green";
                
                // Abre o site com o ID da vaga na URL
                setTimeout(() => {
                    chrome.tabs.create({ url: `${APP_URL}/?vaga_id=${vagaId}` });
                }, 1000);
            } else {
                msgDiv.textContent = "❌ Falha ao salvar: " + (result.error || "Erro desconhecido");
                msgDiv.style.color = "red";
            }
        });
    } catch (err) {
        msgDiv.textContent = "❌ Erro de conexão com a página.";
        msgDiv.style.color = "red";
        console.error(err);
    }
});
