#!/bin/sh
set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_FILE="${BACKUP_DIR}/ims_db_${TIMESTAMP}.sql"
NODE_RED_BACKUP_FILE="${BACKUP_DIR}/nodered_data_${TIMESTAMP}.tar.gz"

echo "Cleaning up old backups (older than 7 days) before starting new backup..."
find "${BACKUP_DIR}" -type f -name "*.sql" -mtime +7 -exec rm {} \; || true
find "${BACKUP_DIR}" -type f -name "*.tar.gz" -mtime +7 -exec rm {} \; || true

echo "Starting backup at ${TIMESTAMP}"

pg_dump -U "${POSTGRES_USER}" -h "${PGHOST}" "${POSTGRES_DB}" > "${DB_BACKUP_FILE}"
echo "Database backup completed: ${DB_BACKUP_FILE}"

tar -czf "${NODE_RED_BACKUP_FILE}" -C / nodered_data
echo "Node-RED backup completed: ${NODE_RED_BACKUP_FILE}"
