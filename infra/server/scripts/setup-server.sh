#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server. Run as root:
#   bash setup-server.sh
# Before running: you must be able to log in as root with your SSH key (Hetzner adds it at install).
set -euo pipefail

echo "== Updating system =="
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
DEBIAN_FRONTEND=noninteractive apt-get -y install ufw fail2ban unattended-upgrades rclone ca-certificates curl openssl

echo "== Swap (safety net if memory runs short; VPS images often have none) =="
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf
  sysctl -p /etc/sysctl.d/99-swap.conf
fi

echo "== Automatic security updates =="
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Docker =="
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

echo "== Admin user 'deploy' with your SSH key =="
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo,docker deploy
  install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
  echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
fi

echo "== SSH: keys only, no root login =="
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
EOF
systemctl reload ssh

echo "== Firewall =="
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
# Garnet cache port. Note: Docker opens published ports itself, so this rule is for clarity.
ufw allow 6380/tcp
# HTTPS for the database API in direct mode (no own domain yet). Not needed with the Cloudflare Tunnel.
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== App folder =="
install -d -o deploy -g deploy /opt/store

echo
echo "Done. From now on log in as:  ssh deploy@<server-ip>"
echo "Test that login in a NEW window before closing this one."
