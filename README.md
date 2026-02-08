# Fortezza Tactics Online

A multiplayer turn-based PvP strategy game built with Vue 3 + TypeScript frontend and Node/Express backend with OAuth2 authentication.

## Tech Stack

| Component          | Technology                                                              |
| ------------------ | ----------------------------------------------------------------------- |
| **Frontend**       | Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS + DaisyUI |
| **Backend**        | Node.js + Express + Socket.io + TypeScript                              |
| **Database**       | PostgreSQL + Prisma ORM                                                 |
| **Sessions**       | Redis (connect-redis)                                                   |
| **Auth**           | Passport.js (Google, Discord, Steam OAuth2)                             |
| **Game Server**    | Node.js + Socket.io (per-instance K8s Jobs)                             |
| **Infrastructure** | Kubernetes + Docker                                                     |

## Project Structure

```
pvpstrategygame/
├── frontend/           # Vue 3 + Vite frontend
├── backend/            # Express + Socket.io backend
├── game-server/        # Individual game server instances
├── shared/             # Shared TypeScript types
├── k8s/                # Kubernetes manifests
├── old/                # Legacy project (for reference)
├── docker-compose.yml   # Local development
├── PLAN.md             # Development roadmap
└── .env.example        # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local development)
- PostgreSQL (or use Docker Compose)
- Redis (or use Docker Compose)
- OAuth2 credentials:
  - [Google Cloud Console](https://console.cloud.google.com)
  - [Discord Developer Portal](https://discord.com/developers/applications)
  - [Steam Web API Key](https://steamcommunity.com/dev/apikey)

### Local Development

1. **Clone and setup**:

   ```bash
   git clone <repo>
   cd pvpstrategygame
   cp .env.example .env
   # Edit .env with your OAuth2 credentials
   ```

2. **Start services**:

   ```bash
   docker-compose up -d
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Run Prisma migrations**:

   ```bash
   cd backend
   npm run prisma:migrate
   ```

5. **Start development servers**:

   ```bash
   # Backend (includes Prisma, Redis, Socket.io):
   npm run dev:backend

   # Frontend (Vue dev server):
   npm run dev:frontend

   # Or both at once:
   npm run dev
   ```

6. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

## Authentication

Currently supports OAuth2 login via:

- **Google**: `GET /auth/google`
- **Discord**: `GET /auth/discord`
- **Steam**: `GET /auth/steam`

## API Endpoints

### Auth

- `GET /auth/:provider` - Redirect to OAuth provider
- `GET /auth/:provider/callback` - OAuth callback
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout

### Health

- `GET /health` - Health check

## Development Status

- ✅ Phase 1: Foundation - Complete
- ✅ Phase 2: Authentication - Complete
- ⏳ Phase 3: Core Game Engine Port - Pending
- ⏳ Phase 4: Backend Services - Pending
- ⏳ Phase 5: K8s Integration - Pending
- ⏳ Phase 6: Matchmaking & Gameplay - Pending
- ⏳ Phase 7: Match History & Ranks - Pending
- ⏳ Phase 8: Cosmetics System - Pending
- ⏳ Phase 9: Polish & Features - Pending
- ⏳ Phase 10: Deployment & Testing - Pending

See [PLAN.md](./PLAN.md) for full details.

## Environment Variables

See [`.env.example`](./.env.example) for all required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `STEAM_API_KEY`
- `FRONTEND_URL` - CORS origin

## Database Schema

See [Prisma schema](./backend/prisma/schema.prisma) for models:

- `User` - Accounts and profiles
- `UserSession` - Active sessions
- `MatchHistory` - Game records
- `Rank` - ELO ratings and tiers
- `Cosmetic` - Unlocked items
- `Loadout` - Player customizations
- `Replay` - Game replays (gzipped JSON)

## Building for Production

```bash
# Build all packages
npm run build

# Docker images
docker build -t fortezza-web-server ./backend
docker build -t fortezza-game-server ./game-server
docker build -t fortezza-frontend ./frontend

# Deploy to Kubernetes
kubectl apply -f k8s/
```

## License

Proprietary - All rights reserved.
