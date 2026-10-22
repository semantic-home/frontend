# Semantic Home Frontend

React and TypeScript frontend for the Semantic Home UI. The app provides authenticated household selection and the original domain → zone → controller dashboard. Watering, humidity, lighting, power and cleaning use the same navigation and side panel. Controllers assign meaning to entities; child rules define thresholds and schedules. `/watering` remains a compatible entry point.

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

## Household workspace

The original logo and domain menu form one header at the top of every signed-in page. The account avatar opens home selection, account details, Device Inventory, Connections & Members, and sign-out. The adjacent agent indicator reuses the controller status-light styles: green when all active connections are online, amber for partial availability, grey when offline or unknown, and blue while checking. Preview-only connections are labelled explicitly. Narrow layouts keep the logo and tools on the first row and the horizontally scrolling domain menu beneath them.

The root route opens controller pads by domain and zone. Create an account and household, then pair the updated local agent under Connections. Create a controller in a zone, assign entities to its roles, and add child rules from Edit Rules. Device selection is paginated and capability-filtered; HA area matches are suggestions. The device inventory and connection settings remain supporting pages. Rules are saved as drafts; Activate deploys them locally and reports pending/error/confirmed states separately. Pause an active rule before changing its entity assignments or controlling them manually. Household selection is sent in X-Semantic-Home-Household; it is always checked against authenticated membership by the backend.

Browser sessions use an HttpOnly cookie. Production must use HTTPS with AUTH_COOKIE_SECURE=true. Development proxies both HTTP and agent WebSockets through /api to the backend /api/v1 prefix.
