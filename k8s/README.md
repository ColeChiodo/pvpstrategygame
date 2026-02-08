# K3s Production Deployment

## Prerequisites

1. K3s installed with Traefik
2. Docker images pushed to Docker Hub:
   - `colechiodo/fortezza-backend:latest`
   - `colechiodo/fortezza-frontend:latest`
   - `colechiodo/fortezza-game-server:latest`
3. Domain DNS pointing to Cloudflare Tunnel

## Quick Start

### 1. Create Secrets

```bash
cp secrets.example.yaml secrets.yaml
# Edit secrets.yaml with your values
kubectl apply -f secrets.yaml
```

### 2. Deploy All Resources

```bash
# Using kubectl
kubectl apply -f .

# Or using kustomize (if configured)
kubectl apply -k .
```

### 3. Start Cloudflare Tunnel

```bash
docker compose -f cloudflared-compose.yml up -d
```

## Manual Step-by-Step

### Create Namespace & RBAC
```bash
kubectl apply -f namespace.yaml
```

### Deploy Database (optional - use managed PostgreSQL)
```bash
kubectl apply -f postgres.yaml
```

### Deploy Redis (optional - use managed Redis)
```bash
kubectl apply -f redis.yaml
```

### Deploy Backend
```bash
kubectl apply -f backend.yaml
```

### Deploy Frontend
```bash
kubectl apply -f frontend.yaml
```

### Deploy Cleanup CronJob
```bash
kubectl apply -f cleanup-cronjob.yaml
```

## Resources Created

- Namespace: `game-servers`
- Deployments: `frontend`, `backend`, `postgres`, `redis`
- Services: `frontend`, `backend`, `postgres`, `redis`
- Ingresses: `frontend`, `backend` (Traefik)
- CronJob: `cleanup-stale-games`
- RBAC: ServiceAccount, Role, RoleBinding

## Traffic Flow

```
Internet → Cloudflare Tunnel → Traefik (fortezza.colechiodo.cc)
  ├─ / → Frontend Pod
  ├─ /api → Backend Pod
  ├─ /auth → Backend Pod
  └─ /game-{id} → Game Server Pod (dynamic)
```

## Scaling

```bash
# Scale backend
kubectl scale deployment backend --replicas=3 -n game-servers

# Scale frontend
kubectl scale deployment frontend --replicas=2 -n game-servers
```

## Monitoring

```bash
# Check pods
kubectl get pods -n game-servers

# View logs
kubectl logs -f deployment/backend -n game-servers
kubectl logs -f deployment/frontend -n game-servers

# Check ingresses
kubectl get ingress -n game-servers
```

## Cleanup

```bashf . -n game-servers
```

kubectl delete -