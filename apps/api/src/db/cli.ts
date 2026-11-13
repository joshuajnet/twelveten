import { closeDb, db } from './index.ts';
import { migrateToLatest } from './migrate.ts';

async function main(command: string | undefined): Promise<void> {
    switch (command) {
        case 'migrate': {
            const { results } = await migrateToLatest(db());
            if (!results?.length) console.log('Database is up to date.');
            for (const r of results ?? []) console.log(`${r.status}: ${r.migrationName}`);
            return;
        }
        default:
            throw new Error(`Unknown command "${command}". Use: migrate`);
    }
}

main(process.argv[2])
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => closeDb());
