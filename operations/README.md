# Frontend Operations

Public operations notes for this service. These documents describe how the frontend is run, packaged, and checked from the perspective of another engineer opening the repository.

## Runtime Model

- development uses the Vite dev server
- production uses a static build served by Nginx
- browser API requests are sent to `/api`
- Nginx proxies `/api/*` to the backend service

## Documents

- [Local Development](./local-development.md)
- [Deployment](./deployment.md)
- [Release Checklist](./release-checklist.md)

## Constraints

- Vite is a development server, not the intended production runtime
- the production image assumes an internal backend hostname of `backend`
- same-origin frontend-to-backend routing is expected through the reverse proxy layer
