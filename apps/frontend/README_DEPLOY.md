# EduPredict Frontend Deployment

This frontend is a **Next.js** app.

## Recommended: Vercel (best fit for recruiters)

1. Create a new Vercel project from your GitHub repo.
2. Set **Root Directory** to `apps/frontend`.
3. Keep defaults:
  - Build command: `npm run build`
  - Install command: `npm install`
4. Set environment variable:
  - `NEXT_PUBLIC_API_BASE_URL` = your deployed backend URL
5. Redeploy after each backend URL/domain change.

Notes:
- On Vercel, this app runs with full Next.js runtime (SSR and optimized image pipeline enabled).
- Production security headers are configured in `next.config.ts`.

## Environment variables

Set this in Vercel → Project Settings → Environment Variables:

- `NEXT_PUBLIC_API_BASE_URL` = your deployed backend URL
  - Example: `https://your-backend-domain.com`

## Notes

- The frontend calls the backend at runtime using `NEXT_PUBLIC_API_BASE_URL`.
- After you deploy the backend, update this variable and redeploy the Vercel project.
