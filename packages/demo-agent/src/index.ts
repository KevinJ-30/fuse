import * as dotenv from 'dotenv';
import { RefundAgent } from './agent';
import { scenarios, getScenarioByName } from './scenarios';

// Load environment variables
dotenv.config();

const API_URL = process.env.FUSE_API_URL || 'http://localhost:3001';
const API_KEY = process.env.FUSE_API_KEY || 'demo-agent-key';
const AGENT_ID = process.env.AGENT_ID || 'customer_service_refund_bot';
const DEMO_MODE = process.env.DEMO_MODE || 'interactive';
const DEMO_INTERVAL_MIN = parseInt(process.env.DEMO_INTERVAL_MIN || '10000');
const DEMO_INTERVAL_MAX = parseInt(process.env.DEMO_INTERVAL_MAX || '30000');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║              Fuse Demo Agent                             ║
║         Customer Service Refund Bot                      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

Configuration:
  API URL: ${API_URL}
  Agent ID: ${AGENT_ID}
  Mode: ${DEMO_MODE}

Available Commands:
  - full       Run all scenarios in sequence
  - continuous Start continuous random execution
  - scenario <name>  Run specific scenario
  - list       List all available scenarios
  - help       Show this help message
  - exit       Stop and exit
`);

  const agent = new RefundAgent(API_URL, API_KEY, AGENT_ID);

  // Handle command line arguments
  const command = process.argv[2];

  if (command === 'full') {
    await agent.runFullDemo();
    process.exit(0);
  } else if (command === 'continuous') {
    agent.startContinuous(DEMO_INTERVAL_MIN, DEMO_INTERVAL_MAX);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n\nReceived SIGINT, shutting down gracefully...`);
      agent.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log(`\n\nReceived SIGTERM, shutting down gracefully...`);
      agent.stop();
      process.exit(0);
    });
  } else if (command === 'scenario' && process.argv[3]) {
    const scenarioName = process.argv[3];
    const scenario = getScenarioByName(scenarioName);

    if (scenario) {
      await agent.processRefund(scenario);
      process.exit(0);
    } else {
      console.error(`\n❌ Scenario "${scenarioName}" not found`);
      console.log(`\nAvailable scenarios:`);
      scenarios.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }
  } else if (command === 'list') {
    console.log(`\nAvailable Scenarios:\n`);
    scenarios.forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}`);
      console.log(`   ${s.description}`);
      console.log(`   Amount: $${s.amount} | Expected: ${s.expectedOutcome}\n`);
    });
    process.exit(0);
  } else if (command === 'help' || !command) {
    // Help message already printed above
    process.exit(0);
  } else {
    console.error(`\n❌ Unknown command: ${command}`);
    console.log(`\nRun with no arguments to see available commands`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});
