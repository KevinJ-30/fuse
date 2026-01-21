#!/bin/bash

# Relay Setup Script
# This script sets up the development environment without Docker

set -e

echo "🚀 Setting up Relay..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not running. Please start Docker Desktop and try again.${NC}"
    echo ""
    echo "To start Docker:"
    echo "  1. Open Docker Desktop application"
    echo "  2. Wait for it to fully start"
    echo "  3. Run this script again"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Check if port 6379 (Redis) is in use
if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 6379 is in use. Killing process...${NC}"
    lsof -ti:6379 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Check if port 5432 (PostgreSQL) is in use
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 5432 is in use. Killing process...${NC}"
    lsof -ti:5432 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start Docker services
echo "Starting PostgreSQL and Redis..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

for i in {1..30}; do
    if docker exec relay-postgres pg_isready -U relay > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ PostgreSQL failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
for i in {1..30}; do
    if docker exec relay-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Redis failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup Prisma
echo "Setting up database..."
cd packages/api

# Use local Prisma (not npx which installs latest)
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database
npm run prisma:seed

cd ../..

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "To start the application:"
echo "  npm run dev"
echo ""
echo "Then open:"
echo "  - Dashboard: http://localhost:5173"
echo "  - API: http://localhost:3001"
echo ""
