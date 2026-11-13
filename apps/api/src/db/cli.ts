import { closeDb, db } from './index.ts';
import { migrateToLatest } from './migrate.ts';
import { seed } from './seed.ts';

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
        default:
            throw new Error(`Unknown command "${command}". Use: migrate | seed [--force]`);
    }
}

main(process.argv[2])
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => closeDb());
