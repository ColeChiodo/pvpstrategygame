# K8s only for game servers
# Frontend/backend/database run via docker compose

# 1. Apply namespace + RBAC
kubectl apply -f namespace.yaml

# 2. Your cloudflared should point to K3s node IP:30080
# Edit cloudflared-game-servers.yml with your tunnel ID and K3s host IP

# Game server URL: wss://fortezza.colechiodo.cc/game-{gameId}
# Cloudflare Tunnel forwards to K3s node:30080
# K3s Service routes to game server pod
