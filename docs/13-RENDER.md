# Render (Nest API)

Host `@aesthetic/api` on Render and keep the web app on Vercel. Postgres/Auth/Storage stay on Supabase.

This uses Render's **free web service** tier, so the API will **spin down when idle** and the first request after inactivity will be slow. That is acceptable for staging or very early pilots, but it is not ideal for front-desk caja flows.

## 1. Create the Render service

1. Push this repo to GitHub.
2. In [Render](https://render.com/), create a new **Web Service** from the repo.
3. Render will detect `render.yaml` and create:
   - `aesthetic-api` as a Docker web service

The service uses the repo-root `Dockerfile`.

## 2. Set environment variables

In Render, fill the env vars marked `sync: false` in `render.yaml`:

| Key | Value |
|-----|-------|
| `WEB_ORIGIN` | Your Vercel URL, e.g. `https://aesthetic-xxx.vercel.app` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `DATABASE_URL` | Supabase **session pooler** URI on port `5432` |

The built-in defaults are:

| Key | Default |
|-----|---------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `PG_POOL_MAX` | `5` |
| `SUPABASE_MEDIA_BUCKET` | `patient-media` |
| `ALLOW_TENANT_BOOTSTRAP` | `true` |

Notes:

- Use the **session pooler** connection string from Supabase, not the direct DB host.
- Keep `PG_POOL_MAX` small on Render free, because the service can cold-start and reconnect often.
- After the first clinic is onboarded, set `ALLOW_TENANT_BOOTSTRAP=false` unless you want self-serve tenant creation.

## 3. Deploy and verify

Once the env vars are saved, Render will build and deploy automatically.

Check:

```powershell
curl https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

Expect:

```json
{"ok":true}
```

## 4. Point the web app at Render

On Vercel:

```env
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Redeploy the web app after changing `NEXT_PUBLIC_API_URL`.

## 5. Supabase settings

In Supabase → Authentication → URL configuration:

- Set the Vercel app URL as **Site URL**
- Add the same Vercel origin to the redirect allow list

In Supabase → Storage:

- Create the private bucket `patient-media` unless you already did

## 6. Practical warning on Render free

For this project, the main trade-off is the sleep/cold-start behavior:

- Good enough for internal testing and early clinic pilots
- Not ideal for receptionists posting sales after idle time
- Background polling/keep-warm hacks are unreliable and usually against the spirit of the free tier

If testers complain that the first request in the morning feels broken, move the API to a cheap always-on host.
