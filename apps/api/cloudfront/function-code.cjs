// Exposes viewer-request.js to serverless.yml as ${file(./cloudfront/function-code.cjs):code}, with the
// stage's canonical host (custom.domain) and the hosts that redirect to it (custom.redirectDomains,
// comma-separated) filled in.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/** Replaces the CANONICAL_HOST / REDIRECT_HOSTS placeholders in the function source. */
function withHosts(source, domain, redirectDomains) {
    const hosts = String(redirectDomains || '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    const canonical = String(domain || '').trim().toLowerCase();
    const out = source
        .replace("var CANONICAL_HOST = '';", `var CANONICAL_HOST = ${JSON.stringify(canonical)};`)
        .replace('var REDIRECT_HOSTS = [];', `var REDIRECT_HOSTS = ${JSON.stringify(canonical ? hosts : [])};`);
    if (!out.includes('var CANONICAL_HOST') || !out.includes('var REDIRECT_HOSTS')) throw new Error('viewer-request.js placeholders missing');
    return out;
}

module.exports = async ({ resolveVariable }) => {
    const source = readFileSync(join(__dirname, 'viewer-request.js'), 'utf8');
    const domain = resolveVariable ? await resolveVariable('self:custom.domain') : '';
    const redirectDomains = resolveVariable ? await resolveVariable('self:custom.redirectDomains') : '';
    return { code: withHosts(source, domain, redirectDomains) };
};
module.exports.withHosts = withHosts;
