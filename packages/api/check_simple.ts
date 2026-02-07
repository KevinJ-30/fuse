import prisma from './src/lib/prisma';

async function check() {
  const count = await prisma.$queryRaw`SELECT COUNT(*) FROM "Execution"`;
  console.log('Execution count:', count);
  await prisma.$disconnect();
}

check().catch(console.error);
