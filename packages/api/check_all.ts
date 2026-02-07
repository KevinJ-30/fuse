import prisma from './src/lib/prisma';

async function check() {
  const executions = await prisma.$queryRaw`SELECT COUNT(*) FROM "Execution"` as any[];
  const policies = await prisma.$queryRaw`SELECT COUNT(*) FROM "Policy"` as any[];
  const rules = await prisma.$queryRaw`SELECT COUNT(*) FROM "DetectionRule"` as any[];
  const approvals = await prisma.$queryRaw`SELECT COUNT(*) FROM "ApprovalRequest"` as any[];
  const breakers = await prisma.$queryRaw`SELECT COUNT(*) FROM "Breaker"` as any[];

  console.log('\n📊 Current Database Contents:');
  console.log(`   Executions: ${executions[0].count}`);
  console.log(`   Policies: ${policies[0].count}`);
  console.log(`   Detection Rules: ${rules[0].count}`);
  console.log(`   Approval Requests: ${approvals[0].count}`);
  console.log(`   Breakers: ${breakers[0].count}`);
  console.log('');

  await prisma.$disconnect();
}

check().catch(console.error);
