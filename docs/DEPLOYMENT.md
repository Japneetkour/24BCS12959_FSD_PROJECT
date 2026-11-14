# Deployment Guide

The recommended setup is **one Node service** that serves the API, Socket.io and the built React app, plus **MongoDB Atlas**. Because the browser and the API share one origin, the auth cookie can stay `SameSite=Lax` and WebSockets need no extra CORS setup.

## 1. Create the database (MongoDB Atlas, free tier)

1. Create a free M0 cluster at <https://www.mongodb.com/atlas>.
2. Under **Database Access**, add a database user with a strong password.
3. Under **Network Access**, allow your host's outbound IPs. For a quick demo you can use `0.0.0.0/0`.
4. Copy the connection string, for example `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/campusconnect?retryWrites=true&w=majority`.

## 2. Deploy on Render (single service)

The repository includes `render.yaml`.

1. Push the project to GitHub.
2. In Render, go to **New → Blueprint** and select the repository. Render reads `render.yaml`.
3. Fill in the secret variables when prompted:
   - `MONGO_URI`: your Atlas string
   - `CLIENT_URL`: the public URL Render gives you, e.g. `https://campusconnect.onrender.com`
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: for real verification and reset emails. Brevo, Mailgun, SendGrid, or a Gmail app password all work.
4. Deploy. The build runs `npm run build`, which builds the client and installs production server dependencies. The service starts with `npm start`. `JWT_SECRET` is generated automatically.
5. Optional: load the demo data once from your machine by pointing your local `server/.env` at Atlas:
   ```bash
   MONGO_URI="<atlas uri>" npm run seed --prefix server
   ```

**Manual setup without the blueprint:** Build command `npm run build`, Start command `npm start`, and these environment variables: `NODE_ENV=production`, `SERVE_CLIENT=true`, `MONGO_URI`, `JWT_SECRET` (48+ random bytes), `CLIENT_URL`, `ALLOWED_EMAIL_DOMAINS`, plus the SMTP settings.

> **Uploads on free hosts:** Render's free tier has an *ephemeral* disk, so uploaded files disappear on redeploy or restart. For persistence, attach a Render Disk mounted at `/opt/render/project/src/server/uploads` (paid), or move storage to S3 or Cloudinary by swapping the Multer storage engine in `middleware/upload.js`. Nothing else in the code needs to change.

## 3. Alternative: split deployment (Vercel + Render/Railway)

Use this if you want the React app on Vercel or Netlify and the API elsewhere.

**API service:** `NODE_ENV=production`, `SERVE_CLIENT=false`, `COOKIE_SAMESITE=none` (the browser treats this as a cross-site cookie, so HTTPS is required), `CLIENT_URL=https://your-app.vercel.app`, `CORS_ORIGINS=https://your-app.vercel.app`.

**Client (Vercel):** Root directory `client`, build `npm run build`, output `dist`, environment variable `VITE_API_URL=https://your-api.onrender.com`. Add a SPA rewrite so client routes work: create `client/vercel.json` containing `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.

> Some browsers block third-party cookies. If you see login loops, use the single-service deployment, or put the client and API on subdomains of the same site (e.g. `app.example.com` and `api.example.com`) with `COOKIE_SAMESITE=lax`.

## 4. Production checklist

- [ ] `NODE_ENV=production`. The server refuses to start with a weak or missing `JWT_SECRET` or without a real `MONGO_URI`.
- [ ] HTTPS enabled (automatic on Render, Vercel and Railway). Cookies are `Secure` in production.
- [ ] `ALLOWED_EMAIL_DOMAINS` set to your university's domain.
- [ ] SMTP configured. Without it, users can't verify their email in production.
- [ ] Atlas network access restricted, and backups enabled.
- [ ] Health check: `GET /api/health`.
- [ ] To create the first admin, either run the seed script, or register normally and promote the account in Atlas: `db.users.updateOne({email:"you@uni.edu"},{$set:{role:"admin",isVerified:true}})`.
