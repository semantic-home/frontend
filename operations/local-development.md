# Frontend Local Development

## Prerequisites

- Node.js 22
- npm
- backend running locally

## Setup

```bash
cp .env.example .env.local
npm ci
```

## Run

```bash
npm run dev
```

The Vite dev server proxies `/api/*` to the backend target from `VITE_DEV_API_PROXY_TARGET`.

Default local target:

```env
VITE_DEV_API_PROXY_TARGET=http://localhost:8000/api/v1
```

## Common Checks

- open the Vite URL shown in the terminal, usually `http://localhost:5173`
- verify the frontend can load zones and controller pads
- verify `/api/*` requests are reaching the backend through the proxy

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run preview`
