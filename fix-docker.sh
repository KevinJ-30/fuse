#!/bin/bash

# Docker Troubleshooting & Cleanup Script for Relay

set -e

echo "🔧 Docker Troubleshooting for Relay"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Clean up old containers
echo -e "${BLUE}Step 1: Cleaning up old Relay containers...${NC}"
docker stop relay-postgres relay-redis relay-fuse-postgres-2026 relay-fuse-redis-2026 2>/dev/null || echo "No running containers to stop"
docker rm relay-postgres relay-redis relay-fuse-postgres-2026 relay-fuse-redis-2026 2>/dev/null || echo "No containers to remove"
echo -e "${GREEN}✓ Old containers cleaned${NC}"
echo ""

# Step 2: List all your containers to see conflicts
echo -e "${BLUE}Step 2: Your existing Docker containers:${NC}"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}" || echo "Cannot list containers - Docker may not be running"
echo ""

# Step 3: Kill processes on ports
echo -e "${BLUE}Step 3: Freeing up ports 5432 and 6379...${NC}"
lsof -ti:5432 | xargs kill -9 2>/dev/null && echo "Killed process on port 5432" || echo "Port 5432 is free"
lsof -ti:6379 | xargs kill -9 2>/dev/null && echo "Killed process on port 6379" || echo "Port 6379 is free"
echo -e "${GREEN}✓ Ports cleared${NC}"
echo ""

# Step 4: Check Docker status
echo -e "${BLUE}Step 4: Checking Docker status...${NC}"
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is running${NC}"
    docker version --format 'Version: {{.Server.Version}}'
else
    echo -e "${RED}✗ Docker is NOT running${NC}"
    echo ""
    echo "Please:"
    echo "  1. Open Docker Desktop"
    echo "  2. Wait for it to say 'Docker Desktop is running'"
    echo "  3. Run this script again: ./fix-docker.sh"
    exit 1
fi
echo ""

# Step 5: Try docker-compose
echo -e "${BLUE}Step 5: Testing docker-compose...${NC}"
if docker compose version > /dev/null 2>&1; then
    echo -e "${GREEN}✓ docker compose is available${NC}"
    docker compose version
elif docker-compose --version > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Using legacy docker-compose${NC}"
    docker-compose --version
else
    echo -e "${RED}✗ docker-compose not found${NC}"
    echo "Docker Desktop should include docker compose"
fi
echo ""

# Step 6: Start fresh containers
echo -e "${BLUE}Step 6: Starting fresh Relay containers...${NC}"
echo "Using unique names: relay-fuse-postgres-2026 and relay-fuse-redis-2026"

if docker compose up -d 2>&1; then
    echo -e "${GREEN}✓ Containers started with docker compose${NC}"
elif docker-compose up -d 2>&1; then
    echo -e "${GREEN}✓ Containers started with docker-compose${NC}"
else
    echo -e "${YELLOW}⚠ docker-compose failed, trying manual start...${NC}"

    # Manual docker run commands
    docker run -d \
      --name relay-fuse-postgres-2026 \
      -p 5432:5432 \
      -e POSTGRES_USER=relay \
      -e POSTGRES_PASSWORD=relay \
      -e POSTGRES_DB=relay \
      postgres:16-alpine

    docker run -d \
      --name relay-fuse-redis-2026 \
      -p 6379:6379 \
      redis:7-alpine

    echo -e "${GREEN}✓ Containers started manually${NC}"
fi
echo ""

# Step 7: Wait and verify
echo -e "${BLUE}Step 7: Waiting for containers to be ready...${NC}"
sleep 5

echo "Checking PostgreSQL..."
for i in {1..10}; do
    if docker exec relay-fuse-postgres-2026 pg_isready -U relay > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}✗ PostgreSQL not ready after 10 seconds${NC}"
        echo "Check logs: docker logs relay-fuse-postgres-2026"
    fi
    sleep 1
done

echo "Checking Redis..."
for i in {1..10}; do
    if docker exec relay-fuse-redis-2026 redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}✗ Redis not ready after 10 seconds${NC}"
        echo "Check logs: docker logs relay-fuse-redis-2026"
    fi
    sleep 1
done
echo ""

# Step 8: Show running containers
echo -e "${BLUE}Step 8: Running containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo -e "${GREEN}✅ Docker setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. cd /Users/kevinjacob/fuse"
echo "  2. npm install"
echo "  3. cd packages/api && npm install"
echo "  4. npx prisma generate"
echo "  5. npx prisma migrate dev --name init"
echo "  6. npm run prisma:seed"
echo "  7. cd ../.. && npm run dev"
echo ""
