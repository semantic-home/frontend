# Semantic Home Frontend

React and TypeScript frontend for the Semantic Home UI. The app renders zone-based controller views, controller actions, and a rules editor for watering controllers.

## Responsibilities

- render domain and zone navigation
- display controller pads and runtime status
- edit watering rules through backend-backed forms
- show rule explainability data such as `Reason`, `Next`, and live preview
- proxy browser API traffic through `/api` in development and production

## Stack

- React 19
- TypeScript
- Vite
- ESLint
- Nginx for production static hosting

## Project Layout

- `src/api/`: API clients and transport helpers
- `src/header/`: top navigation
- `src/main/`: app shell, zones, pads, and right panel
- `src/styles/`: shared style modules
- `public/`: static assets
- `deploy/nginx/`: production reverse-proxy configuration

## Local Development

### Prerequisites

- Node.js 22
- npm
- backend running locally

### Setup

```bash
cp .env.example .env.local
npm ci
```

### Run

```bash
npm run dev
```

The Vite dev server proxies `/api/*` to the backend target from `VITE_DEV_API_PROXY_TARGET`.

Default local target:

```env
VITE_DEV_API_PROXY_TARGET=http://localhost:8000/api/v1
```

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run lint`: run ESLint
- `npm run build`: run TypeScript build and create the production bundle
- `npm run preview`: serve the production bundle locally

## API Model

The frontend uses relative API paths under `/api`, for example:

- `/api/domains/watering/zones/{zone}/controllers`
- `/api/domains/watering/controllers/{controllerId}/rule`

That keeps the browser-side base URL stable and lets the runtime environment decide where the backend lives.

## Build Output

`npm run build` produces a static app in `dist/`. In production this app is intended to be served by Nginx, not by the Vite dev server.

## CI

The GitLab pipeline currently runs:

- `npm run lint`
- `npm run build`

## Operations

- the production image serves static files with Nginx on port `8080`
- `/api/*` is proxied by Nginx to the backend service
- the included Nginx config assumes the backend service is reachable as `http://backend:8000`

Public operational notes live in `operations/README.md`
