# Twelve Ten Gallery

## Quick start
Requires Node 22+ and Docker.

```sh
npm install
npm run dev
```

The first run starts Postgres and LocalStack, loads the site's content, creates a local admin and prints the site and admin login addresses. Put the site's media (`images/`, `docs/`) in `.media/` to see images locally.

- `npm test`: unit and API tests (Vitest; needs the Docker services)
- `npm run test:e2e`: build + Playwright visual and editing tests (needs `npm run dev` running)
- `npm run typecheck`

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the system is put together.
