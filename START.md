# Start Relay - Fixed Setup

## Issue Summary
You encountered 3 issues:
1. ✅ **Port 6379 conflict** - Redis port already in use (now handled)
2. ✅ **Prisma v7 incompatibility** - npx installed wrong version (now fixed)
3. ✅ **Missing packageManager** - Turborepo requirement (now fixed)

## Quick Start (Fixed)

### Step 1: Start Docker Desktop
**IMPORTANT**: Open Docker Desktop application and wait for it to fully start before proceeding.

### Step 2: Run Setup Script
```bash
cd /Users/kevinjacob/fuse
./setup.sh
```

This script will:
- Check if Docker is running
- Kill any processes using ports 5432 and 6379
- Start PostgreSQL and Redis containers
- Wait for databases to be ready
- Install dependencies
- Run Prisma migrations
- Seed the database with 10 detection rules

### Step 3: Start the Application
```bash
npm run dev
```

This starts both the API (port 3001) and Web UI (port 5173).

## Manual Setup (If Script Fails)

### 1. Start Docker Desktop
Open the Docker Desktop application.

### 2. Clear Ports
```bash
# Kill any processes using Redis port
lsof -ti:6379 | xargs kill -9 2>/dev/null

# Kill any processes using PostgreSQL port
lsof -ti:5432 | xargs kill -9 2>/dev/null
```

### 3. Start Databases
```bash
docker-compose up -d
```

Wait ~10 seconds for services to start, then verify:
```bash
docker ps
# Should show relay-postgres and relay-redis running
```

### 4. Setup Environment Files
```bash
# Already done - .env files created from .env.example
```

### 5. Install Dependencies
```bash
npm install
```

### 6. Setup Database
```bash
cd packages/api

# Install local dependencies
npm install

# Generate Prisma client (uses local v6, not npx v7)
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database
npm run prisma:seed

cd ../..
```

### 7. Start Application
```bash
npm run dev
```

## Verify Everything is Working

### Check Databases
```bash
# Check PostgreSQL
docker exec relay-postgres psql -U relay -d relay -c "SELECT COUNT(*) FROM \"DetectionRule\";"
# Should show: count = 10

# Check Redis
docker exec relay-redis redis-cli ping
# Should show: PONG
```

### Access Applications
- **Web Dashboard**: http://localhost:5173
- **API Health**: http://localhost:3001/health
- **Prisma Studio**: `cd packages/api && npx prisma studio`

## Troubleshooting

### Error: "Cannot connect to Docker daemon"
**Solution**: Open Docker Desktop application and wait for it to start completely.

### Error: "Port already allocated"
**Solution**: Run port clearing commands from Manual Setup step 2.

### Error: "Prisma schema validation"
**Solution**: Use `npx prisma` in the packages/api directory, NOT in root.

### Error: "Missing packageManager field"
**Solution**: Already fixed in package.json (line 5).

### Web UI shows blank page
**Check**:
```bash
# In one terminal
cd packages/web
npm run dev

# Should show: Local: http://localhost:5173
```

### API not responding
**Check**:
```bash
# In one terminal
cd packages/api
npm run dev

# Should show: Server started on port 3001
```

## Next Steps

Once everything is running:
1. Open http://localhost:5173
2. Follow the [QUICKSTART.md](./QUICKSTART.md) testing guide
3. Try the example curl commands to test the API

## Clean Start (If Needed)

If things get messed up, reset everything:

```bash
# Stop and remove containers
docker-compose down -v

# Remove node_modules
rm -rf node_modules packages/*/node_modules

# Clear Prisma client
rm -rf packages/api/node_modules/.prisma

# Start fresh
./setup.sh
```
