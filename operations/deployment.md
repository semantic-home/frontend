# Frontend Deployment

## Production Build

```bash
npm run build
```

This creates a static app in `dist/`.

## Container Build

Build the image from the `frontend/` directory:

```bash
docker build -t home-automation-frontend .
```

## Standalone Container Smoke Test

```bash
docker run --rm -p 8080:8080 home-automation-frontend
```

This confirms that the frontend image starts and serves the static app. It is not a complete end-to-end deployment because `/api/*` still expects a reachable backend service.

## Recommended Alpha Deployment

For the alpha environment, run frontend and backend in a shared Docker Compose stack. Compose creates a default internal network automatically, and the frontend can then reach the backend by the service name `backend`.

Example `compose.yml` at the stack root:

```yaml
services:
  backend:
    build: ./backend
    env_file:
      - ./backend/.env.alpha
    restart: unless-stopped

  frontend:
    build: ./frontend
    depends_on:
      - backend
    restart: unless-stopped
    ports:
      - "8080:8080"
```

Start the stack from that shared root:

```bash
docker compose up -d --build
```

## Reverse Proxy Model

- Nginx serves the static frontend on port `8080`
- `/api/*` is proxied to `http://backend:8000/api/v1/`
- `backend` is expected to be the Docker Compose service name
- if your backend service name differs, update `deploy/nginx/default.conf`

## Operational Notes

- Vite is only for development
- production assumes a same-origin frontend plus `/api` reverse-proxy setup
- the production container expects the backend to be reachable on the shared Compose network
- if you add another reverse proxy in front of the frontend container, preserve WebSocket upgrade headers for agent traffic under `/api/v1/ws/agent/*`
