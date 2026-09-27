#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-worksync}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
FILENAME="worksync_backup_${TIMESTAMP}.dump"
TARGET="${BACKUP_DIR}/${FILENAME}"

echo "[backup-db] Starting backup for database ${POSTGRES_DB} at ${TIMESTAMP}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" -f "${TARGET}"

echo "[backup-db] Backup written to ${TARGET} ($(stat -c%s "${TARGET}" 2>/dev/null || wc -c < "${TARGET}") bytes)"

# Retention: Delete backups older than retention days
echo "[backup-db] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "worksync_backup_*.dump" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;

echo "[backup-db] Backup cycle finished."
