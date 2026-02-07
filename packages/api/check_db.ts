import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const executions = await prisma.execution.count();
    const policies = await prisma.policy.count();
    const rules = await prisma.detectionRule.count();
    const approvals = await prisma.approvalRequest.count();
    const breakers = await prisma.breaker.count();

    console.log('\n📊 Current Database Contents:');
    console.log(`   Executions: ${executions}`);
    console.log(`   Policies: ${policies}`);
    console.log(`   Detection Rules: ${rules}`);
    console.log(`   Approval Requests: ${approvals}`);
    console.log(`   Breakers: ${breakers}`);
    console.log('');

    if (executions > 0 || policies > 0 || rules > 0) {
      console.log('✅ Database has data - you can proceed with the demo!');
      console.log('   (No need to reset)\n');
    } else {
      console.log('⚠️  Database is empty - run: npm run prisma:demo-seed\n');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking database:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDatabase();
