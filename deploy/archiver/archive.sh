#!/bin/sh
# Pushes database history to Cloudflare R2 so the VM only has to keep the
# retention window (ticks/candles: Timescale policies, fills/orders:
# HISTORY_RETENTION_DAYS). Everything is streamed; nothing is written locally.
#
# Every ARCHIVE_INTERVAL_SECONDS:
#   1. For each finished UTC day in the last ARCHIVE_BACKFILL_DAYS that is not
#      in R2 yet, upload one gzipped CSV per table:
#        archive/<table>/<YYYY-MM-DD>.csv.gz
#   2. Upload orders from the last day before the fill/order retention job
#      deletes them, with their final status:
#        archive/order-final/<YYYY-MM-DD>.csv.gz
#   3. Once per UTC day, upload a full pg_dump to backups/pg/ and delete dumps
#      older than BACKUP_KEEP_DAYS.
#   4. Log a warning when the disk is above DISK_WARN_PERCENT.
set -eu
set -o pipefail

: "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${PGDATABASE:?}"
: "${R2_BUCKET:?}"
ARCHIVE_INTERVAL_SECONDS="${ARCHIVE_INTERVAL_SECONDS:-3600}"
ARCHIVE_BACKFILL_DAYS="${ARCHIVE_BACKFILL_DAYS:-25}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
HISTORY_RETENTION_DAYS="${HISTORY_RETENTION_DAYS:-90}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-80}"

REMOTE="r2:${R2_BUCKET}"

# table|time column. "order" is quoted because it is a reserved word.
TABLES='ticks|time
candles_1m|openTime
candles_5m|openTime
candles_15m|openTime
candles_1h|openTime
fill|transactionTime
order|transactionTime'

log() { echo "[archiver] $(date -u +%FT%TZ) $*"; }

# Days are counted from one hour ago, so a day is archived only after the
# db-consumer has had time to flush its last batch.
day_ago() { date -u -d "@$(( $(date -u +%s) - 3600 - $1 * 86400 ))" +%F; }

exists() { [ -n "$(rclone lsf "$REMOTE/$1" 2>/dev/null)" ]; }

# Stream a query's CSV to R2 under a temporary name, then rename it, so a
# failed upload never leaves an object that looks complete.
upload_query() {
  key="$1"; sql="$2"
  if psql -X -q -v ON_ERROR_STOP=1 -c "\\copy ($sql) TO STDOUT WITH CSV HEADER" \
      | gzip -6 | rclone rcat "$REMOTE/$key.partial"; then
    rclone moveto "$REMOTE/$key.partial" "$REMOTE/$key"
    log "uploaded $key"
  else
    rclone deletefile "$REMOTE/$key.partial" 2>/dev/null || true
    log "ERROR uploading $key"
    return 1
  fi
}

archive_days() {
  n=1
  while [ "$n" -le "$ARCHIVE_BACKFILL_DAYS" ]; do
    day="$(day_ago "$n")"
    next="$(day_ago $((n - 1)))"
    echo "$TABLES" | while IFS='|' read -r table column; do
      key="archive/$table/$day.csv.gz"
      exists "$key" && continue
      upload_query "$key" "SELECT * FROM \"$table\" WHERE \"$column\" >= '$day' AND \"$column\" < '$next' ORDER BY \"$column\"" || true
    done
    n=$((n + 1))
  done
}

archive_final_orders() {
  # The retention job deletes fills/orders older than HISTORY_RETENTION_DAYS,
  # so this is the last full day that is still guaranteed to be present.
  day="$(day_ago $((HISTORY_RETENTION_DAYS - 1)))"
  next="$(day_ago $((HISTORY_RETENTION_DAYS - 2)))"
  key="archive/order-final/$day.csv.gz"
  exists "$key" && return 0
  upload_query "$key" "SELECT * FROM \"order\" WHERE \"transactionTime\" >= '$day' AND \"transactionTime\" < '$next' ORDER BY \"transactionTime\"" || true
}

backup_database() {
  today="$(date -u +%F)"
  key="backups/pg/$today.dump"
  exists "$key" && return 0
  if pg_dump -Fc --no-owner --no-privileges | rclone rcat "$REMOTE/$key.partial"; then
    rclone moveto "$REMOTE/$key.partial" "$REMOTE/$key"
    log "uploaded $key"
    rclone delete --min-age "${BACKUP_KEEP_DAYS}d" --include '*.dump' "$REMOTE/backups/pg" || true
  else
    rclone deletefile "$REMOTE/$key.partial" 2>/dev/null || true
    log "ERROR uploading $key"
  fi
}

check_disk() {
  used="$(df -P / | awk 'NR == 2 { sub("%", "", $5); print $5 }')"
  if [ "$used" -ge "$DISK_WARN_PERCENT" ]; then
    log "WARNING disk is ${used}% full (threshold ${DISK_WARN_PERCENT}%)"
  fi
}

until pg_isready -q; do sleep 2; done
log "started: bucket=$R2_BUCKET backfill=${ARCHIVE_BACKFILL_DAYS}d backups=${BACKUP_KEEP_DAYS}d"

while true; do
  check_disk
  archive_days || log "ERROR archive pass failed"
  archive_final_orders || log "ERROR final-orders pass failed"
  backup_database || log "ERROR backup failed"
  sleep "$ARCHIVE_INTERVAL_SECONDS"
done
