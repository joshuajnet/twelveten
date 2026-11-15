import { handle } from 'hono/aws-lambda';
import { createApp } from './app.ts';
import { appDeps } from './services.ts';

// Created once per container and reused across warm invocations.
export const handler = handle(createApp(appDeps()));
