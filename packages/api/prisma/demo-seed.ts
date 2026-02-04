import {
  PrismaClient,
  RuleType,
  RuleSeverity,
  PolicyAction,
  ExecutionStatus,
  BreakerScope,
  BreakerStatus,
  ApprovalStatus,
  RollbackStatus,
  CompensationType,
  CompensationStatus
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with comprehensive demo data...');

  // ===== 1. Detection Rules (12 total: 10 existing + 2 new) =====
  console.log('📋 Creating detection rules...');

  // Include all existing rules from seed.ts
  await prisma.rule.upsert({
    where: { id: 'rule_email_rate_limit' },
    update: {},
    create: {
      id: 'rule_email_rate_limit',
      name: 'Email Rate Limit',
      type: RuleType.RATE_LIMIT,
      severity: RuleSeverity.HIGH,
      enabled: true,
      config: {
        tool: 'send_email',
        limit: 100,
        windowMinutes: 60,
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_slack_rate_limit' },
    update: {},
    create: {
      id: 'rule_slack_rate_limit',
      name: 'Slack Message Rate Limit',
      type: RuleType.RATE_LIMIT,
      severity: RuleSeverity.MEDIUM,
      enabled: true,
      config: {
        tool: 'slack_message',
        limit: 200,
        windowMinutes: 60,
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_stripe_refund_threshold' },
    update: {},
    create: {
      id: 'rule_stripe_refund_threshold',
      name: 'Large Refund Threshold',
      type: RuleType.VALUE_THRESHOLD,
      severity: RuleSeverity.CRITICAL,
      enabled: true,
      config: {
        tool: 'stripe_refund',
        field: 'amount',
        operator: 'gt',
        threshold: 5000,
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_stripe_charge_threshold' },
    update: {},
    create: {
      id: 'rule_stripe_charge_threshold',
      name: 'Large Charge Threshold',
      type: RuleType.VALUE_THRESHOLD,
      severity: RuleSeverity.HIGH,
      enabled: true,
      config: {
        tool: 'stripe_charge',
        field: 'amount',
        operator: 'gt',
        threshold: 5000,
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_unfilled_template' },
    update: {},
    create: {
      id: 'rule_unfilled_template',
      name: 'Unfilled Template Variables',
      type: RuleType.PATTERN_MATCH,
      severity: RuleSeverity.HIGH,
      enabled: true,
      config: {
        tool: 'send_email',
        pattern: '\\{[A-Z_]+\\}',
        description: 'Email contains unfilled template variables like {FIRST_NAME}',
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_ssn_detection' },
    update: {},
    create: {
      id: 'rule_ssn_detection',
      name: 'SSN Pattern Detection',
      type: RuleType.PATTERN_MATCH,
      severity: RuleSeverity.CRITICAL,
      enabled: true,
      config: {
        pattern: '\\d{3}-\\d{2}-\\d{4}',
        description: 'Potential Social Security Number detected',
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_credit_card_detection' },
    update: {},
    create: {
      id: 'rule_credit_card_detection',
      name: 'Credit Card Pattern Detection',
      type: RuleType.PATTERN_MATCH,
      severity: RuleSeverity.CRITICAL,
      enabled: true,
      config: {
        pattern: '\\b\\d{16}\\b',
        description: 'Potential credit card number detected',
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_business_hours_email' },
    update: {},
    create: {
      id: 'rule_business_hours_email',
      name: 'External Email Business Hours',
      type: RuleType.TIME_RESTRICTION,
      severity: RuleSeverity.MEDIUM,
      enabled: true,
      config: {
        tool: 'send_email',
        allowedHours: [9, 17],
        allowedDays: [1, 2, 3, 4, 5],
        timezone: 'America/New_York',
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_protected_files' },
    update: {},
    create: {
      id: 'rule_protected_files',
      name: 'Protected File Paths',
      type: RuleType.PROTECTED_RESOURCE,
      severity: RuleSeverity.CRITICAL,
      enabled: true,
      config: {
        tool: 'write_file',
        protectedPatterns: [
          '\\.env',
          '/config/',
          'id_rsa',
          'id_ed25519',
          'private.*key',
          'credentials\\.json',
          '\\.aws/credentials',
        ],
      },
    },
  });

  await prisma.rule.upsert({
    where: { id: 'rule_protected_delete' },
    update: {},
    create: {
      id: 'rule_protected_delete',
      name: 'Protected File Deletion',
      type: RuleType.PROTECTED_RESOURCE,
      severity: RuleSeverity.CRITICAL,
      enabled: true,
      config: {
        tool: 'delete_file',
        protectedPatterns: [
          '/etc/',
          '/bin/',
          '/usr/bin/',
          '\\.git/',
          'package\\.json',
          'package-lock\\.json',
        ],
      },
    },
  });

  // NEW: Medium refund threshold for approval workflow
  await prisma.rule.upsert({
    where: { id: 'rule_medium_refund_threshold' },
    update: {},
    create: {
      id: 'rule_medium_refund_threshold',
      name: 'Medium Refund Threshold',
      type: RuleType.VALUE_THRESHOLD,
      severity: RuleSeverity.HIGH,
      enabled: true,
      config: {
        tool: 'stripe_refund',
        field: 'amount',
        operator: 'gt',
        threshold: 500,
      },
    },
  });

  // NEW: Weekend activity detection
  await prisma.rule.upsert({
    where: { id: 'rule_weekend_activity' },
    update: {},
    create: {
      id: 'rule_weekend_activity',
      name: 'Weekend High-Value Activity',
      type: RuleType.TIME_RESTRICTION,
      severity: RuleSeverity.HIGH,
      enabled: true,
      config: {
        tool: 'stripe_refund',
        allowedDays: [1, 2, 3, 4, 5], // Monday-Friday only
        threshold: 1000, // Block refunds over $1000 on weekends
        timezone: 'America/New_York',
      },
    },
  });

  // ===== 2. Sample Policies (5 custom policies) =====
  console.log('📜 Creating sample policies...');

  await prisma.policy.create({
    data: {
      id: 'policy_weekend_refunds',
      name: 'Block weekend refunds over $1000',
      tool: 'stripe_refund',
      condition: 'amount > 1000 AND isWeekend()',
      action: PolicyAction.DENY,
      enabled: true,
      priority: 1,
    },
  });

  await prisma.policy.create({
    data: {
      id: 'policy_batch_refunds',
      name: 'Require approval for batch refunds',
      tool: 'stripe_refund',
      condition: 'batch_size > 10',
      action: PolicyAction.REQUIRE_APPROVAL,
      enabled: true,
      priority: 2,
    },
  });

  await prisma.policy.create({
    data: {
      id: 'policy_foreign_refunds',
      name: 'Block refunds to foreign accounts',
      tool: 'stripe_refund',
      condition: 'account_country != "US"',
      action: PolicyAction.DENY,
      enabled: true,
      priority: 3,
    },
  });

  await prisma.policy.create({
    data: {
      id: 'policy_pii_in_notes',
      name: 'Flag refunds with PII in reason field',
      tool: 'stripe_refund',
      condition: 'reason MATCHES "(\\d{3}-\\d{2}-\\d{4}|\\d{16})"',
      action: PolicyAction.DENY,
      enabled: true,
      priority: 1,
    },
  });

  await prisma.policy.create({
    data: {
      id: 'policy_customer_rate_limit',
      name: 'Rate limit per customer (max 3 refunds/day)',
      tool: 'stripe_refund',
      condition: 'customerRefundCount(24h) >= 3',
      action: PolicyAction.REQUIRE_APPROVAL,
      enabled: true,
      priority: 4,
    },
  });

  // ===== 3. Historical Executions (30 executions) =====
  console.log('📊 Creating historical executions...');

  const now = new Date();
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

  // Successful execution chain 1: verify → check → refund → email (4 executions)
  const exec1 = await prisma.execution.create({
    data: {
      id: 'exec_verify_001',
      agentId: 'customer_service_agent_01',
      tool: 'verify_customer',
      input: { customerId: 'cus_abc123', email: 'alice@example.com' },
      output: { verified: true, name: 'Alice Johnson' },
      status: ExecutionStatus.COMPLETED,
      riskScore: 0.12,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(48),
      completedAt: hoursAgo(48),
    },
  });

  const exec2 = await prisma.execution.create({
    data: {
      id: 'exec_check_001',
      agentId: 'customer_service_agent_01',
      tool: 'check_refund_eligibility',
      input: { orderId: 'ord_xyz789', customerId: 'cus_abc123' },
      output: { eligible: true, reason: 'Within 30-day return window' },
      status: ExecutionStatus.COMPLETED,
      parentId: exec1.id,
      riskScore: 0.15,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(48),
      completedAt: hoursAgo(48),
    },
  });

  const exec3 = await prisma.execution.create({
    data: {
      id: 'exec_refund_001',
      agentId: 'customer_service_agent_01',
      tool: 'stripe_refund',
      input: { amount: 4950, customerId: 'cus_abc123', orderId: 'ord_xyz789', reason: 'Product defect' },
      output: { refundId: 're_001', status: 'succeeded', amount: 4950 },
      status: ExecutionStatus.COMPLETED,
      parentId: exec2.id,
      previousState: { balance: 10000, refunded: 0 },
      riskScore: 0.68,
      detectionFlags: {
        ruleViolations: [],
        anomalies: ['High-value transaction'],
        semanticConcerns: []
      },
      startedAt: hoursAgo(48),
      completedAt: hoursAgo(47.9),
    },
  });

  const exec4 = await prisma.execution.create({
    data: {
      id: 'exec_email_001',
      agentId: 'customer_service_agent_01',
      tool: 'send_email',
      input: {
        to: 'alice@example.com',
        subject: 'Refund Processed',
        body: 'Your refund of $49.50 has been processed.'
      },
      output: { messageId: 'msg_001', sent: true },
      status: ExecutionStatus.COMPLETED,
      parentId: exec3.id,
      riskScore: 0.08,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(47.9),
      completedAt: hoursAgo(47.8),
    },
  });

  // Successful small refunds (10 executions)
  for (let i = 0; i < 10; i++) {
    await prisma.execution.create({
      data: {
        id: `exec_small_refund_${i}`,
        agentId: 'customer_service_agent_01',
        tool: 'stripe_refund',
        input: {
          amount: Math.floor(Math.random() * 5000) + 1000,
          customerId: `cus_demo_${i}`,
          reason: 'Customer request'
        },
        output: { refundId: `re_${i}`, status: 'succeeded' },
        status: ExecutionStatus.COMPLETED,
        riskScore: Math.random() * 0.3,
        detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
        startedAt: hoursAgo(24 + i),
        completedAt: hoursAgo(24 + i - 0.1),
      },
    });
  }

  // Blocked executions (5 executions with varied reasons)
  await prisma.execution.create({
    data: {
      id: 'exec_blocked_001',
      agentId: 'customer_service_agent_01',
      tool: 'stripe_refund',
      input: { amount: 750000, customerId: 'cus_high_value', reason: 'Requested refund' },
      output: null,
      status: ExecutionStatus.BLOCKED,
      riskScore: 0.98,
      detectionFlags: {
        ruleViolations: ['Large Refund Threshold exceeded: $7500 > $5000'],
        anomalies: ['Extreme value detected'],
        semanticConcerns: []
      },
      startedAt: hoursAgo(12),
      completedAt: hoursAgo(12),
    },
  });

  await prisma.execution.create({
    data: {
      id: 'exec_blocked_002',
      agentId: 'data_processing_agent',
      tool: 'delete_file',
      input: { path: '/etc/passwd' },
      output: null,
      status: ExecutionStatus.BLOCKED,
      riskScore: 0.99,
      detectionFlags: {
        ruleViolations: ['Protected File Deletion: /etc/ is protected'],
        anomalies: [],
        semanticConcerns: ['Critical system file modification']
      },
      startedAt: hoursAgo(10),
      completedAt: hoursAgo(10),
    },
  });

  await prisma.execution.create({
    data: {
      id: 'exec_blocked_003',
      agentId: 'email_agent',
      tool: 'send_email',
      input: { to: 'customer@example.com', subject: 'Welcome', body: 'Hi {FIRST_NAME}, welcome!' },
      output: null,
      status: ExecutionStatus.BLOCKED,
      riskScore: 0.72,
      detectionFlags: {
        ruleViolations: ['Unfilled Template Variables detected'],
        anomalies: [],
        semanticConcerns: []
      },
      startedAt: hoursAgo(8),
      completedAt: hoursAgo(8),
    },
  });

  await prisma.execution.create({
    data: {
      id: 'exec_blocked_004',
      agentId: 'customer_service_agent_02',
      tool: 'stripe_refund',
      input: { amount: 25000, customerId: 'cus_abc', reason: 'SSN: 123-45-6789' },
      output: null,
      status: ExecutionStatus.BLOCKED,
      riskScore: 0.95,
      detectionFlags: {
        ruleViolations: ['SSN Pattern Detection: Potential SSN detected'],
        anomalies: [],
        semanticConcerns: ['PII leakage detected']
      },
      startedAt: hoursAgo(6),
      completedAt: hoursAgo(6),
    },
  });

  await prisma.execution.create({
    data: {
      id: 'exec_blocked_005',
      agentId: 'fraud_detection_agent',
      tool: 'database_query',
      input: { query: 'SELECT * FROM users WHERE active = 1' },
      output: null,
      status: ExecutionStatus.BLOCKED,
      riskScore: 0.88,
      detectionFlags: {
        ruleViolations: [],
        anomalies: ['Agent breaker active'],
        semanticConcerns: []
      },
      startedAt: hoursAgo(4),
      completedAt: hoursAgo(4),
    },
  });

  // Failed executions (2 executions)
  await prisma.execution.create({
    data: {
      id: 'exec_failed_001',
      agentId: 'customer_service_agent_01',
      tool: 'stripe_refund',
      input: { amount: 5000, customerId: 'cus_invalid', reason: 'Test refund' },
      output: { error: 'Customer not found', code: 'resource_missing' },
      status: ExecutionStatus.FAILED,
      riskScore: 0.45,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(2),
      completedAt: hoursAgo(2),
    },
  });

  await prisma.execution.create({
    data: {
      id: 'exec_failed_002',
      agentId: 'email_agent',
      tool: 'send_email',
      input: { to: 'invalid-email', subject: 'Test', body: 'Test' },
      output: { error: 'Invalid email address', code: 'invalid_request' },
      status: ExecutionStatus.FAILED,
      riskScore: 0.15,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(1),
      completedAt: hoursAgo(1),
    },
  });

  // Awaiting approval executions (3 pending approvals - created separately below)
  const execApproval1 = await prisma.execution.create({
    data: {
      id: 'exec_approval_001',
      agentId: 'customer_service_agent_01',
      tool: 'stripe_refund',
      input: { amount: 45000, customerId: 'cus_vip_001', reason: 'VIP customer complaint' },
      output: null,
      status: ExecutionStatus.AWAITING_APPROVAL,
      riskScore: 0.72,
      detectionFlags: {
        ruleViolations: [],
        anomalies: ['Medium-high value transaction'],
        semanticConcerns: []
      },
      startedAt: hoursAgo(0.5),
      completedAt: null,
    },
  });

  const execApproval2 = await prisma.execution.create({
    data: {
      id: 'exec_approval_002',
      agentId: 'customer_service_agent_02',
      tool: 'stripe_refund',
      input: { amount: 520000, customerId: 'cus_corporate', reason: 'Enterprise contract dispute' },
      output: null,
      status: ExecutionStatus.AWAITING_APPROVAL,
      riskScore: 0.88,
      detectionFlags: {
        ruleViolations: ['Medium Refund Threshold exceeded: $5200 > $500'],
        anomalies: ['Very high value'],
        semanticConcerns: ['Requires executive approval']
      },
      startedAt: hoursAgo(0.3),
      completedAt: null,
    },
  });

  const execApproval3 = await prisma.execution.create({
    data: {
      id: 'exec_approval_003',
      agentId: 'email_agent',
      tool: 'send_email',
      input: {
        to: 'newsletter@example.com',
        subject: 'Monthly Update',
        batchSize: 25,
        body: 'Newsletter content...'
      },
      output: null,
      status: ExecutionStatus.AWAITING_APPROVAL,
      riskScore: 0.65,
      detectionFlags: {
        ruleViolations: [],
        anomalies: ['Batch operation detected'],
        semanticConcerns: []
      },
      startedAt: hoursAgo(0.2),
      completedAt: null,
    },
  });

  // Rolled back execution (2 executions - part of rollback history below)
  const execRollback1 = await prisma.execution.create({
    data: {
      id: 'exec_rollback_001',
      agentId: 'customer_service_agent_01',
      tool: 'stripe_refund',
      input: { amount: 15000, customerId: 'cus_mistake', reason: 'Wrong customer' },
      output: { refundId: 're_mistake', status: 'succeeded', amount: 15000 },
      status: ExecutionStatus.ROLLED_BACK,
      previousState: { balance: 20000, refunded: 0 },
      riskScore: 0.35,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(72),
      completedAt: hoursAgo(71.9),
    },
  });

  const execRollback2Parent = await prisma.execution.create({
    data: {
      id: 'exec_rollback_002_parent',
      agentId: 'customer_service_agent_02',
      tool: 'verify_customer',
      input: { customerId: 'cus_tree_test' },
      output: { verified: true },
      status: ExecutionStatus.ROLLED_BACK,
      riskScore: 0.10,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(96),
      completedAt: hoursAgo(96),
    },
  });

  const execRollback2Child1 = await prisma.execution.create({
    data: {
      id: 'exec_rollback_002_child1',
      agentId: 'customer_service_agent_02',
      tool: 'stripe_refund',
      input: { amount: 10000, customerId: 'cus_tree_test' },
      output: { refundId: 're_tree1', status: 'succeeded' },
      status: ExecutionStatus.ROLLED_BACK,
      parentId: execRollback2Parent.id,
      previousState: { balance: 15000, refunded: 0 },
      riskScore: 0.40,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(96),
      completedAt: hoursAgo(95.9),
    },
  });

  const execRollback2Child2 = await prisma.execution.create({
    data: {
      id: 'exec_rollback_002_child2',
      agentId: 'customer_service_agent_02',
      tool: 'send_email',
      input: { to: 'customer@example.com', subject: 'Refund notice' },
      output: { messageId: 'msg_tree1', sent: true },
      status: ExecutionStatus.ROLLED_BACK,
      parentId: execRollback2Parent.id,
      riskScore: 0.12,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(95.9),
      completedAt: hoursAgo(95.8),
    },
  });

  const execRollback2Child3 = await prisma.execution.create({
    data: {
      id: 'exec_rollback_002_child3',
      agentId: 'customer_service_agent_02',
      tool: 'update_database',
      input: { table: 'orders', id: 'ord_tree', status: 'refunded' },
      output: { updated: true },
      status: ExecutionStatus.ROLLED_BACK,
      parentId: execRollback2Child1.id,
      previousState: { status: 'completed' },
      riskScore: 0.25,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(95.8),
      completedAt: hoursAgo(95.7),
    },
  });

  const execRollback2Child4 = await prisma.execution.create({
    data: {
      id: 'exec_rollback_002_child4',
      agentId: 'customer_service_agent_02',
      tool: 'log_action',
      input: { action: 'refund_processed', orderId: 'ord_tree' },
      output: { logged: true },
      status: ExecutionStatus.ROLLED_BACK,
      parentId: execRollback2Child1.id,
      riskScore: 0.05,
      detectionFlags: { ruleViolations: [], anomalies: [], semanticConcerns: [] },
      startedAt: hoursAgo(95.7),
      completedAt: hoursAgo(95.6),
    },
  });

  // ===== 4. Emergency Stop Breakers (3 breakers) =====
  console.log('🚨 Creating emergency stop breakers...');

  await prisma.breaker.create({
    data: {
      id: 'breaker_global',
      scope: BreakerScope.GLOBAL,
      target: null,
      status: BreakerStatus.INACTIVE,
      reason: 'Emergency stop - system-wide halt for critical incident',
    },
  });

  await prisma.breaker.create({
    data: {
      id: 'breaker_agent_fraud',
      scope: BreakerScope.AGENT,
      target: 'fraud_detection_agent',
      status: BreakerStatus.ACTIVE,
      reason: 'Suspected malicious behavior - agent temporarily disabled',
    },
  });

  await prisma.breaker.create({
    data: {
      id: 'breaker_tool_delete',
      scope: BreakerScope.TOOL,
      target: 'database_delete',
      status: BreakerStatus.ACTIVE,
      reason: 'High-risk tool disabled pending security review',
    },
  });

  // ===== 5. Approval Requests (3 pending) =====
  console.log('✋ Creating pending approval requests...');

  await prisma.approvalRequest.create({
    data: {
      id: 'approval_001',
      executionId: execApproval1.id,
      status: ApprovalStatus.PENDING,
      riskScore: 0.72,
      riskBreakdown: {
        ruleScore: 0.0,
        anomalyScore: 0.65,
        semanticScore: 0.15,
        totalScore: 0.72,
        components: {
          valueAnomaly: 0.45,
          frequencyAnomaly: 0.20,
          contextRisk: 0.15,
        },
      },
      detectionFlags: {
        ruleViolations: [],
        anomalies: ['Medium-high value transaction: $450'],
        semanticConcerns: [],
      },
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  await prisma.approvalRequest.create({
    data: {
      id: 'approval_002',
      executionId: execApproval2.id,
      status: ApprovalStatus.PENDING,
      riskScore: 0.88,
      riskBreakdown: {
        ruleScore: 0.80,
        anomalyScore: 0.85,
        semanticScore: 0.45,
        totalScore: 0.88,
        components: {
          thresholdExceeded: 0.80,
          extremeValue: 0.85,
          requiresExecutiveApproval: 0.45,
        },
      },
      detectionFlags: {
        ruleViolations: ['Medium Refund Threshold exceeded: $5200 > $500'],
        anomalies: ['Very high value: $5200'],
        semanticConcerns: ['Requires executive approval for enterprise contracts'],
      },
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  await prisma.approvalRequest.create({
    data: {
      id: 'approval_003',
      executionId: execApproval3.id,
      status: ApprovalStatus.PENDING,
      riskScore: 0.65,
      riskBreakdown: {
        ruleScore: 0.0,
        anomalyScore: 0.70,
        semanticScore: 0.20,
        totalScore: 0.65,
        components: {
          batchOperation: 0.70,
          volumeRisk: 0.20,
        },
      },
      detectionFlags: {
        ruleViolations: [],
        anomalies: ['Batch operation detected: 25 recipients'],
        semanticConcerns: [],
      },
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  // ===== 6. Rollback History (2 completed rollbacks) =====
  console.log('🔄 Creating rollback history...');

  // Rollback 1: Single execution rollback with 1 compensation
  const rollback1 = await prisma.rollback.create({
    data: {
      id: 'rollback_001',
      targetExecutionId: execRollback1.id,
      status: RollbackStatus.COMPLETED,
      affectedCount: 1,
      generatedCount: 1,
      executedCount: 1,
      failedCount: 0,
      initiatedBy: 'admin@company.com',
      completedAt: hoursAgo(70),
    },
  });

  await prisma.compensation.create({
    data: {
      id: 'comp_001',
      rollbackId: rollback1.id,
      executionId: execRollback1.id,
      type: CompensationType.AUTO_REVERSE,
      tool: 'stripe_charge',
      input: {
        amount: 15000,
        customerId: 'cus_mistake',
        description: 'Reversal of incorrect refund'
      },
      output: { chargeId: 'ch_reversal_001', status: 'succeeded' },
      description: 'Reverse incorrect refund by charging the customer back',
      riskLevel: 'LOW',
      status: CompensationStatus.COMPLETED,
      executedAt: hoursAgo(70),
    },
  });

  // Rollback 2: Tree rollback with 5 compensations (3 auto-reversed, 2 manual)
  const rollback2 = await prisma.rollback.create({
    data: {
      id: 'rollback_002',
      targetExecutionId: execRollback2Parent.id,
      status: RollbackStatus.COMPLETED,
      affectedCount: 5,
      generatedCount: 5,
      executedCount: 3,
      failedCount: 0,
      initiatedBy: 'support@company.com',
      completedAt: hoursAgo(90),
    },
  });

  // Auto-reverse compensations
  await prisma.compensation.create({
    data: {
      id: 'comp_002_auto1',
      rollbackId: rollback2.id,
      executionId: execRollback2Child1.id,
      type: CompensationType.AUTO_REVERSE,
      tool: 'stripe_charge',
      input: {
        amount: 10000,
        customerId: 'cus_tree_test',
        description: 'Reverse test refund'
      },
      output: { chargeId: 'ch_tree_rev1', status: 'succeeded' },
      description: 'Reverse the $100 refund',
      riskLevel: 'LOW',
      status: CompensationStatus.COMPLETED,
      executedAt: hoursAgo(90),
    },
  });

  await prisma.compensation.create({
    data: {
      id: 'comp_002_auto2',
      rollbackId: rollback2.id,
      executionId: execRollback2Child3.id,
      type: CompensationType.AUTO_REVERSE,
      tool: 'update_database',
      input: {
        table: 'orders',
        id: 'ord_tree',
        status: 'completed'
      },
      output: { updated: true },
      description: 'Restore order status to "completed"',
      riskLevel: 'LOW',
      status: CompensationStatus.COMPLETED,
      executedAt: hoursAgo(90),
    },
  });

  await prisma.compensation.create({
    data: {
      id: 'comp_002_auto3',
      rollbackId: rollback2.id,
      executionId: execRollback2Child4.id,
      type: CompensationType.AUTO_REVERSE,
      tool: 'log_action',
      input: {
        action: 'refund_rolled_back',
        orderId: 'ord_tree'
      },
      output: { logged: true },
      description: 'Log the rollback action',
      riskLevel: 'LOW',
      status: CompensationStatus.COMPLETED,
      executedAt: hoursAgo(90),
    },
  });

  // Manual/suggested compensations
  await prisma.compensation.create({
    data: {
      id: 'comp_002_manual1',
      rollbackId: rollback2.id,
      executionId: execRollback2Child2.id,
      type: CompensationType.MANUAL_REQUIRED,
      tool: 'send_email',
      input: {
        to: 'customer@example.com',
        subject: 'Correction Notice',
        body: 'We need to correct a previous transaction...'
      },
      output: null,
      description: 'Send correction notice to customer (requires manual review of email content)',
      riskLevel: 'MEDIUM',
      status: CompensationStatus.PENDING,
      executedAt: null,
    },
  });

  await prisma.compensation.create({
    data: {
      id: 'comp_002_manual2',
      rollbackId: rollback2.id,
      executionId: execRollback2Parent.id,
      type: CompensationType.SUGGESTED,
      tool: 'notify_support',
      input: {
        message: 'Customer verification was rolled back - please review account',
        customerId: 'cus_tree_test'
      },
      output: null,
      description: 'Notify support team of rollback (suggested action)',
      riskLevel: 'LOW',
      status: CompensationStatus.PENDING,
      executedAt: null,
    },
  });

  // ===== Summary =====
  const ruleCount = await prisma.rule.count();
  const policyCount = await prisma.policy.count();
  const executionCount = await prisma.execution.count();
  const breakerCount = await prisma.breaker.count();
  const approvalCount = await prisma.approvalRequest.count();
  const rollbackCount = await prisma.rollback.count();
  const compensationCount = await prisma.compensation.count();

  console.log('\n✅ Demo seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Detection Rules:      ${ruleCount}`);
  console.log(`📜 Policies:             ${policyCount}`);
  console.log(`📊 Executions:           ${executionCount}`);
  console.log(`   ✅ Completed:         15`);
  console.log(`   ⏳ Awaiting Approval: 3`);
  console.log(`   🚫 Blocked:           5`);
  console.log(`   ❌ Failed:            2`);
  console.log(`   🔄 Rolled Back:       5`);
  console.log(`🚨 Breakers:             ${breakerCount} (2 active, 1 inactive)`);
  console.log(`✋ Approval Requests:    ${approvalCount} (all pending)`);
  console.log(`🔄 Rollbacks:            ${rollbackCount} (both completed)`);
  console.log(`   Compensations:       ${compensationCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🎉 Your Fuse demo environment is ready!');
  console.log('\n🚀 Next steps:');
  console.log('   1. Start the API: cd packages/api && npm run dev');
  console.log('   2. Start the web: cd packages/web && npm run dev');
  console.log('   3. Start the demo agent: cd packages/demo-agent && npm start');
  console.log('   4. Visit http://localhost:5173/demo to run the demo\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
