#!/bin/sh
set -e

BACKUP_DIR="/backups"
DB_FILE=$1
FLOWS_FILE=$2

if [ -z "$DB_FILE" ] || [ -z "$FLOWS_FILE" ]; then
    echo "Usage: $0 <db_backup_file.sql> <nodered_backup_file.tar.gz>"
    echo "Available backups in ${BACKUP_DIR}:"
    ls -l ${BACKUP_DIR}
    exit 1
fi

echo "Restoring database from $DB_FILE..."
psql -U "${POSTGRES_USER}" -h "${PGHOST}" "${POSTGRES_DB}" < "$DB_FILE"

echo "Restoring Node-RED flows from $FLOWS_FILE..."
tar -xzf "$FLOWS_FILE" -C /

echo "Restore completed."
