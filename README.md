# Stock App Server

TypeScript + Express API that powers the stock simulator used by the Angular frontend.

## Scripts
- `npm run dev` – run the API with ts-node (watch mode can be added via nodemon).
- `npm run build` – compile TypeScript to `dist/`.
- `npm start` – run the compiled server from `dist/`.

## Environment
Copy `.env.example` to `.env` and tweak values:
- `API_PORT` (default 4000)
- `CORS_ALLOW_ORIGIN` (comma-separated list, `*` to allow all)
- `MOCK_*` variables to tune the simulator sizes.

## Deployment
1. `npm install`
2. `npm run build`
3. Provide the `.env` variables in your hosting platform and start `node dist/index.js`.
