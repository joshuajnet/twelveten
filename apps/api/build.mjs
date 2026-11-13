// Bundles the Lambda handlers into dist/ (one ESM file each, dependencies included).
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
    // Some bundled CommonJS dependencies call require(); give ESM output one.
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    logLevel: 'info',
});
