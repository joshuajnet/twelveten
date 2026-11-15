// Exposes viewer-request.js to serverless.yml as ${file(./cloudfront/function-code.cjs):code}.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

module.exports = () => ({ code: readFileSync(join(__dirname, 'viewer-request.js'), 'utf8') });
