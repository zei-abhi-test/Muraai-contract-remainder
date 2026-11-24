#!/usr/bin/env python3
"""
Muraai DB Backup Script
=======================
Standalone script — NOT imported by main.py or the scheduler service.

Run directly:
  python scripts/backup.py

Or deploy it as a separate Railway cron job service with:
  startCommand = "python scripts/backup.py"
  schedule = "0 2 * * *"   # 02:00 UTC daily

Required environment variables (set in Railway / .env):
  DATABASE_URL             — postgresql://user:pass@host:port/dbname
  BACKUP_S3_BUCKET         — bucket name   (e.g. muraai-backups)
  BACKUP_S3_REGION         — AWS/B2 region (e.g. ap-south-1)
  AWS_ACCESS_KEY_ID        — IAM / B2 application key ID
  AWS_SECRET_ACCESS_KEY    — IAM / B2 application key

  # Only needed when using Backblaze B2 or another S3-compatible service:
  BACKUP_S3_ENDPOINT       — e.g. https://s3.us-west-004.backblazeb2.com

Optional:
  BACKUP_RETENTION_DAYS    — daily backups to keep  (default: 7)
  BACKUP_PREFIX            — key prefix in bucket   (default: "postgres")
"""
from __future__ import annotations

import gzip
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("muraai-backup")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        log.error("Missing required env var: %s", name)
        sys.exit(1)
    return val


def _pg_env_from_url(database_url: str) -> dict[str, str]:
    """
    Decompose a postgres:// URL into the env vars that pg_dump expects.
    PGPASSWORD is set so pg_dump never prompts interactively.
    """
    p = urlparse(database_url)
    env = os.environ.copy()
    env["PGHOST"] = p.hostname or "localhost"
    env["PGPORT"] = str(p.port or 5432)
    env["PGUSER"] = p.username or "postgres"
    env["PGPASSWORD"] = p.password or ""
    env["PGDATABASE"] = (p.path or "/").lstrip("/")
    return env


# ---------------------------------------------------------------------------
# Step 1: pg_dump -> gzipped file
# ---------------------------------------------------------------------------

def dump_database(database_url: str, dest_path: str) -> None:
    """
    Run pg_dump in custom format (-Fc), then gzip the output.
    Custom format is preferred because pg_restore can do selective restores;
    gzip is applied on top purely for upload efficiency.
    """
    log.info("Starting pg_dump -> %s", dest_path)

    if not shutil.which("pg_dump"):
        log.error(
            "pg_dump not found in PATH. "
            "Add to Dockerfile:\n"
            "  RUN apt-get update && apt-get install -y postgresql-client"
        )
        sys.exit(1)

    env = _pg_env_from_url(database_url)
    raw_dump = dest_path.replace(".gz", "")

    cmd = [
        "pg_dump",
        "--format=custom",
        "--no-password",
        "--file", raw_dump,
        env["PGDATABASE"],
    ]

    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        log.error("pg_dump failed:\n%s", result.stderr)
        sys.exit(1)

    size_mb = os.path.getsize(raw_dump) / 1_048_576
    log.info("pg_dump succeeded (%.1f MB), gzipping...", size_mb)

    with open(raw_dump, "rb") as f_in, gzip.open(dest_path, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)

    os.remove(raw_dump)
    gz_mb = os.path.getsize(dest_path) / 1_048_576
    log.info("Compressed dump: %s (%.1f MB)", dest_path, gz_mb)


# ---------------------------------------------------------------------------
# Step 2: Upload to S3 / Backblaze B2
# ---------------------------------------------------------------------------

def upload_to_s3(local_path: str, bucket: str, s3_key: str,
                 region: str, endpoint: str | None) -> None:
    """
    Upload local_path to s3://bucket/s3_key.
    Works with AWS S3 and any S3-compatible endpoint (Backblaze B2, MinIO ...).
    """
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        log.error("boto3 is not installed. Add 'boto3>=1.34' to requirements.txt.")
        sys.exit(1)

    kwargs: dict = {"region_name": region}
    if endpoint:
        kwargs["endpoint_url"] = endpoint

    s3 = boto3.client("s3", **kwargs)

    log.info("Uploading s3://%s/%s ...", bucket, s3_key)
    try:
        s3.upload_file(local_path, bucket, s3_key)
        log.info("Upload complete.")
    except (BotoCoreError, ClientError) as exc:
        log.error("Upload failed: %s", exc)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Step 3: Prune old backups (7-day retention by default)
# ---------------------------------------------------------------------------

def prune_old_backups(bucket: str, prefix: str, region: str,
                      endpoint: str | None, retention_days: int) -> None:
    """
    Delete objects in s3://bucket/prefix/ whose LastModified is older than
    retention_days.  Non-fatal — log a warning if pruning fails.
    """
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        return

    kwargs: dict = {"region_name": region}
    if endpoint:
        kwargs["endpoint_url"] = endpoint

    s3 = boto3.client("s3", **kwargs)
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    try:
        paginator = s3.get_paginator("list_objects_v2")
        deleted = 0
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix + "/"):
            for obj in page.get("Contents", []):
                if obj["LastModified"] < cutoff:
                    s3.delete_object(Bucket=bucket, Key=obj["Key"])
                    log.info("Pruned: %s (age > %d days)", obj["Key"], retention_days)
                    deleted += 1
        log.info("Pruning complete — %d object(s) removed.", deleted)
    except (BotoCoreError, ClientError) as exc:
        log.warning("Pruning failed (backup is still safe): %s", exc)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    database_url   = _require_env("DATABASE_URL")
    bucket         = _require_env("BACKUP_S3_BUCKET")
    region         = _require_env("BACKUP_S3_REGION")
    _require_env("AWS_ACCESS_KEY_ID")       # consumed by boto3 automatically
    _require_env("AWS_SECRET_ACCESS_KEY")   # consumed by boto3 automatically

    endpoint       = os.getenv("BACKUP_S3_ENDPOINT")       # None -> use AWS
    prefix         = os.getenv("BACKUP_PREFIX", "postgres")
    retention_days = int(os.getenv("BACKUP_RETENTION_DAYS", "7"))

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    filename  = f"muraai-{timestamp}.dump.gz"
    s3_key    = f"{prefix}/{filename}"

    with tempfile.TemporaryDirectory() as tmpdir:
        local_path = os.path.join(tmpdir, filename)
        dump_database(database_url, local_path)
        upload_to_s3(local_path, bucket, s3_key, region, endpoint)

    prune_old_backups(bucket, prefix, region, endpoint, retention_days)
    log.info("Backup finished successfully -> s3://%s/%s", bucket, s3_key)


if __name__ == "__main__":
    main()
