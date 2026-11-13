// Integration tests use their own database so they never touch local dev data.
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgres://twelveten:twelveten@localhost:5432/twelveten_test';
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.SITE_URL ??= 'http://localhost:5173';
