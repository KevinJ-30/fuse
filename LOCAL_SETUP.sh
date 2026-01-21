#!/bin/bash

# Local Database Setup (No Docker Required!)
# This installs PostgreSQL and Redis directly on your Mac

set -e

echo "🚀 Setting up Relay with Local Databases (No Docker!)"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Homebrew
echo -e "${BLUE}Checking Homebrew...${NC}"
if ! which brew > /dev/null; then
    echo -e "${RED}✗ Homebrew not found${NC}"
    echo "Install it from: https://brew.sh"
    exit 1
fi
echo -e "${GREEN}✓ Homebrew installed${NC}"
echo ""

# Install PostgreSQL
echo -e "${BLUE}Installing PostgreSQL...${NC}"
if brew list postgresql@16 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL already installed${NC}"
else
    echo "Installing PostgreSQL 16..."
    brew install postgresql@16
    echo -e "${GREEN}✓ PostgreSQL installed${NC}"
fi
echo ""

# Install Redis
echo -e "${BLUE}Checking Redis...${NC}"
if brew list redis > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis already installed${NC}"
else
    echo "Installing Redis..."
    brew install redis
    echo -e "${GREEN}✓ Redis installed${NC}"
fi
echo ""

# Start PostgreSQL
echo -e "${BLUE}Starting PostgreSQL...${NC}"
brew services stop postgresql@16 2>/dev/null || true
sleep 2
brew services start postgresql@16
sleep 3
echo -e "${GREEN}✓ PostgreSQL started${NC}"
echo ""

# Start Redis
echo -e "${BLUE}Starting Redis...${NC}"
brew services stop redis 2>/dev/null || true
sleep 2
brew services start redis
sleep 2
echo -e "${GREEN}✓ Redis started${NC}"
echo ""

# Create database and user
echo -e "${BLUE}Setting up database...${NC}"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Drop database if exists
dropdb relay 2>/dev/null || true

# Create database
createdb relay
echo -e "${GREEN}✓ Database 'relay' created${NC}"
echo ""

# Update .env file
echo -e "${BLUE}Updating .env files...${NC}"
cat > /Users/kevinjacob/fuse/packages/api/.env << 'EOF'
DATABASE_URL="postgresql://$(whoami)@localhost:5432/relay?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3001
NODE_ENV="development"
EOF

# Expand the $(whoami) variable
USERNAME=$(whoami)
sed -i '' "s/\$(whoami)/$USERNAME/g" /Users/kevinjacob/fuse/packages/api/.env

echo -e "${GREEN}✓ .env file updated${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
cd /Users/kevinjacob/fuse
npm install
echo -e "${GREEN}✓ Root dependencies installed${NC}"
echo ""

# Setup API
echo -e "${BLUE}Setting up API...${NC}"
cd /Users/kevinjacob/fuse/packages/api
npm install
echo -e "${GREEN}✓ API dependencies installed${NC}"
echo ""

# Generate Prisma client
echo -e "${BLUE}Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# Run migrations
echo -e "${BLUE}Running database migrations...${NC}"
npx prisma migrate dev --name init
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Seed database
echo -e "${BLUE}Seeding database with detection rules...${NC}"
npm run prisma:seed
echo -e "${GREEN}✓ Database seeded with 10 detection rules${NC}"
echo ""

cd /Users/kevinjacob/fuse

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "Your local databases are running:"
echo "  • PostgreSQL: localhost:5432 (database: relay)"
echo "  • Redis: localhost:6379"
echo ""
echo "To start the application:"
echo "  ${YELLOW}npm run dev${NC}"
echo ""
echo "Then open:"
echo "  • Dashboard: http://localhost:5173"
echo "  • API: http://localhost:3001"
echo ""
echo "To stop databases later:"
echo "  brew services stop postgresql@16"
echo "  brew services stop redis"
echo ""
