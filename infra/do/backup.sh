#!/usr/bin/env bash
# Sauvegarde quotidienne de la base RISAC : /opt/risac/backups/risac-AAAA-MM-JJ.sql.gz
# Lance par cron (installe par deploy.sh) et utilisable a la main.
#
# La sauvegarde interne de l'API a besoin de pg_dump dans son conteneur, absent de
# l'image : on dumpe donc depuis le conteneur Postgres, ou l'outil est present.
#
# ATTENTION : ces copies restent sur le meme disque que la base. Elles protegent
# d'une erreur de manipulation, pas de la perte du droplet : activer les
# sauvegardes DigitalOcean ou copier ce dossier ailleurs.
set -euo pipefail

DIR=/opt/risac
OUT="$DIR/backups/risac-$(date +%F).sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

umask 077
cd "$DIR"
docker compose exec -T postgres pg_dump -U risac risac | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
find "$DIR/backups" -name 'risac-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Sauvegarde ecrite : $OUT ($(du -h "$OUT" | cut -f1))"
