import pkg from '../package.json' with { type: 'json' };

const version = pkg?.version || '0.0.0';

function definirCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default function handler(req, res) {
    definirCors(res);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const renderUrl = String(process.env.RENDER_EXTERNAL_URL || '').trim();
    const renderCommit = String(process.env.RENDER_GIT_COMMIT || '').trim();
    const renderBranch = String(process.env.RENDER_GIT_BRANCH || '').trim();
    const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase();
    const environmentName = (renderUrl || vercelEnv === 'production') ? 'production' : 'preview';
    const commitSha = renderCommit || String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
    const commitRef = renderBranch || String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
    const deploymentUrl = renderUrl || String(process.env.VERCEL_URL || '').trim();

    return res.status(200).json({
        environment_name: environmentName,
        current_version: version,
        commit_ref: commitSha,
        branch_name: commitRef,
        deployment_url: deploymentUrl ? `https://${deploymentUrl.replace(/^https?:\/\//i, '')}` : '',
        source: renderUrl ? 'render_runtime_build' : 'runtime_build'
    });
}
