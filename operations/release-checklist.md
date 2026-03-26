# Frontend Release Checklist

Use this before merging or deploying frontend changes.

## Verify the Branch

- confirm the branch is up to date with the target branch
- confirm UI changes that depend on backend APIs match current backend payloads

## Run Checks

```bash
npm run lint
npm run build
```

## Smoke Test

- open the app locally or through `npm run preview`
- verify the active domains and zones render
- verify controller pads load without broken API requests
- if the change touches watering rules, verify `Reason`, `Next`, and rule editing flows

## Confirm Runtime Assumptions

- the `/api` proxy target is correct for the environment
- the backend service name matches the Nginx proxy configuration when using the production container
