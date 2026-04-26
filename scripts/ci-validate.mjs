import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'package.json',
  'vercel.json',
  'api/build-version.js',
  'public/index.html',
  'public/sw.js',
  'api/ia.js',
  'api/modelos.js',
  'api/extrair-vaga-url.js',
  'api/salvar-vaga.js',
  'api/validar-vaga.js'
];

const jsFiles = [
  'api/build-version.js',
  'api/ia.js',
  'api/modelos.js',
  'api/extrair-vaga-url.js',
  'api/salvar-vaga.js',
  'api/validar-vaga.js',
  'public/analise-vaga.js',
  'public/api.js',
  'public/auth.js',
  'public/config.js',
  'public/cv-builder.js',
  'public/editor.js',
  'public/main.js',
  'public/pdf.js',
  'public/sw.js',
  'public/ui.js'
];

async function ensureFileExists(file) {
  await access(file, constants.F_OK);
}

async function validateJson(file) {
  const content = await readFile(file, 'utf8');
  JSON.parse(content);
}

async function validateVercelConfig() {
  const content = await readFile('vercel.json', 'utf8');
  const config = JSON.parse(content);

  if (config?.git?.deploymentEnabled !== true) {
    throw new Error('vercel.json: git.deploymentEnabled deve permanecer true para permitir preview automático por branch.');
  }

  if (config?.github?.autoAlias !== false) {
    throw new Error('vercel.json: github.autoAlias deve permanecer false para preservar o mapeamento controlado de preview/produção.');
  }
}

async function validateJavaScript(file) {
  const content = await readFile(file, 'utf8');
  const normalized = content
    .replace(/^\uFEFF/, '')
    .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"](\s+with\s+\{[\s\S]*?\})?;\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^\s*export\s*\{[\s\S]*?\}\s*from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/\bexport\s+default\s+/g, '')
    .replace(/\bexport\s+(?=async\s+function|function|const|let|var|class)/g, '')
    .replace(/\bexport\s*\{[\s\S]*?\};?/gm, '');

  try {
    new Function(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: ${message}`);
  }
}

try {
  await Promise.all(requiredFiles.map(ensureFileExists));
  await Promise.all([validateJson('package.json'), validateJson('vercel.json')]);
  await validateVercelConfig();

  for (const file of jsFiles) {
    await validateJavaScript(file);
  }

  console.log('CI validation passed.');
} catch (error) {
  console.error('CI validation failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
