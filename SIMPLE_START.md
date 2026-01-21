# Simple Manual Start (Docker Desktop Issue Workaround)

Since Docker Desktop is running but `docker-compose` has context issues, let's do manual setup:

## Step 1: Clear Ports (if needed)

```bash
# Kill any process using Redis port
lsof -ti:6379 | xargs kill -9 2>/dev/null || echo "Port 6379 is free"

# Kill any process using PostgreSQL port
lsof -ti:5432 | xargs kill -9 2>/dev/null || echo "Port 5432 is free"
```

## Step 2: Start Docker Containers Manually

```bash
cd /Users/kevinjacob/fuse

# Start PostgreSQL
docker run -d \
  --name relay-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=relay \
  -e POSTGRES_PASSWORD=relay \
  -e POSTGRES_DB=relay \
  postgres:16-alpine

# Wait a few seconds
sleep 5

# Start Redis
docker run -d \
  --name relay-redis \
  -p 6379:6379 \
  redis:7-alpine

# Wait a few seconds
sleep 3
```

## Step 3: Verify Containers are Running

```bash
docker ps
```

You should see both `relay-postgres` and `relay-redis` running.

## Step 4: Setup Database

```bash
cd /Users/kevinjacob/fuse

# Install dependencies
npm install

# Go to API package
cd packages/api

# Install API dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev --name init

# Seed database (adds 10 detection rules)
npm run prisma:seed

# Go back to root
cd ../..
```

## Step 5: Start the Application

```bash
npm run dev
```

You should see:
- API starting on port 3001
- Web starting on port 5173

## Step 6: Open Dashboard

Open your browser to: **http://localhost:5173**

## If You Get Errors

### "Can't connect to database"
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running, restart it
docker start relay-postgres

# Check logs
docker logs relay-postgres
```

### "Can't connect to Redis"
```bash
# Check if Redis is running
docker ps | grep redis

# If not running, restart it
docker start relay-redis
```

### "Port already in use"
```bash
# Stop existing containers
docker stop relay-postgres relay-redis
docker rm relay-postgres relay-redis

# Then start from Step 2 again
```

### Need to Start Fresh
```bash
# Stop and remove everything
docker stop relay-postgres relay-redis
docker rm relay-postgres relay-redis

# Remove volumes (deletes data)
docker volume rm fuse_postgres_data fuse_redis_data 2>/dev/null || true

# Start from Step 2
```

## Next Steps

Once everything is running:
1. Dashboard should be at http://localhost:5173
2. Try the examples from [QUICKSTART.md](./QUICKSTART.md)
3. Test with curl commands

## Quick Health Check

```bash
# Check API
curl http://localhost:3001/health

# Should return: {"status":"ok","timestamp":"..."}
```
