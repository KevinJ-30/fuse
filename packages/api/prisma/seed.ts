import { PrismaClient, RuleType, RuleSeverity } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with default detection rules...');

  // ===== Rate Limit Rules =====
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

  // ===== Value Threshold Rules =====
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
        threshold: 1000,
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

  // ===== Pattern Match Rules =====
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

  // ===== Time Restriction Rules =====
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
        allowedHours: [9, 17], // 9 AM to 5 PM
        allowedDays: [1, 2, 3, 4, 5], // Monday to Friday
        timezone: 'America/New_York',
      },
    },
  });

  // ===== Protected Resource Rules =====
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

  const count = await prisma.rule.count();
  console.log(`✅ Seeding complete! ${count} rules in database.`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
