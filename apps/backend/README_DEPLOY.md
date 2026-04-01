# EduPredict Backend Deployment (Vercel)

This backend is **FastAPI + ML (scikit-learn / LightGBM / SHAP)** and can be deployed on Vercel as a Python serverless function.

## 1) Create Backend Project on Vercel

1. Import your GitHub repo in Vercel.
2. Set **Root Directory** to `apps/backend`.
3. Deploy as a separate project from the frontend.

This folder includes Vercel backend entry/config:
- `api/index.py`
- `vercel.json`
- `requirements.txt`

## 3) Required environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL` — use a **managed Postgres** connection string (Supabase or Neon)
  - Example (shape): `postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME`
- `JWT_SECRET` — a long random string
- `JWT_ISSUER` — e.g. `edupredict`
- `JWT_AUDIENCE` — e.g. `edupredict-web`
- `CORS_ALLOW_ORIGINS` — comma-separated list of allowed frontend origins
  - Include your Vercel URL(s), for example:
    - `https://edupredict.vercel.app`
- `ALLOWED_HOSTS` — comma-separated backend hostnames for host-header validation
  - Example: `edupredict-backend.vercel.app`
- `APP_ENV` — set to `production` in deployed environments
- `APP_DEBUG` — keep `false` in production

Optional:
- `MODEL_REGISTRY_PATH` — where model artifacts are stored.
  - Note: Vercel serverless file system is ephemeral; artifacts written at runtime are not persistent.
  - Keep model artifacts in repo, object storage, or an external registry.

## 2) Database migrations

This project uses Alembic. After you create the Postgres database and set `DATABASE_URL`, run migrations.

You can run migrations locally pointing to the production DB URL, or add a one-time release step in your deployment workflow.

## 3) Health check

Once deployed:
- `GET /health` should return OK.
- `GET /health/ready` should return ready and confirm DB connectivity.
- `GET /docs` should show the OpenAPI docs.

## Notes

- This deployment keeps the existing Python ML pipeline intact.
- For heavy ML workloads, monitor memory/timeouts and consider a dedicated backend host if needed.
