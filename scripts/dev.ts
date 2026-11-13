/**
 * One-command local development:
 *   1. creates .env.local on first run (random auth secret, local admin credentials)
 *   2. starts Postgres + LocalStack (docker compose) and waits until healthy
 *   3. applies migrations, seeds the original content once, ensures the local admin exists
 *   4. runs the API (tsx watch) and the site (Vite) together
 *   5. prints where everything is
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, '.env.local');
const PREFERRED_SITE_PORT = 5173;
const API_PORT = 3000;

/** First free port at or after `start` (localhost). */
function freePort(start: number): Promise<number> {
    return new Promise((resolvePort) => {
        const srv = createServer();
        srv.once('error', () => resolvePort(freePort(start + 1)));
        srv.listen(start, '127.0.0.1', () => srv.close(() => resolvePort(start)));
    });
}

const c = {
    dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
    cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
    magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};
const step = (msg: string) => console.log(`${c.cyan('›')} ${msg}`);
const link = (url: string) => `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;

function parseEnv(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m) out[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, '');
    }
    return out;
}

/** 1. Local settings. */
function ensureEnv(): { env: Record<string, string>; firstRun: boolean } {
    let firstRun = false;
    let newAdmin = false;
    if (!existsSync(envFile)) {
        firstRun = true;
        const example = readFileSync(resolve(root, '.env.example'), 'utf8')
            .replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64url')}`);
        writeFileSync(envFile, example);
        step('Created .env.local');
    }
    let text = readFileSync(envFile, 'utf8');
    if (!/^ADMIN_EMAIL=/m.test(text)) {
        text += `\n# Local admin (created by npm run dev)\nADMIN_EMAIL=admin@twelveten.local\nADMIN_PASSWORD=${randomBytes(12).toString('base64url')}\n`;
        writeFileSync(envFile, text);
        newAdmin = true;
    }
    return { env: parseEnv(readFileSync(envFile, 'utf8')), firstRun: firstRun || newAdmin };
}

function run(cmd: string, args: string[], opts: { env?: Record<string, string>; quiet?: boolean } = {}) {
    const res = spawnSync(cmd, args, {
        cwd: root,
        env: { ...process.env, ...opts.env },
        stdio: opts.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        encoding: 'utf8',
    });
    if (res.status !== 0) {
        if (opts.quiet) process.stderr.write(`${res.stdout ?? ''}${res.stderr ?? ''}`);
        throw new Error(`${cmd} ${args.join(' ')} failed (exit ${res.status ?? res.signal})`);
    }
    return res.stdout ?? '';
}

/** 2. Containers. */
function startContainers() {
    const docker = spawnSync('docker', ['info'], { stdio: 'ignore' });
    if (docker.status !== 0) {
        console.error(c.red('Docker is not running. Start Docker and try again.'));
        process.exit(1);
    }
    step('Starting Postgres and LocalStack (docker compose)…');
    run('docker', ['compose', 'up', '-d', '--wait'], { quiet: true });
}

/** 3. Database + admin. */
function prepareData(env: Record<string, string>): { seeded: boolean } {
    step('Applying migrations…');
    run('npm', ['run', '--silent', 'db:migrate', '-w', 'apps/api'], { env, quiet: true });
    step('Loading content (first run only)…');
    const out = run('npm', ['run', '--silent', 'db:seed', '-w', 'apps/api'], { env, quiet: true });
    const seeded = !out.includes('already applied');
    run('npm', ['run', '--silent', 'admin:create', '-w', 'apps/api', '--', '--email', env.ADMIN_EMAIL!, '--password', env.ADMIN_PASSWORD!, '--name', 'Admin'], {
        env,
        quiet: true,
    });
    return { seeded };
}

