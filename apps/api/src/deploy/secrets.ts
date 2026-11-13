/**
 * Creates this stage's SSM SecureString parameters if they don't exist yet (never overwrites):
 *   /twelveten/<stage>/db-password          RDS master password (URL-safe)
 *   /twelveten/<stage>/better-auth-secret   signs session cookies
 *   /twelveten/<stage>/origin-verify-secret CloudFront → Lambda shared header
 *
 *   npm run secrets:init -w apps/api -- --stage dev [--region us-east-2]
 */
import { randomBytes } from 'node:crypto';
import { GetParameterCommand, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
};

const stage = arg('stage');
if (!stage || !/^[a-z0-9-]+$/.test(stage)) throw new Error('Usage: secrets:init --stage <stage>');
const ssm = new SSMClient({ region: arg('region', process.env.AWS_REGION ?? 'us-east-2') });

const PARAMS: Record<string, () => string> = {
    'db-password': () => randomBytes(24).toString('base64url'),
    'better-auth-secret': () => randomBytes(32).toString('base64url'),
    'origin-verify-secret': () => randomBytes(32).toString('base64url'),
};

for (const [name, generate] of Object.entries(PARAMS)) {
    const Name = `/twelveten/${stage}/${name}`;
    try {
        await ssm.send(new GetParameterCommand({ Name }));
        console.log(`exists   ${Name}`);
    } catch (err) {
        if ((err as { name?: string }).name !== 'ParameterNotFound') throw err;
        await ssm.send(new PutParameterCommand({ Name, Type: 'SecureString', Value: generate(), Description: 'Twelve Ten (managed by secrets:init)' }));
        console.log(`created  ${Name}`);
    }
}
