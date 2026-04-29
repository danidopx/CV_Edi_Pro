import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import buildVersionHandler from './api/build-version.js';
import adminPromptsHandler from './api/admin-prompts.js';
import adminSettingsHandler from './api/admin-settings.js';
import extrairVagaUrlHandler from './api/extrair-vaga-url.js';
import iaHandler from './api/ia.js';
import modelosHandler from './api/modelos.js';
import salvarVagaHandler from './api/salvar-vaga.js';
import validarVagaHandler from './api/validar-vaga.js';

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/visual', express.static(path.join(__dirname, 'visual')));

function adapt(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

app.all('/api/build-version', adapt(buildVersionHandler));
app.all('/api/admin-prompts', adapt(adminPromptsHandler));
app.all('/api/admin-settings', adapt(adminSettingsHandler));
app.all('/api/extrair-vaga-url', adapt(extrairVagaUrlHandler));
app.all('/api/ia', adapt(iaHandler));
app.all('/api/modelos', adapt(modelosHandler));
app.all('/api/salvar-vaga', adapt(salvarVagaHandler));
app.all('/api/validar-vaga', adapt(validarVagaHandler));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CV Edi Pro rodando na porta ${PORT}`);
});
