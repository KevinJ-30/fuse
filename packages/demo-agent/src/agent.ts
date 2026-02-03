import { RelayClient, BreakerError, ApprovalRequiredError, ExecutionFailedError } from '@relay/sdk';
import { RefundScenario, getRandomScenario } from './scenarios';

export interface AgentStats {
  totalExecutions: number;
  successful: number;
  failed: number;
  blocked: number;
  awaitingApproval: number;
  startTime: Date;
}

export class RefundAgent {
  private relay: RelayClient;
  private stats: AgentStats;
  private running: boolean = false;
  private currentInterval?: NodeJS.Timeout;

  constructor(
    apiUrl: string,
    apiKey: string,
    agentId: string
  ) {
    this.relay = new RelayClient({
      baseUrl: apiUrl,
      apiKey,
      agentId,
      autoChain: true, // Automatically chain parent-child executions
    });

    this.stats = {
      totalExecutions: 0,
      successful: 0,
      failed: 0,
      blocked: 0,
      awaitingApproval: 0,
      startTime: new Date(),
    };
  }

  /**
   * Process a single refund scenario
   */
  async processRefund(scenario: RefundScenario): Promise<void> {
    console.log(`\n=== Processing: ${scenario.name} ===`);
    console.log(`Description: ${scenario.description}`);
    console.log(`Amount: $${scenario.amount}`);
    console.log(`Expected: ${scenario.expectedOutcome}`);

    // Add delay if specified (for demo pacing)
    if (scenario.delay) {
      await this.sleep(scenario.delay);
    }

    this.stats.totalExecutions++;

    try {
      // Step 1: Verify customer (safe operation)
      console.log(`\n[Step 1/4] Verifying customer: ${scenario.customerId}`);
      const verification = await this.relay.execute('verify_customer', {
        customerId: scenario.customerId,
        orderId: scenario.orderId,
      });
      console.log(`✓ Customer verified (execution: ${verification.executionId?.slice(0, 8)})`);

      // Step 2: Check refund eligibility (safe operation)
      console.log(`\n[Step 2/4] Checking refund eligibility for order: ${scenario.orderId}`);
      const eligibility = await this.relay.execute('check_refund_eligibility', {
        orderId: scenario.orderId,
        daysOldThreshold: 30,
      });
      console.log(`✓ Eligibility checked (execution: ${eligibility.executionId?.slice(0, 8)})`);

      // Step 3: Process refund (risky operation, may need approval)
      console.log(`\n[Step 3/4] Processing refund: $${scenario.amount}`);
      const refund = await this.relay.executeAndWait('stripe_refund', {
        customerId: scenario.customerId,
        orderId: scenario.orderId,
        amount: scenario.amount,
        currency: 'usd',
        reason: scenario.reason,
      });

      if (refund.status === 'executed') {
        console.log(`✓ Refund processed (execution: ${refund.executionId?.slice(0, 8)})`);

        // Step 4: Send confirmation email (safe operation)
        console.log(`\n[Step 4/4] Sending confirmation email`);
        const email = await this.relay.execute('send_email', {
          to: `customer-${scenario.customerId}@example.com`,
          subject: 'Refund Processed',
          body: `Your refund of $${scenario.amount} has been processed successfully.`,
        });
        console.log(`✓ Email sent (execution: ${email.executionId?.slice(0, 8)})`);

        this.stats.successful++;
        console.log(`\n✅ Scenario completed successfully`);
      } else if (refund.status === 'blocked') {
        this.stats.blocked++;
        console.log(`\n🚫 Refund blocked: ${refund.reason || 'Unknown reason'}`);
      }
    } catch (error) {
      if (error instanceof BreakerError) {
        this.stats.blocked++;
        console.log(`\n🚫 Circuit breaker active: ${error.reason}`);
        console.log(`Execution ID: ${error.executionId?.slice(0, 8)}`);
      } else if (error instanceof ApprovalRequiredError) {
        this.stats.awaitingApproval++;
        console.log(`\n⏳ Approval required`);
        console.log(`Execution ID: ${error.executionId?.slice(0, 8)}`);
        console.log(`Request ID: ${error.requestId?.slice(0, 8)}`);
        console.log(`Waiting for human review...`);
        // In real scenario, we'd wait for approval
        // For demo, we just note it and continue
      } else if (error instanceof ExecutionFailedError) {
        this.stats.failed++;
        console.log(`\n❌ Execution failed: ${error.message}`);
        if (error.executionId) {
          console.log(`Execution ID: ${error.executionId.slice(0, 8)}`);
        }
      } else {
        this.stats.failed++;
        console.log(`\n❌ Unexpected error:`, error);
      }
    }

    // Print current stats
    this.printStats();
  }

  /**
   * Run rate limit test - burst of 15 refunds
   */
  async runRateLimitTest(): Promise<void> {
    console.log(`\n=== Rate Limit Test ===`);
    console.log(`Sending burst of 15 refunds to trigger rate limiting...`);

    const promises: Promise<void>[] = [];
    for (let i = 0; i < 15; i++) {
      promises.push(this.processSimpleRefund(i + 1));
      await this.sleep(50); // Small delay between each
    }

    await Promise.all(promises);
    console.log(`\n✅ Rate limit test completed`);
  }

