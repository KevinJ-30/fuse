import { Router } from 'express';
import { getDemoAgent, isAgentRunning } from '../services/demo-agent.service';
import { getScenarioByName } from '../../../demo-agent/src/scenarios';

const router = Router();

/**
 * POST /api/demo/refund
 * Trigger refund scenario from customer portal
 */
router.post('/refund', async (req, res) => {
  try {
    const { orderId, amount, reason, customerId } = req.body;

    // Validate required fields
    if (!orderId || !amount || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: orderId, amount, reason',
      });
    }

    const agent = getDemoAgent();

    // Create scenario from request
    const scenario = {
      name: 'Customer Request',
      description: `Refund for order ${orderId}`,
      customerId: customerId || `cus_${orderId}`,
      orderId,
      amount: parseFloat(amount),
      reason,
      expectedOutcome: (amount < 100 ? 'auto-approved' :
                        amount < 500 ? 'requires-approval' : 'blocked') as 'auto-approved' | 'requires-approval' | 'blocked',
    };

    // Execute asynchronously (don't await)
    agent.processRefund(scenario).catch(err => {
      console.error('Error processing refund:', err);
    });

    res.json({
      success: true,
      message: 'Refund processing started',
      orderId,
      amount: scenario.amount,
    });
  } catch (error) {
    console.error('Error starting refund:', error);
    res.status(500).json({ error: 'Failed to start refund' });
  }
});

/**
 * POST /api/demo/scenario
 * Trigger pre-defined scenario by name
 */
router.post('/scenario', async (req, res) => {
  try {
    const { scenarioName } = req.body;

    if (!scenarioName) {
      return res.status(400).json({ error: 'Missing scenarioName' });
    }

    const scenario = getScenarioByName(scenarioName);
    if (!scenario) {
      return res.status(404).json({ error: `Scenario not found: ${scenarioName}` });
    }

    const agent = getDemoAgent();

    // Execute asynchronously (don't await)
    agent.processRefund(scenario).catch(err => {
      console.error('Error processing scenario:', err);
    });

    res.json({
      success: true,
      message: `Scenario "${scenarioName}" started`,
      scenario: {
        name: scenario.name,
        description: scenario.description,
        amount: scenario.amount,
      },
    });
  } catch (error) {
    console.error('Error starting scenario:', error);
    res.status(500).json({ error: 'Failed to start scenario' });
  }
});

/**
 * POST /api/demo/rate-limit-test
 * Trigger rate limit test (burst of 15 refunds)
 */
router.post('/rate-limit-test', async (req, res) => {
  try {
    const agent = getDemoAgent();

    // Execute asynchronously (don't await)
    agent.runRateLimitTest().catch(err => {
      console.error('Error running rate limit test:', err);
    });

    res.json({
      success: true,
      message: 'Rate limit test started (15 refunds)',
    });
  } catch (error) {
    console.error('Error starting rate limit test:', error);
    res.status(500).json({ error: 'Failed to start rate limit test' });
  }
});

/**
 * POST /api/demo/full-demo
 * Run full demo (all scenarios in sequence)
 */
router.post('/full-demo', async (req, res) => {
  try {
    const agent = getDemoAgent();

    // Execute asynchronously (don't await)
    agent.runFullDemo().catch(err => {
      console.error('Error running full demo:', err);
    });

    res.json({
      success: true,
      message: 'Full demo started (all 7 scenarios)',
    });
  } catch (error) {
    console.error('Error starting full demo:', error);
    res.status(500).json({ error: 'Failed to start full demo' });
  }
});

/**
 * POST /api/demo/start
 * Start agent in continuous mode
 */
router.post('/start', async (req, res) => {
  try {
    const { minInterval = 10000, maxInterval = 30000 } = req.body;

    const agent = getDemoAgent();
    agent.startContinuous(minInterval, maxInterval);

    res.json({
      success: true,
      running: true,
      message: 'Agent started in continuous mode',
      config: { minInterval, maxInterval },
    });
  } catch (error) {
    console.error('Error starting agent:', error);
    res.status(500).json({ error: 'Failed to start agent' });
  }
});

/**
 * POST /api/demo/stop
 * Stop agent
 */
router.post('/stop', async (req, res) => {
  try {
    const agent = getDemoAgent();
    agent.stop();

    res.json({
      success: true,
      running: false,
      message: 'Agent stopped',
    });
  } catch (error) {
    console.error('Error stopping agent:', error);
    res.status(500).json({ error: 'Failed to stop agent' });
  }
});

/**
 * GET /api/demo/status
 * Get agent status and stats
 */
router.get('/status', async (req, res) => {
  try {
    const running = isAgentRunning();
    const agent = getDemoAgent();
    const stats = agent.getStats();

    res.json({
      running,
      stats: {
        totalExecutions: stats.totalExecutions,
        successful: stats.successful,
        failed: stats.failed,
        blocked: stats.blocked,
        awaitingApproval: stats.awaitingApproval,
        startTime: stats.startTime,
      },
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