/** 4. Long-running processes with prefixed output. */
const children: ChildProcess[] = [];
function startProcess(name: string, color: (s: string) => string, args: string[], env: Record<string, string>) {
    const child = spawn('npm', args, { cwd: root, env: { ...process.env, ...env, FORCE_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const prefix = color(`[${name}]`);
    const pipe = (stream: NodeJS.ReadableStream) => {
        let buf = '';
        stream.on('data', (chunk: Buffer) => {
            buf += chunk.toString();
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) if (line.trim()) console.log(`${prefix} ${line}`);
        });
    };
    pipe(child.stdout!);
    pipe(child.stderr!);
    child.on('exit', (code) => {
        if (!shuttingDown) {
            console.log(c.red(`${name} exited (${code}). Stopping.`));
            shutdown(1);
        }
    });
    children.push(child);
}

let shuttingDown = false;
function shutdown(code = 0) {
    shuttingDown = true;
    for (const child of children) child.kill('SIGTERM');
    setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function waitFor(url: string, timeoutMs = 60_000): Promise<boolean> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        try {
            const res = await fetch(url);
            if (res.ok) return true;
        } catch {
            // not up yet
        }
        await new Promise((r) => setTimeout(r, 400));
    }
    return false;
}

function banner(env: Record<string, string>, sitePort: number, showCredentials: boolean, mediaMissing: boolean) {
    const site = `http://localhost:${sitePort}`;
    const rows: [string, string][] = [
        ['Site', link(site)],
        ['Admin', link(`${site}/admin/login`)],
    ];
    if (showCredentials) rows.push(['', `${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}`]);
    rows.push(['API', `${link(`http://localhost:${API_PORT}/api/health`)}  ${c.green('ok')}`]);
    rows.push(['LocalStack', `http://localhost:4566  (buckets ${env.MEDIA_BUCKET}, ${env.SITE_BUCKET})`]);
    rows.push(['Postgres', 'postgres://twelveten:twelveten@localhost:5432/twelveten']);
    const strip = (s: string) => s.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '').replace(/\x1b\[[0-9;]*m/g, '');
    const width = Math.max(...rows.map(([k, v]) => k.length + strip(v).length)) + 14;
    const title = ' Twelve Ten — local dev ready ';
    console.log('');
    console.log(`┌─${c.bold(title)}${'─'.repeat(Math.max(0, width - title.length - 1))}┐`);
    for (const [k, v] of rows) {
        const text = `  ${k.padEnd(11)}${v}`;
        console.log(`│${text}${' '.repeat(Math.max(0, width - strip(text).length))}│`);
    }
    console.log(`└${'─'.repeat(width)}┘`);
    if (mediaMissing) console.log(c.yellow('  Images are missing: put the site media in .media/ (images/, docs/) to see them locally.'));
    console.log(c.dim('  Ctrl+C stops the site and API (containers keep running; npm run dev:down stops them).'));
    console.log('');
}

async function main() {
    const { env, firstRun } = ensureEnv();
    startContainers();
    const { seeded } = prepareData(env);
    const mediaMissing = !existsSync(resolve(root, '.media/images'));

    if ((await freePort(API_PORT)) !== API_PORT) {
        console.error(c.red(`Port ${API_PORT} is in use (another API running?). Stop it and try again.`));
        return shutdown(1);
    }
    const sitePort = await freePort(PREFERRED_SITE_PORT);
    if (sitePort !== PREFERRED_SITE_PORT) step(c.yellow(`Port ${PREFERRED_SITE_PORT} is busy; using ${sitePort}`));
    const siteUrl = `http://localhost:${sitePort}`;
    // The API must accept sign-ins from whichever port the site ended up on.
    const apiEnv = { ...env, SITE_URL: siteUrl, TRUSTED_ORIGINS: [env.TRUSTED_ORIGINS, siteUrl].filter(Boolean).join(',') };

    step('Starting API and site…');
    startProcess('api', c.magenta, ['run', 'dev', '-w', 'apps/api'], apiEnv);
    startProcess('web', c.cyan, ['run', 'dev', '-w', 'apps/web', '--', '--port', String(sitePort), '--strictPort', '--logLevel', 'warn'], env);

    const [apiUp, siteUp] = await Promise.all([waitFor(`http://localhost:${API_PORT}/api/health`), waitFor(`${siteUrl}/`)]);
    if (!apiUp || !siteUp) {
        console.error(c.red(`${!apiUp ? 'API' : 'Site'} did not start. See the log above.`));
        return shutdown(1);
    }
    banner(env, sitePort, firstRun || seeded, mediaMissing);
}

main().catch((err: unknown) => {
    console.error(c.red(err instanceof Error ? err.message : String(err)));
    shutdown(1);
});
