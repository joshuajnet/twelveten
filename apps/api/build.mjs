// Bundles the Lambda handlers into dist/ (one ESM file each, dependencies included).
import { cpSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

await build({
    entryPoints: { lambda: 'src/lambda.ts', migrate: 'src/migrate.ts', rebuild: 'src/rebuild.ts' },
    outdir: 'dist',
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: true,
    // The Lambda runtime ships the AWS SDK v3; pg-native is optional and unused.
    external: ['@aws-sdk/*', 'pg-native'],
    // Some bundled CommonJS dependencies call require() or use __filename / __dirname (pdfkit, pdfmake); give ESM output all three.
    banner: {
        js: [
            "import { createRequire } from 'node:module';",
            "import { fileURLToPath as __bannerFileURLToPath } from 'node:url';",
            "import { dirname as __bannerDirname } from 'node:path';",
            'const require = createRequire(import.meta.url);',
            'const __filename = __bannerFileURLToPath(import.meta.url);',
            'const __dirname = __bannerDirname(__filename);',
        ].join(' '),
    },
    logLevel: 'info',
});

// pdfkit (used by pdfmake for CV PDFs) loads its built-in fonts at runtime with
// require('#standard-fonts/<Name>'), which the bundle can't inline. Ship those modules next to
// the bundle and map the import in dist/package.json, the nearest package.json at runtime.
const pdfkitJs = dirname(createRequire(createRequire(import.meta.url).resolve('pdfmake')).resolve('pdfkit')); // …/pdfkit/js
cpSync(join(pdfkitJs, 'standard-fonts'), 'dist/standard-fonts', { recursive: true, filter: (src) => !src.endsWith('.mjs') });
writeFileSync('dist/package.json', `${JSON.stringify({ type: 'module', imports: { '#standard-fonts/*': './standard-fonts/*.cjs' } }, null, 4)}\n`);

// Gallery fonts for invoice PDFs (read by src/lib/pdf.ts from fonts/ next to the bundle).
cpSync('assets/fonts', 'dist/fonts', { recursive: true });
