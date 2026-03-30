# CV Edi Pro 📄✨

O **CV Edi Pro** é uma aplicação SaaS (Software as a Service) projetada para automatizar, otimizar e validar a criação de currículos através do poder da Inteligência Artificial Generativa.

O sistema permite que os usuários fujam da formatação manual tradicional, extraiam dados de arquivos antigos com um clique, ajustem perfeitamente seus currículos para vagas específicas e obtenham um Score ATS (Applicant Tracking System) antes da candidatura.

## 🚀 Funcionalidades Principais

* **Extração Mágica (IA):** Transforma textos brutos de currículos antigos ou perfis do LinkedIn em dados estruturados automaticamente.
* **Ajuste Cirúrgico à Vaga:** Cruza os dados do perfil do candidato com a descrição da vaga, reescrevendo o currículo para garantir a maior aderência possível com as palavras-chave buscadas pelo RH.
* **Análise de Score ATS:** Avaliação assíncrona gerada por IA que simula um robô de triagem, fornecendo pontuação de 0 a 100, risco de eliminação, identificação de "gaps" (lacunas) e sugestões de melhoria.
* **Currículo "Patrão" (Padrão):** Sistema de favoritamento de currículos base para agilizar fluxos repetitivos.
* **Exportação Profissional:** Geração de arquivos PDF com design limpo, tipografia moderna e paginação inteligente.
* **PWA / Mobile First:** Interface totalmente adaptada para dispositivos móveis, com recurso de ampliação em tela cheia (zoom) para edição e compatibilidade de instalação como aplicativo (PWA).

## 🛠️ Stack Tecnológico

A arquitetura atual foi projetada para altíssima velocidade de carregamento, utilizando uma abordagem Serverless Monolítica no front-end:

* **Front-end:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **BaaS (Backend as a Service):** Supabase (Autenticação, PostgreSQL, Funções RPC).
* **Inteligência Artificial:** Google Gemini API (`gemini-1.5-flash`).
* **Geração de PDF:** `jsPDF`.
* **Deploy:** Vercel.

## ⚙️ Estrutura do Projeto

* `index.html`: Core da aplicação contendo toda a interface de usuário, lógicas de transição de estado e requisições para a API do Supabase e Google Gemini.
* `sw.js`: Service Worker responsável pelo cache de assets e comportamento PWA.
* `manifest.json`: Diretivas de instalação do aplicativo mobile/desktop.

## 🔒 Segurança e Tratamento de Dados

* Rate Limiting manual aplicado na interface gráfica para evitar estresse de API e custos desnecessários em chamadas de IA.
* Proteção contra perda de dados via evento `beforeunload`, impedindo navegações acidentais com modificações não salvas no editor.
* Painel Administrativo com controle de bloqueio e exclusão de contas, além de gestão dinâmica dos Prompts de IA diretamente do painel do criador.

## 📌 Versão Atual
**v1.1.18** - Implementação de processamento assíncrono de ATS, UX otimizada no painel de edição e gestão de currículos padrão.
