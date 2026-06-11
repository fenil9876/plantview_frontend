# PlantView — Frontend (React + Vite)

React + TypeScript SPA for the PlantView ops platform.

## Stack
- Vite 5 + React 18 + TypeScript
- React Router 6 (routing + protected routes)
- TanStack Query 5 (server state)
- axios (API client with bearer-token interceptor)
- Tailwind CSS 3 (styling)

## Setup
```powershell
cd plantview_frontend
npm install
```
Copy `.env.example` → `.env` and set the API base URL (defaults to the local backend):
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Run (needs the backend running too)
1. **Backend** — in `plantview_backend`: `uvicorn app.main:app --reload` (serves :8000).
   The backend's CORS already allows `http://localhost:5173`.
2. **Frontend** — here: `npm run dev` → http://localhost:5173

Sign in with the seeded admin (`admin@rajkumarhosiery.com`).

## Scripts
- `npm run dev` — dev server with HMR
- `npm run build` — typecheck (`tsc --noEmit`) + production bundle
- `npm run preview` — serve the production build locally

## Structure
```
src/
├── main.tsx                # providers (QueryClient) + mount
├── App.tsx                 # router + route guards
├── lib/
│   ├── api.ts              # axios instance + token/401 interceptors
│   ├── token.ts            # token storage
│   ├── queryClient.ts      # TanStack Query config
│   └── types.ts            # shared API types
├── auth/AuthContext.tsx    # login/logout/me, roles
├── routes/ProtectedRoute.tsx
├── components/             # Layout shell, Spinner
└── pages/                  # Login, Dashboard, placeholders
```

## Auth flow
`POST /auth/login` (form-encoded) → JWT stored in `localStorage` → `GET /auth/me`
loads the user into `AuthContext`. `ProtectedRoute` redirects unauthenticated users to
`/login` and can gate routes by role (e.g. Templates/Machines are admin-only).
A 401 during normal app use clears the token and bounces to `/login`.
