# Deployment Cost Analysis — Education Hub

> Prices are approximate (checked early July 2026) — always confirm on the provider's current pricing page. The relative ordering between options is stable.

## App profile (what drives the cost)

- **Node/Express API + static React build** — light CPU/memory needs
- **SQLite database + files in `uploads/`** — needs a **persistent disk**; this rules out most free serverless tiers (their filesystems reset on every deploy, wiping the DB, uploaded book PDFs, logos, and documents)
- School traffic is low and bursty (weekends/evenings) — a single small server handles it easily

---

## Recommended: single VPS (~$5–8/month total)

The most cost-effective and simplest fit. SQLite and the uploads folder live on the server's disk — no re-architecture. Run the API and serve the built frontend from one box with Caddy or Nginx in front (free auto-SSL via Let's Encrypt).

### VPS provider comparison

| Provider | Plan | Specs | ~Price/mo |
|----------|------|-------|-----------|
| **Hetzner** (best value) | CX22 | 2 vCPU, 4GB RAM, 40GB SSD | **~$5.50** |
| DigitalOcean | Basic Droplet | 1 vCPU, 1GB, 25GB | $6 |
| AWS Lightsail | 2GB plan | 1 vCPU, 2GB, 60GB | $10 |
| Vultr / Linode | 1GB plans | similar | $5–6 |

### Sample breakdown — small production (1–5 schools, ~500 users)

| Item | Cost/mo |
|------|---------|
| Hetzner CX22 VPS (app + SQLite + uploads) | $5.50 |
| Automated backups (Hetzner add-on, 20%) | $1.10 |
| Domain (~$12/yr) | $1.00 |
| SSL (Let's Encrypt via Caddy) | $0 |
| **Total** | **~$7.60/mo** |

DigitalOcean equivalent: $6 droplet + $1.20 backups + $1 domain ≈ **$8.20/mo**.

---

## Alternative: PaaS, zero server management (~$9–12/month)

Render is the smoothest for this stack — git-push deploys, managed SSL, no server administration.

### Sample breakdown — Render

| Item | Cost/mo |
|------|---------|
| Render Web Service (Starter, 512MB) | $7.00 |
| Render persistent disk 4GB (SQLite + uploads) | $1.00 |
| Render Static Site (React build) | $0 |
| Domain | $1.00 |
| **Total** | **~$9/mo** |

Similar options:
- **Railway** — usage-based Hobby plan, ≈ $5/mo for this footprint
- **Fly.io** — cheapest PaaS (~$3–5/mo with a small volume) but fiddlier setup

---

## "Free" tier warning

- Render free tier / Vercel / Netlify functions have **ephemeral filesystems** — SQLite data and uploaded PDFs/logos vanish on each deploy. Not usable as-is.
- The only genuinely free option that fits without changes: **Oracle Cloud Always Free ARM VM** (4 cores / 24GB RAM — very generous), but signup/capacity availability is famously flaky. Acceptable for a pilot if you're patient.

---

## Scale-up plan (10+ schools, thousands of users): ~$30–45/month

Migrate SQLite → Postgres (with Prisma this is mostly a datasource change + re-run migrations) and move uploads to object storage.

| Item | Cost/mo |
|------|---------|
| VPS 4GB or Render Standard | $12–25 |
| Managed Postgres (DO $15; Neon/Supabase from $0–19) | $0–19 |
| Cloudflare R2 for uploads (10GB free, no egress fees) | ~$0 |
| Backups + domain | ~$3 |
| **Total** | **~$30–45/mo** |

---

## Bottom line

| Stage | Option | All-in cost |
|-------|--------|-------------|
| Pilot / testing | Oracle Always Free VM (if available) or cheapest VPS | $0–6/mo |
| **Small production (recommended start)** | **Hetzner/DO VPS, app + SQLite + uploads on one box** | **~$7–8/mo** |
| No-ops preference | Render Starter + persistent disk | ~$9/mo |
| 10+ schools | VPS/PaaS + managed Postgres + R2 object storage | ~$30–45/mo |

Start with the ~$6–8/month VPS — it matches the current SQLite + local-uploads architecture exactly, and one small server comfortably runs every seeded org (Sunrise Academy, Green Valley, and the test orgs).

### Next steps when deploying
1. Pick provider → point domain at the server
2. Dockerfile or systemd service + Caddy reverse proxy (auto-SSL)
3. Set production env vars (`DATABASE_URL`, strong `JWT_SECRET`, `NODE_ENV=production`)
4. Nightly backup script: copy `prisma/dev.db` + `uploads/` offsite
5. When outgrowing SQLite: Prisma datasource → Postgres, uploads → Cloudflare R2
