#!/usr/bin/env bash
# Prepare un droplet Ubuntu 24.04 vierge pour RISAC. Idempotent : peut etre
# relance sans danger. S'execute SUR LE SERVEUR, en root (deploy.sh s'en charge).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> Mises a jour systeme"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Swap de 2 Go (la compilation de l'image consomme beaucoup de memoire)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -w vm.swappiness=10 >/dev/null
echo 'vm.swappiness=10' > /etc/sysctl.d/99-risac.conf

echo "==> Pare-feu : SSH, HTTP, HTTPS uniquement"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> SSH : connexion par cle uniquement"
# La connexion courante utilise deja la cle : pas de risque de se bloquer.
cat > /etc/ssh/sshd_config.d/99-risac.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh || systemctl reload sshd

echo "==> fail2ban et mises a jour de securite automatiques"
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Dossiers de l'application"
mkdir -p /opt/risac/src /opt/risac/backups
chmod 700 /opt/risac/backups

echo "Serveur pret."
