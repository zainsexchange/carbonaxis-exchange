# carbonaxis-exchange

## Cursor Cloud specific instructions

CarbonAxis Exchange is a carbon-credit marketplace made of two pieces that live together in the repo root:

- **Backend API** — Node/Express (ES modules) in `server.js`, listens on port `5000`. Start with `npm start` (the only npm script). There is **no build, lint, or test tooling** in this repo (no ESLint/Prettier, no test framework, no bundler), so `npm install` + `npm start` is the whole backend workflow.
- **Static frontend** — plain HTML/CSS/JS pages at the repo root (`index.html`, `marketplace.html`, `login.html`, `register.html`, `dashboard.html`, `admin.html`, etc.). There is **no build step**; serve the repo root with any static server, e.g. `python3 -m http.server 8080`. `server.js` does not serve these pages (its `/` route only returns a plain "backend is running" string).

### Non-obvious caveats

- **MongoDB**: the backend connects to a MongoDB Atlas cluster via `MONGO_URI` in `.env` (`.env` is gitignored but present in the workspace). There is no local database; testing writes to that remote cluster, so use clearly-labeled throwaway data and clean up after yourself (there is a `DELETE /api/projects/:id` but no user-delete endpoint).
- **Frontend talks to production, not localhost**: the API base URL is hardcoded to `https://carbonaxis-exchange.onrender.com` in `js/api.js` and directly inside `marketplace.html`, `projects.html`, and `admin.html`. So logging in / submitting through the locally-served UI hits the deployed backend, not your local `:5000`. To exercise the *local* backend through the UI you must repoint those URLs to `http://localhost:5000` (backend CORS is wide open). For local backend verification without editing code, hit the `/api/*` endpoints directly (e.g. `curl`).
- **Admin endpoints**: routes guarded by `requireAdmin` check the `x-admin-key` header against `process.env.ADMIN_SECRET`, but `ADMIN_SECRET` is **not** set in `.env`. Admin routes reject every request until you add it.
- **Email**: `POST /api/broker-inquiry` sends mail via Nodemailer (Hostinger SMTP from `.env`). Email failures are caught and do not block the request, so email is optional for local work.