  /**
   * Simple refund without full workflow (for rate limit testing)
   */
  private async processSimpleRefund(index: number): Promise<void> {
    try {
      const result = await this.relay.execute('stripe_refund', {
        customerId: `cus_ratelimit_${index}`,
        orderId: `ord_ratelimit_${index}`,
        amount: 25,
        currency: 'usd',
        reason: `Rate limit test refund ${index}`,
      });

      if (result.status === 'executed') {
        console.log(`  ✓ Refund ${index}/15 processed`);
        this.stats.successful++;
      } else if (result.status === 'blocked') {
        console.log(`  🚫 Refund ${index}/15 blocked (rate limit hit!)`);
        this.stats.blocked++;
      }

      this.stats.totalExecutions++;
    } catch (error) {
      if (error instanceof BreakerError) {
        console.log(`  🚫 Refund ${index}/15 blocked: ${error.reason}`);
        this.stats.blocked++;
      }
      this.stats.totalExecutions++;
    }
  }

  /**
   * Run full demo - executes all scenarios in sequence
   */
  async runFullDemo(): Promise<void> {
    console.log(`\n🎬 Starting Full Demo`);
    console.log(`This will execute all 7 scenarios with delays for observation\n`);

    const scenarios = [
      { name: 'Happy Path', delay: 3000 },
      { name: 'Approval Required', delay: 5000 },
      { name: 'High Value Approval', delay: 5000 },
      { name: 'High Value Block', delay: 3000 },
      { name: 'Pattern Violation', delay: 3000 },
      { name: 'SQL Injection Attempt', delay: 3000 },
    ];

    for (let i = 0; i < scenarios.length; i++) {
      console.log(`\n📍 Scenario ${i + 1}/${scenarios.length}`);
      const scenarioConfig = scenarios[i];

      // Find scenario by name
      const { scenarios: allScenarios } = await import('./scenarios');
      const scenario = allScenarios.find(s => s.name === scenarioConfig.name);

      if (scenario) {
        await this.processRefund(scenario);

        // Wait between scenarios
        if (i < scenarios.length - 1) {
          console.log(`\n⏸️  Pausing ${scenarioConfig.delay}ms before next scenario...`);
          await this.sleep(scenarioConfig.delay);
        }
      }
    }

    // Run rate limit test last
    console.log(`\n⏸️  Pausing 5000ms before rate limit test...`);
    await this.sleep(5000);
    await this.runRateLimitTest();

    console.log(`\n🎬 Full Demo Completed!`);
    this.printFinalStats();
  }

  /**
   * Start continuous demo mode
   * Runs random scenarios at intervals
   */
  startContinuous(minInterval: number = 10000, maxInterval: number = 30000): void {
    if (this.running) {
      console.log(`Agent already running`);
      return;
    }

    this.running = true;
    console.log(`\n🚀 Starting continuous demo mode`);
    console.log(`Interval: ${minInterval}ms - ${maxInterval}ms\n`);

    const runNextScenario = async () => {
      if (!this.running) return;

      const scenario = getRandomScenario();
      await this.processRefund(scenario);

      if (this.running) {
        const nextInterval = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;
        console.log(`\n⏳ Next execution in ${nextInterval}ms...`);
        this.currentInterval = setTimeout(runNextScenario, nextInterval);
      }
    };

    runNextScenario();
  }

  /**
   * Stop continuous mode
   */
  stop(): void {
    if (!this.running) {
      console.log(`Agent not running`);
      return;
    }

    this.running = false;
    if (this.currentInterval) {
      clearTimeout(this.currentInterval);
      this.currentInterval = undefined;
    }

    console.log(`\n🛑 Agent stopped`);
    this.printFinalStats();
  }

  /**
   * Get current stats
   */
  getStats(): AgentStats {
    return { ...this.stats };
  }

  /**
   * Print current stats
   */
  private printStats(): void {
    console.log(`\n📊 Stats: Total: ${this.stats.totalExecutions} | Success: ${this.stats.successful} | Blocked: ${this.stats.blocked} | Awaiting: ${this.stats.awaitingApproval} | Failed: ${this.stats.failed}`);
  }

  /**
   * Print final stats with percentages
   */
  private printFinalStats(): void {
    const total = this.stats.totalExecutions;
    const successRate = total > 0 ? ((this.stats.successful / total) * 100).toFixed(1) : '0.0';

    console.log(`\n╔════════════════════════════════════╗`);
    console.log(`║       Agent Statistics             ║`);
    console.log(`╠════════════════════════════════════╣`);
    console.log(`║ Total Executions: ${total.toString().padStart(16)} ║`);
    console.log(`║ Successful:       ${this.stats.successful.toString().padStart(16)} ║`);
    console.log(`║ Blocked:          ${this.stats.blocked.toString().padStart(16)} ║`);
    console.log(`║ Awaiting Approval:${this.stats.awaitingApproval.toString().padStart(16)} ║`);
    console.log(`║ Failed:           ${this.stats.failed.toString().padStart(16)} ║`);
    console.log(`║ Success Rate:     ${successRate.padStart(15)}% ║`);
    console.log(`╚════════════════════════════════════╝`);
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
