#!/usr/bin/env bash
# Deploie l'API RISAC sur le droplet DigitalOcean. A lancer depuis Git Bash ou
# Linux, a la racine du depot. Premier deploiement et mises a jour : meme commande.
#
#   SERVER=root@<ip> infra/do/deploy.sh
#
# Variables facultatives :
#   SSH_KEY     cle privee (defaut : ~/.ssh/risac_do)
#   API_DOMAIN  domaine de l'API, ex. api.exemple.org (defaut : conserve la valeur
#               du .env du serveur, ou ":80" au premier passage = HTTP sur l'IP)
#   WEB_URL     adresse du site web, ex. https://app.exemple.org : renseigne
#               APP_WEB_URL et CORS_ORIGINS
#
# Un .env existant sur le serveur n'est jamais regenere : les secrets sont crees
# une seule fois.
set -euo pipefail

: "${SERVER:?Renseigner SERVER=root@<ip du droplet>}"
KEY="${SSH_KEY:-$HOME/.ssh/risac_do}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
ssh_run() { ssh "${SSH_OPTS[@]}" "$SERVER" "$@"; }

echo "==> Connexion a $SERVER"
ssh_run 'echo connecte : $(hostname)'

echo "==> Preparation du serveur (premiere fois seulement)"
if ! ssh_run 'command -v docker >/dev/null && test -d /opt/risac/src'; then
  ssh_run 'bash -s' < "$HERE/bootstrap.sh"
fi

echo "==> Envoi du code de l'API"
tar -C "$ROOT" \
  --exclude='backend/node_modules' --exclude='backend/dist' \
  --exclude='backend/uploads' --exclude='backend/backups' \
  --exclude='backend/.env' --exclude='backend/.env.*' \
  --exclude='backend/firebase-service-account*.json' \
  -czf - backend \
  | ssh_run 'rm -rf /opt/risac/src/backend && tar -xzf - -C /opt/risac/src'

echo "==> Envoi de la configuration"
tar -C "$HERE" -czf - docker-compose.prod.yml Caddyfile .env.production.example backup.sh \
  | ssh_run 'tar -xzf - -C /opt/risac && mv /opt/risac/docker-compose.prod.yml /opt/risac/docker-compose.yml && chmod +x /opt/risac/backup.sh'

echo "==> Configuration et demarrage"
ssh_run "API_DOMAIN='${API_DOMAIN:-}' WEB_URL='${WEB_URL:-}' bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/risac

if [ ! -f .env ]; then
  sed -e "s/__POSTGRES_PASSWORD__/$(openssl rand -hex 24)/" \
      -e "s/__JWT_SECRET__/$(openssl rand -hex 48)/" \
      -e "s/__ADMIN_SETUP_KEY__/$(openssl rand -hex 16)/" \
      .env.production.example > .env
  chmod 600 .env
  echo "   .env cree avec des secrets aleatoires"
fi

set_kv() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
[ -n "$API_DOMAIN" ] && set_kv API_DOMAIN "$API_DOMAIN"
if [ -n "$WEB_URL" ]; then
  set_kv APP_WEB_URL "$WEB_URL"
  set_kv CORS_ORIGINS "$WEB_URL"
fi

cat > /etc/cron.d/risac-backup <<'CRON'
30 2 * * * root /opt/risac/backup.sh >> /var/log/risac-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/risac-backup

docker compose up -d --build --remove-orphans

echo "   attente de l'API..."
for i in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Health.Status}}' risac-api 2>/dev/null || echo absent)"
  [ "$state" = "healthy" ] && { echo "   API en bonne sante"; exit 0; }
  sleep 5
done
echo "L'API n'est pas devenue saine apres 5 minutes. Journaux :" >&2
docker compose logs --tail=60 api >&2
exit 1
REMOTE

echo "==> Termine."
echo "Test : curl http://${SERVER#*@}/api/health   (ou https://<API_DOMAIN>/api/health)"
