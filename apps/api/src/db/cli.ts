import { closeDb, db } from './index.ts';
import { migrateToLatest } from './migrate.ts';
import { seed } from './seed.ts';
import { randomBytes } from 'node:crypto';
import { upsertAdmin } from '../auth/users.ts';

async function main(command: string | undefined): Promise<void> {
    switch (command) {
        case 'migrate': {
            const { results } = await migrateToLatest(db());
            if (!results?.length) console.log('Database is up to date.');
            for (const r of results ?? []) console.log(`${r.status}: ${r.migrationName}`);
            return;
        }
        case 'seed': {
            const force = process.argv.includes('--force');
            const r = await seed(db(), { force });
            console.log(
                r.skipped
                    ? 'Seed already applied (use --force to overwrite).'
                    : `Seeded ${r.exhibitions} exhibitions/fairs, ${r.artworks} slides, ${r.events} events, ${r.press} press items, ${r.news} news posts.`,
            );
            return;
        }
        case 'admin:create': {
            const arg = (name: string) => {
                const i = process.argv.indexOf(`--${name}`);
                return i > -1 ? process.argv[i + 1] : undefined;
            };
            const email = arg('email') ?? process.env.ADMIN_EMAIL;
            if (!email) throw new Error('Usage: admin:create --email you@example.com [--password …] [--name …]');
            const password = arg('password') ?? process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
            const { created } = await upsertAdmin(db(), { email, password, name: arg('name') });
            console.log(`${created ? 'Created' : 'Updated'} admin ${email}`);
            if (!arg('password') && !process.env.ADMIN_PASSWORD) console.log(`Password: ${password}`);
            return;
        }
        default:
            throw new Error(`Unknown command "${command}". Use: migrate | seed [--force] | admin:create --email …`);
    }
}

main(process.argv[2])
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => closeDb());
