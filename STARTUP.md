# 🚀 Fuse Startup Guide

## Quick Start (3 Steps)

### Step 1: Start Docker Services (PostgreSQL + Redis)

Open a terminal and run:

```bash
cd /Users/kevinjacob/fuse

# Start Docker Desktop first if not running
# Then start the services:
docker-compose up -d

# Verify they're running:
docker ps
```

You should see two containers running:
- `relay-fuse-postgres-2026`
- `relay-fuse-redis-2026`

### Step 2: Setup Database

```bash
cd /Users/kevinjacob/fuse/packages/api

# Run migrations
npm run prisma:migrate

# Seed with demo data
npm run prisma:demo-seed
```

### Step 3: Start All Services

Open a new terminal and run:

```bash
cd /Users/kevinjacob/fuse

# This starts both API (port 3001) and Web (port 5173)
npm run dev
```

**Wait for both to start. You should see:**
```
api:0: Server started on port 3001
web:0: Local: http://localhost:5173
```

### Step 4: Open the Demo

Open your browser to: **http://localhost:5173**

---

## What Ports Are Used?

- **5173** - Web UI (Vite dev server)
- **3001** - API Server (Express + Socket.io)
- **5432** - PostgreSQL (Docker)
- **6379** - Redis (Docker)

---

## Troubleshooting

### "Cannot connect to database"

Make sure Docker is running and the postgres container is up:

```bash
docker ps | grep postgres
```

If not running:
```bash
docker-compose up -d
```

### "Port 3001 already in use"

Kill the process:
```bash
lsof -ti:3001 | xargs kill -9
```

### "Port 5173 already in use"

Kill the process:
```bash
lsof -ti:5173 | xargs kill -9
```

### Database connection errors

Update `/packages/api/.env` to match docker-compose settings:

```env
DATABASE_URL="postgresql://relay:relay@localhost:5432/relay?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3001
NODE_ENV="development"
```

Then re-run migrations:
```bash
cd packages/api
npm run prisma:migrate
npm run prisma:demo-seed
```

### "npm run dev" shows blank screen

The root `npm run dev` uses Turbo to run ALL packages in parallel. Wait for both services to start:
- API should log: `Server started on port 3001`
- Web should log: `Local: http://localhost:5173`

If you see logs mixing together, that's normal! Just wait for both services to be ready.

### Still not working?

Start services individually in separate terminals:

**Terminal 1 - API:**
```bash
cd /Users/kevinjacob/fuse/packages/api
npm run dev
```

**Terminal 2 - Web:**
```bash
cd /Users/kevinjacob/fuse/packages/web
npm run dev
```

---

## Stopping Everything

```bash
# Stop API and Web
# Press Ctrl+C in the terminal running npm run dev

# Stop Docker services
docker-compose down
```

---

## Demo Walkthrough

Once everything is running at **http://localhost:5173**:

### 1. Live Demo (Split-Screen)
Click **"Live Demo"** in the sidebar

- **Left**: Customer refund portal
- **Right**: Fuse admin monitoring

Try submitting refunds:
- $50 = auto-approved ✓
- $350 = requires approval ⏳
- $6000 = blocked 🚫

### 2. Execution Graph
Click **"Execution Graph"** in the sidebar

- See visual DAG with nodes and edges
- Color-coded status (green/yellow/red)
- Click nodes for details
- Zoom/pan to explore

### 3. Other Features
- **Approval Queue** - Approve pending requests
- **Emergency Stops** - Activate circuit breakers
- **Policies** - View security policies
- **Rollbacks** - Rollback completed executions

---

## Environment Variables

Your current setup:

### `/packages/api/.env`
```env
DATABASE_URL="postgresql://relay:relay@localhost:5432/relay?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3001
NODE_ENV="development"
```

### `/packages/web/.env` (if needed)
```env
VITE_API_URL=http://localhost:3001
VITE_API_KEY=test-key
```

---

## Success Checklist

✅ Docker containers running (`docker ps` shows 2 containers)
✅ API server running on port 3001
✅ Web server running on port 5173
✅ Browser shows Fuse dashboard at localhost:5173
✅ Can navigate to "Live Demo" page
✅ Customer portal loads in left panel
✅ Submitting refund triggers real executions

If all checkboxes pass, you're ready to demo! 🎉
