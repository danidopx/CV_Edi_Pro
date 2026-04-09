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

Dossiê Técnico: CV Edi Pro
1. Visão Geral da Arquitetura
O projeto é um PWA (Progressive Web App) de página única (SPA), onde a navegação entre a Landing Page, o Login e o Editor acontece via manipulação de visibilidade de elementos no DOM, sem recarregar a página.

Frontend: HTML5, CSS3 (Variáveis nativas), JavaScript Vanilla (ES6 Modules).

Backend Serverless: Vercel Functions (Node.js) para chamadas seguras de IA.

BaaS (Backend as a Service): Supabase (Auth, Database, RLS).

2. Estrutura de Dados e Integrações
Supabase (Banco de Dados)
Tabela profiles: Dados estendidos do usuário (nome, preferências, metadados de onboarding).

Tabela curriculos: Armazena objetos JSON contendo a estrutura completa do CV.

Segurança (RLS): Toda tabela possui Row Level Security ativa, garantindo que o uid do usuário autenticado só acesse seus próprios registros.

RPC: Existem funções PostgreSQL (RPC) como desativar_minha_conta chamadas via JS.

Vercel Functions (IA)
Rota: /api/ia.js

Lógica: Recebe o prompt e o modelo do frontend, anexa a GEMINI_KEY (variável de ambiente oculta) e faz o fetch para a API do Google Gemini.

Modelo Padrão: gemini-1.5-flash ou gemini-1.5-flash-latest.

3. Lógica de Navegação e Estado (Frontend)
Gerenciamento de Telas (ui.js e index.html)
A navegação utiliza a função irPara(idTela).

As telas principais são: tela-landing, tela-login, tela-editor e tela-onboarding.

IMPORTANTE: Nunca crie novos arquivos .html. Toda nova funcionalidade deve ser uma div com a classe .tela dentro do index.html.

Estado Global (config.js)
O objeto appState centraliza o usuário atual, o ID do currículo em edição, o modelo de IA selecionado e o histórico de telas para a função "voltar".

4. O "Cérebro" da IA (cv-builder.js e api.js)
A aplicação depende da conversão de texto bruto em JSON estruturado.

Processamento: O frontend envia um prompt para a API.

Sanitização: A função processarIA em api.js limpa a resposta da IA (remove marcações de markdown como ```json) e faz o JSON.parse().

Renderização: O JSON retornado preenche automaticamente os campos do editor e o preview visual.

5. Regras de Ouro para a Próxima IA (Instruções de Programação)
Para evitar quebras no código, a IA deve seguir estas diretrizes:

Não altere a estrutura do modal de Login: O fluxo de autenticação (Google e e-mail) está vinculado a IDs específicos (login-email, login-senha).

Preserve o Service Worker: Qualquer mudança em arquivos estáticos (JS, CSS, HTML) exige o incremento da constante CACHE_NAME no sw.js e da versão ?v=... nas importações do index.html.

CSS Variável: Use as variáveis definidas no :root do style.css para manter a consistência do tema Dark/Light.

Acesso Admin: A lógica de administrador é baseada no e-mail dop.jr82@gmail.com. Funções como abrirConfigAdmin() só devem ser renderizadas se este e-mail estiver logado.

Tratamento de PDF: A função gerarPDF em pdf.js usa coordenadas fixas em mm (A4). Alterações no layout do CV no editor não refletem automaticamente no PDF sem ajuste manual das coordenadas no script.

6. Configurações de Deploy (Vercel)
Build Command: (Padrão/Vazio - projeto estático).

Output Directory: . (Raiz).

Environment Variables: É obrigatório configurar GEMINI_KEY no Dashboard da Vercel para que a extração mágica funcione.



----
Criado por [Daniel](https://github.com/danidopx) - 2026
