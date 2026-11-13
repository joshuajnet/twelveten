import { handle } from 'hono/aws-lambda';
import { createApp } from './app.ts';
import { createAuth } from './auth/auth.ts';
import { db } from './db/index.ts';

// Created once per container and reused across warm invocations.
export const handler = handle(createApp({ db, auth: createAuth({ db: db() }) }));
