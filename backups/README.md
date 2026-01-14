# Backups Directory

This directory contains automated database backups.

Each backup is stored in a timestamped folder (e.g., `2026-01-14_20-30/`) containing:
- One JSON file per table
- `_summary.json` with backup metadata

**Retention Policy:** Last 4 backups are kept (configurable in `scripts/backup-database.js`)

**Manual Backup:** Run `npm run backup`

**Automated Backup:** GitHub Actions runs every Sunday at 4:00 AM (Italian time)
