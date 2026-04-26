/**
 * Scripts de conteúdo para ler a vaga na tela
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_JOB_TEXT") {
        // Seletores comuns de sites de vagas
        const selectors = [
            '.jobs-description', // LinkedIn
            '#job-description', // Gupy
            '.job-description-main-content', // Vagas.com
            '.jobsearch-JobComponent-description', // Indeed
            'article', // Genérico
            'main'     // Genérico
        ];

        let jobText = "";
        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                jobText = element.innerText;
                break;
            }
        }

        // Se não achou em nenhum seletor específico, pega o body (menos scripts)
        if (!jobText || jobText.length < 100) {
            jobText = document.body.innerText;
        }

        sendResponse({ 
            text: jobText.slice(0, 30000), 
            url: window.location.href,
            title: document.title
        });
    }
});
