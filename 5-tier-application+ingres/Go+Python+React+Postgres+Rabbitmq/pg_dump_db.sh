#!/bin/bash

# -----------------------------
# PostgreSQL Database Backup Script
# -----------------------------


DB_NAME="todo_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
OUTPUT_DIR="$HOME/db_backups"

mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

BACKUP_FILE="$OUTPUT_DIR/${DB_NAME}_backup_$TIMESTAMP.sql"

echo "Starting backup of database '$DB_NAME'..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$BACKUP_FILE" "$DB_NAME"

if [ $? -eq 0 ]; then
    echo "Backup successful! File saved to: $BACKUP_FILE"
else
    echo "Backup failed!"
    exit 1
fi
