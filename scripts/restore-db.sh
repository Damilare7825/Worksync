#!/bin/sh
set -e

DUMP_FILE="$1"

if [ -z "${DUMP_FILE}" ]; then
  echo "Error: Please specify the backup file path to restore."
  echo "Usage: $0 /backups/worksync_backup_YYYY-MM-DD_HHMMSS.dump"
  exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
  echo "Error: Dump file '${DUMP_FILE}' not found."
  exit 1
fi

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-worksync}"

echo "[restore-db] Restoring database '${POSTGRES_DB}' from '${DUMP_FILE}'..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists "${DUMP_FILE}"

echo "[restore-db] Database restore completed successfully."
