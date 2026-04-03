# Docker Development Workflow

1. Copy `.env.example` to `.env` and set stronger local passwords.
2. Start the stack with `docker compose up --build`.
3. Keep it running while you edit code.

What now updates without a full image rebuild:
- `backend/src/**` changes are read directly by the backend container. Restart only the backend service with `docker compose restart backend` when you want Java changes picked up.
- `client-frontend/src/**`, `public/**`, `index.html`, `vite.config.ts`, and TypeScript config changes are mounted into the frontend container, so Vite can reload them without rebuilding the image.
- Database data stays in the `mysql_data` volume and dependency caches stay in named volumes, so container restarts stay lightweight.

When a rebuild is still expected:
- `backend/pom.xml` changes
- `client-frontend/package.json` or `client-frontend/package-lock.json` changes
- Dockerfile changes

Useful commands:
- `docker compose up --build`
- `docker compose restart backend`
- `docker compose down`
- `docker compose down -v`
