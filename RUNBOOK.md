# Muraai — Database Backup & Restore Runbook

> **Reading this during an incident?**
> Jump straight to [§ Restore Procedure](#restore-procedure).

---

## 1. Platform — Railway Postgres

**You are on Railway.**
The backend (`railway.toml`, `Dockerfile`) is deployed on Railway and connects to a Railway-managed Postgres instance via `DATABASE_URL`.

### What Railway provides natively

| Feature | Status |
|---|---|
| **Point-in-time recovery (PITR)** | Available on **Pro plan and above**. Snapshots taken automatically; retention window is 7 days. Restore via the Railway dashboard under the database service — *Backups* tab. |
| **Daily snapshots** | Auto-enabled for managed Postgres services (Hobby and above). |
| **Manual snapshot** | Trigger any time from the dashboard: database service — *Backups* — *Create backup*. |
| **Self-managed replica** | Not provided. |

> **Action required:** Open the Railway dashboard, select your Postgres service, and click the **Backups** tab to confirm snapshots are listed. If the tab is empty or missing, your plan may not include them — check your plan tier at railway.com > Settings > Billing.

**Railway backups are a safety net, not a full strategy.**
They cannot be downloaded as raw SQL, they tie you to Railway, and there is no offsite copy. The custom `pg_dump` job below is your independent, portable backup.

---

## 2. Custom pg_dump Backup (Daily, S3 / Backblaze B2)

### What it does

`MURAAI/backend/scripts/backup.py` runs independently of the Flask app:

1. Calls `pg_dump --format=custom` against `DATABASE_URL`
2. Gzips the dump
3. Uploads to `s3://<BACKUP_S3_BUCKET>/postgres/muraai-<timestamp>.dump.gz`
4. Prunes dumps older than `BACKUP_RETENTION_DAYS` (default **7 days**)

### Prerequisites

#### A. Add boto3 to requirements.txt

```
boto3>=1.34
```

#### B. Add postgresql-client to the Dockerfile

The backup service needs `pg_dump`. In `MURAAI/backend/Dockerfile` change the apt install line to:

```dockerfile
RUN apt-get update && apt-get install -y gcc postgresql-client \
    && rm -rf /var/lib/apt/lists/*
```

#### C. Create a storage bucket

**AWS S3:**
1. Create a bucket, e.g. `muraai-backups`, in region `ap-south-1`
2. Create an IAM user with a policy allowing `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on that bucket only
3. Generate Access Key ID + Secret

**Backblaze B2** (cheaper, S3-compatible):
1. Create a Private bucket `muraai-backups`
2. Create an Application Key scoped to that bucket
3. Note the S3 endpoint URL (e.g. `https://s3.us-west-004.backblazeb2.com`)

### Deploy as a Railway cron service

Create a **second Railway service** in the same project — do NOT attach this to the web or worker process:

1. Railway dashboard > project > **New Service** > **Empty Service**
2. Connect to the same GitHub repo
3. Set **Root Directory** to `MURAAI/backend`
4. Under **Settings > Deploy**:
   - Start command: `python scripts/backup.py`
   - Cron schedule: `0 2 * * *`   *(02:00 UTC = 07:30 IST daily)*
5. Add environment variables (see §4 below)

### Running manually

```bash
cd MURAAI/backend
pip install boto3
DATABASE_URL="postgresql://..." \
BACKUP_S3_BUCKET="muraai-backups" \
BACKUP_S3_REGION="ap-south-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
python scripts/backup.py
```

---

## 3. Restore Procedure

> You are here because the database is gone or corrupt. Work through steps in order.

### 3a. Decide which backup to use

**Option A — Railway native backup** (fastest):
1. Railway dashboard > Postgres service > **Backups**
2. Find the most recent backup before the data loss event
3. Click **Restore** > confirm > wait 2-5 minutes
4. `DATABASE_URL` does NOT change; go to §3e

**Option B — Custom pg_dump backup from S3** (use when Railway backup is unavailable or you need an older point in time):

Continue to §3b.

---

### 3b. Download the backup file

List available dumps:

```bash
aws s3 ls s3://<BACKUP_S3_BUCKET>/postgres/ --region <BACKUP_S3_REGION>

# Backblaze B2:
aws s3 ls s3://<BACKUP_S3_BUCKET>/postgres/ \
  --region <BACKUP_S3_REGION> \
  --endpoint-url https://s3.us-west-004.backblazeb2.com
```

Download:

```bash
aws s3 cp \
  s3://<BACKUP_S3_BUCKET>/postgres/muraai-2026-08-07T02-00-00Z.dump.gz \
  ./restore.dump.gz \
  --region <BACKUP_S3_REGION>
```

Decompress:

```bash
gunzip restore.dump.gz
# You now have: restore.dump  (pg_restore custom format)
```

---

### 3c. Create a fresh database (if needed)

If the database itself is gone:

```sql
-- Connect to Postgres as admin
CREATE DATABASE muraai_contracts;
CREATE USER muraai WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE muraai_contracts TO muraai;
```

Update `DATABASE_URL` in Railway (all three services: web, worker, backup) to point to the new host.

---

### 3d. Restore the dump

```bash
export PGPASSWORD="your-password"

pg_restore \
  --host=<PGHOST> \
  --port=<PGPORT> \
  --username=<PGUSER> \
  --dbname=muraai_contracts \
  --no-password \
  --clean \
  --if-exists \
  --no-owner \
  --verbose \
  restore.dump
```

Errors about missing extensions are usually harmless.
Errors about missing schemas are not — recheck §3c.

Expected ending output:
```
pg_restore: finished main parallel loop
```

---

### 3e. Run Alembic migrations

```bash
cd MURAAI/backend
DATABASE_URL="postgresql://..." alembic upgrade head
```

This is a no-op if the restored dump already matches the current schema. Run it anyway.

---

### 3f. Smoke-test

```bash
# Health endpoint
curl https://<your-app-domain>/health
# Expected: {"status": "healthy", ...}

# Quick row count
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM contracts;"
```

Manual checks:
- [ ] Admin login works
- [ ] Contract list loads with real data
- [ ] Dashboard KPIs are non-zero
- [ ] No 500 errors in Railway logs

---

### 3g. Re-enable services

If `DATABASE_URL` changed:
1. Update the env var in all three Railway services: web, worker, backup cron
2. Redeploy all three

---

## 4. Environment Variable Reference

| Variable | Service(s) | Purpose |
|---|---|---|
| `DATABASE_URL` | Web, Scheduler, Backup | Postgres connection string |
| `BACKUP_S3_BUCKET` | Backup | Bucket that holds dump files |
| `BACKUP_S3_REGION` | Backup | AWS or B2 region |
| `AWS_ACCESS_KEY_ID` | Backup | S3 credential key ID |
| `AWS_SECRET_ACCESS_KEY` | Backup | S3 credential secret |
| `BACKUP_S3_ENDPOINT` | Backup | Only for non-AWS S3 (Backblaze, MinIO) |
| `BACKUP_RETENTION_DAYS` | Backup | Daily dumps to keep (default 7) |
| `BACKUP_PREFIX` | Backup | Key prefix in bucket (default `postgres`) |

---

## 5. Monthly Backup Verification Checklist

- [ ] Railway dashboard Backups tab shows a snapshot from today
- [ ] `aws s3 ls s3://<bucket>/postgres/` shows dumps from the last 7 days
- [ ] Download the latest dump and run `pg_restore --list restore.dump | head -20` — verify it is readable
- [ ] Restore to a scratch Postgres instance and confirm row counts match production

---

## 6. Key Files

| File | Purpose |
|---|---|
| `MURAAI/backend/scripts/backup.py` | Standalone backup script |
| `MURAAI/backend/railway.toml` | Web service deploy config (backup cron needs its own) |
| `MURAAI/backend/Dockerfile` | Must include `postgresql-client` |
| `MURAAI/backend/requirements.txt` | Must include `boto3>=1.34` |
