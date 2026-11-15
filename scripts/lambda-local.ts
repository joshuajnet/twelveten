/**
 * Runs the API's Lambda container image locally, behind an HTTP adapter that turns requests into
 * Lambda Function URL events (the same shape CloudFront → function URL produces in AWS).
 *
 *   npm run lambda:local            # http://localhost:3001/api/health
 *   API_TARGET=http://localhost:3001 npm run dev:web   # the site against the real container
 *
 * Uses the Lambda Runtime Interface Emulator that ships in the AWS base image, connected to the
 * docker-compose Postgres and LocalStack.
 */
import { spawnSync } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.LAMBDA_PORT ?? 3001);
const RIE_PORT = 9010;
const NAME = 'twelveten-lambda-local';

const env = Object.fromEntries(
    readFileSync(resolve(root, '.env.local'), 'utf8')
        .split('\n')
        .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l))
        .filter((m): m is RegExpExecArray => Boolean(m))
        .map((m) => [m[1]!, m[2]!]),
);

function sh(args: string[], inherit = true) {
    const r = spawnSync('docker', args, { cwd: root, stdio: inherit ? 'inherit' : 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`docker ${args[0]} failed${inherit ? '' : `: ${r.stderr}`}`);
    return r.stdout;
}

console.log('› Building the Lambda image…');
sh(['build', '-q', '-f', 'apps/api/Dockerfile', '-t', 'twelveten-api:local', '.']);
spawnSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
console.log('› Starting the container (Runtime Interface Emulator)…');
sh(
    [
        'run', '-d', '--name', NAME, '--network', 'twelveten_default', '-p', `${RIE_PORT}:8080`,
        '-e', 'DATABASE_URL=postgres://twelveten:twelveten@postgres:5432/twelveten',
        '-e', 'DATABASE_SSL=false',
        '-e', `BETTER_AUTH_SECRET=${env.BETTER_AUTH_SECRET}`,
        '-e', `SITE_URL=${process.env.SITE_URL ?? 'http://localhost:5173'}`,
        '-e', `TRUSTED_ORIGINS=${env.TRUSTED_ORIGINS ?? ''}`,
        '-e', 'AWS_REGION=us-east-2', '-e', 'AWS_ACCESS_KEY_ID=test', '-e', 'AWS_SECRET_ACCESS_KEY=test',
        '-e', 'AWS_ENDPOINT_URL=http://localstack:4566',
        '-e', `MEDIA_BUCKET=${env.MEDIA_BUCKET ?? 'twelveten-local-media'}`,
        '-e', `SITE_BUCKET=${env.SITE_BUCKET ?? 'twelveten-local-site'}`,
        'twelveten-api:local',
    ],
    false,
);

async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const body = await readBody(req);
    const headers: Record<string, string> = {};
    const cookies: string[] = [];
    for (const [k, v] of Object.entries(req.headers)) {
        if (k === 'cookie') cookies.push(...String(v).split(/;\s*/));
        else if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(',') : v;
    }
    headers['x-forwarded-for'] ??= req.socket.remoteAddress ?? '127.0.0.1';
    const event = {
        version: '2.0',
        routeKey: '$default',
        rawPath: url.pathname,
        rawQueryString: url.search.slice(1),
        cookies,
        headers,
        requestContext: {
            http: { method: req.method, path: url.pathname, protocol: 'HTTP/1.1', sourceIp: headers['x-forwarded-for'], userAgent: headers['user-agent'] ?? '' },
            requestId: crypto.randomUUID(),
            timeEpoch: Date.now(),
        },
        body: body.length ? body.toString('base64') : undefined,
        isBase64Encoded: body.length > 0,
    };
    try {
        const r = await fetch(`http://localhost:${RIE_PORT}/2015-03-31/functions/function/invocations`, { method: 'POST', body: JSON.stringify(event) });
        const out = (await r.json()) as { statusCode: number; headers?: Record<string, string>; cookies?: string[]; body?: string; isBase64Encoded?: boolean };
        res.statusCode = out.statusCode ?? 502;
        for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
        if (out.cookies?.length) res.setHeader('set-cookie', out.cookies);
        res.end(out.body ? Buffer.from(out.body, out.isBase64Encoded ? 'base64' : 'utf8') : undefined);
    } catch (err) {
        res.statusCode = 502;
        res.end(`Lambda invocation failed: ${String(err)}`);
    }
});

server.listen(PORT, () => {
    console.log(`\n  Lambda container ready: http://localhost:${PORT}/api/health`);
    console.log(`  Site against it: API_TARGET=http://localhost:${PORT} npm run dev:web`);
    console.log('  Ctrl+C stops it.\n');
});

const stop = () => {
    spawnSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
    server.close();
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
