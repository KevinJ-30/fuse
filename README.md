# Relay - AI Agent Safety Layer

**Relay** is a safety proxy for AI agents in production, providing detection, intervention, and recovery capabilities for tool calls.

## Overview

Relay sits between AI agents and the tools they call, acting as a safety layer that can:

1. **Detect** mistakes before they happen using three layers of analysis
2. **Intervene** with emergency stops and human approval checkpoints
3. **Recover** from mistakes with blast radius detection and compensating actions

### Key Features

- **Proxy-First Architecture**: All tool calls flow through a single endpoint
- **Multi-Layer Detection**: Deterministic rules, anomaly detection, and semantic analysis
- **Circuit Breakers**: Instant freeze capability at global, agent, or tool level
- **Approval Workflows**: Configurable policies for human review
- **Smart Rollbacks**: Blast radius calculation with automatic compensations
- **Real-Time Dashboard**: Live monitoring with Socket.io updates

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Docker and Docker Compose (for local development)
- npm >= 9.0.0

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd relay
```

2. Install dependencies:
```bash
npm install
```

3. Start the development environment:
```bash
# Start Postgres and Redis
docker-compose up -d

# Copy environment files
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env

# Run database migrations
cd packages/api
npx prisma migrate dev
cd ../..

# Start all services
npm run dev
```

This will start:
- API server on http://localhost:3001
- Web dashboard on http://localhost:3000
- PostgreSQL on localhost:5432
- Redis on localhost:6379

### Using the SDK

Install the SDK in your agent project:

```bash
npm install @relay/sdk
```

Use it to proxy tool calls:

```typescript
import { RelayClient } from '@relay/sdk';

const relay = new RelayClient({
  baseUrl: 'http://localhost:3001',
  apiKey: 'your-api-key',
  agentId: 'my-agent'
});

// Execute a tool call through the proxy
const result = await relay.execute('send_email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'This is a test email'
});

console.log(result.output);
```

## Project Structure

```
relay/
├── packages/
│   ├── api/          # Express backend
│   ├── web/          # React dashboard
│   └── sdk/          # TypeScript client SDK
├── docker-compose.yml
└── README.md
```

## Core Concepts

### 1. Detection Layer

Three layers of analysis run on every tool call:

**Layer 1: Rule Engine** (< 10ms)
- Rate limits per agent/tool
- Value thresholds (e.g., refund > $1000)
- Pattern matching (PII, template variables)
- Time restrictions (business hours)
- Protected resources

**Layer 2: Anomaly Detection** (< 50ms)
- Volume anomalies (unusual activity spikes)
- Timing anomalies (weekend execution)
- Recipient anomalies (external emails)
- Value anomalies (statistical outliers)

**Layer 3: Semantic Analysis** (< 1s, selective)
- LLM review for high-stakes actions
- Triggered by Layer 1/2 flags or high-stakes tools
- Returns recommendation, confidence, and reasoning

**Risk Scoring**:
- Combines all three layers
- < 0.3: Auto-approve
- 0.3 - 0.95: Require approval
- \> 0.95: Auto-block

### 2. Intervention Layer

**Circuit Breakers**:
- **Global**: Block all tool calls from all agents
- **Agent**: Block specific agent
- **Tool**: Block specific tool across all agents
- Activation time: < 500ms

**Approval Policies**:
- Define rules for human review
- Condition-based filtering
- Override detection auto-approval
- Real-time queue updates

### 3. Recovery Layer

**Execution Graph**:
- Every tool call creates a node in a DAG
- Parent-child relationships track causality
- Enables blast radius calculation

**Blast Radius Detection**:
- BFS traversal from target execution
- Find all downstream affected executions
- Group by agent and tool

**Compensation Strategies**:
- **AUTO_REVERSE**: Safe automatic undo (delete record, cancel event)
- **SUGGESTED**: Needs review (send correction email, issue refund)
- **MANUAL_REQUIRED**: Cannot automate (unknown tool)
- **NOT_REVERSIBLE**: Cannot undo (SMS sent, mail dispatched)
- **NO_ACTION_NEEDED**: Read-only operations

## API Endpoints

### Proxy
- `POST /api/proxy/execute` - Main proxy endpoint for tool calls

### Breakers
- `GET /api/breakers` - List all breakers
- `POST /api/breakers` - Create breaker
- `PATCH /api/breakers/:id` - Toggle status
- `DELETE /api/breakers/:id` - Delete breaker

### Policies
- `GET /api/policies` - List policies
- `POST /api/policies` - Create policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy

### Approvals
- `GET /api/approvals` - List approval requests
- `GET /api/approvals/:id` - Get approval details
- `POST /api/approvals/:id/approve` - Approve request
- `POST /api/approvals/:id/deny` - Deny request

### Rollbacks
- `GET /api/rollbacks` - List rollback history
- `POST /api/rollbacks/initiate` - Initiate rollback
- `POST /api/rollbacks/:id/execute` - Execute rollback

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/executions/trend` - Execution trends

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

### Database Migrations

```bash
cd packages/api
npx prisma migrate dev --name <migration-name>
npx prisma generate
```

## Architecture

### Data Flow

```
Agent → SDK → Proxy Service → Detection Pipeline → Risk Scorer
                    ↓
            Breaker Check
                    ↓
            Policy Evaluation
                    ↓
        [Execute | Approve | Block]
```

### Key Components

- **ProxyService**: Orchestrates the entire flow
- **BreakerService**: Circuit breaker logic
- **DetectionPipeline**: Runs all three detection layers
- **PolicyService**: Evaluates approval policies
- **RollbackService**: Manages recovery operations
- **ExecutionGraphService**: Tracks causality

## Configuration

### Environment Variables

**API (packages/api/.env)**:
```env
DATABASE_URL=postgresql://relay:relay@localhost:5432/relay
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-... # Optional for semantic analysis
PORT=3001
NODE_ENV=development
```

**Web (packages/web/.env)**:
```env
VITE_API_URL=http://localhost:3001
VITE_API_KEY=test-key
```

## Deployment

### Production Checklist

1. Set strong `JWT_SECRET`
2. Use managed Postgres (RDS, Supabase, etc.)
3. Use managed Redis (ElastiCache, Upstash, etc.)
4. Enable HTTPS
5. Set up monitoring and alerting
6. Configure CORS origins
7. Run database migrations: `npx prisma migrate deploy`

## Roadmap

### MVP (Completed ✅)
- [x] Proxy architecture
- [x] Circuit breakers (GLOBAL, AGENT, TOOL)
- [x] Rule-based detection (10 default rules)
- [x] Anomaly detection
- [x] Semantic analysis layer
- [x] Approval workflows with policies
- [x] Rollback system with compensation strategies
- [x] Dashboard UI with real-time updates
- [x] Execution graph & blast radius calculation

### Post-MVP
- [ ] Multi-organization support
- [ ] Custom compensation strategies
- [ ] Advanced analytics with ML
- [ ] Integration marketplace
- [ ] Mobile app for approvals
- [ ] Webhook notifications

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT

## Support

For issues and questions, please file a GitHub issue.

---

**Built for production AI agents** 🤖✨
