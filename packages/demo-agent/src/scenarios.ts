/**
 * Pre-defined test scenarios for demo agent
 * Each scenario demonstrates different Fuse features
 */

export interface RefundScenario {
  name: string;
  description: string;
  customerId: string;
  orderId: string;
  amount: number;
  reason: string;
  expectedOutcome: 'auto-approved' | 'requires-approval' | 'blocked';
  delay?: number; // Milliseconds to wait before execution
}

export const scenarios: RefundScenario[] = [
  {
    name: 'Happy Path',
    description: 'Small refund that auto-approves',
    customerId: 'cus_happy_12345',
    orderId: 'ord_12345',
    amount: 50,
    reason: 'Product arrived damaged',
    expectedOutcome: 'auto-approved',
    delay: 0,
  },
  {
    name: 'Approval Required',
    description: 'Medium refund requiring human review',
    customerId: 'cus_medium_67890',
    orderId: 'ord_67890',
    amount: 350,
    reason: 'Customer not satisfied with product quality',
    expectedOutcome: 'requires-approval',
    delay: 2000,
  },
  {
    name: 'High Value Approval',
    description: 'Large refund with warnings',
    customerId: 'cus_large_11111',
    orderId: 'ord_11111',
    amount: 750,
    reason: 'Wrong item shipped, customer wants refund',
    expectedOutcome: 'requires-approval',
    delay: 2000,
  },
  {
    name: 'Rate Limit Test',
    description: 'Burst of refunds to trigger rate limiting',
    customerId: 'cus_burst_22222',
    orderId: 'ord_22222',
    amount: 25,
    reason: 'Bulk refund test',
    expectedOutcome: 'auto-approved', // First few succeed
    delay: 100,
  },
  {
    name: 'High Value Block',
    description: 'Extremely high value refund that gets blocked',
    customerId: 'cus_extreme_33333',
    orderId: 'ord_33333',
    amount: 6000,
    reason: 'Customer claims product was defective',
    expectedOutcome: 'blocked',
    delay: 2000,
  },
  {
    name: 'Pattern Violation',
    description: 'Refund with PII in notes (SSN pattern)',
    customerId: 'cus_pii_44444',
    orderId: 'ord_44444',
    amount: 100,
    reason: 'Customer SSN: 123-45-6789 for verification',
    expectedOutcome: 'blocked',
    delay: 2000,
  },
  {
    name: 'SQL Injection Attempt',
    description: 'Malicious pattern in refund reason',
    customerId: 'cus_sql_55555',
    orderId: 'ord_55555',
    amount: 50,
    reason: "Product issue'; DROP TABLE users; --",
    expectedOutcome: 'blocked',
    delay: 2000,
  },
];

export function getRandomScenario(): RefundScenario {
  // Weighted random selection (favor safe operations)
  const weights = [
    50, // Happy Path (50% chance)
    20, // Approval Required (20%)
    10, // High Value Approval (10%)
    5,  // Rate Limit Test (5%)
    5,  // High Value Block (5%)
    5,  // Pattern Violation (5%)
    5,  // SQL Injection (5%)
  ];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < scenarios.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return scenarios[i];
    }
  }

  return scenarios[0]; // Fallback to happy path
}

export function getScenarioByName(name: string): RefundScenario | undefined {
  return scenarios.find(s => s.name === name);
}
