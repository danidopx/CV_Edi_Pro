# 📝 CV Edi PRO - Gerador de Currículos com IA

O **CV Edi PRO** é uma aplicação PWA (Progressive Web App) desenvolvida para automatizar a criação e adaptação de currículos utilizando Inteligência Artificial (Google Gemini). O sistema extrai dados de textos brutos e os adapta estrategicamente para vagas específicas, focando em aprovação em sistemas de triagem (ATS).

---

## 🚀 Tecnologias e Arquitetura

### **Frontend**
* **Linguagens:** HTML5, CSS3, JavaScript Vanilla (ES6 Modules).
* **Bibliotecas:** * [Supabase JS](https://supabase.com/docs/reference/javascript/introduction): Autenticação e Banco de Dados.
    * [jsPDF](https://github.com/parallax/jsPDF): Geração de PDFs no lado do cliente.
* **PWA:** Service Worker (`sw.js`) para cache offline e Manifesto para instalação mobile.

### **Backend & Infraestrutura**
* **Hospedagem:** [Vercel](https://vercel.com/).
* **Serverless Functions:** Localizadas em `/api/ia.js` para processamento seguro de chamadas à API do Google Gemini.
* **Banco de Dados:** Supabase (PostgreSQL) com Row Level Security (RLS) ativo.

---

## 🛠️ Estrutura de Arquivos

* `index.html`: Gerenciador de telas (Landing, Login, Editor) via IDs.
* `config.js`: Central de constantes, chaves públicas e Prompts Base da IA.
* `api.js`: Gerencia a comunicação com a Vercel Function e logs de debug.
* `auth.js`: Lógica de autenticação Supabase e permissões de Administrador.
* `cv-builder.js`: Core da lógica de construção do currículo e integração ATS.
* `ui.js`: Manipulação de DOM, temas (dark/light) e máscaras de interface.
* `pdf.js`: Configurações de layout e exportação do documento PDF.

---

## 🔑 Configurações Necessárias (Vercel)

Para o funcionamento da IA, as seguintes variáveis de ambiente devem estar configuradas no painel da Vercel:
* `GEMINI_KEY`: Sua chave de API do Google AI Studio.

---

## 🧠 Lógica de Prompts (IA)

O sistema utiliza quatro motores principais de processamento:
1.  **Extração:** Converte texto do LinkedIn/CV antigo em JSON estruturado.
2.  **Adaptação Simples:** Ajusta o resumo e competências para uma vaga.
3.  **Adaptação Agressiva (ATS):** Otimiza o currículo com palavras-chave estratégicas.
4.  **Análise ATS:** Gera um score de 0 a 100 e fornece feedback de melhorias.


---
Criado por [Daniel](https://github.com/danidopx) - 2026
