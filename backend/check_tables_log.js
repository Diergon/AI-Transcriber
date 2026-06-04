const fs = require('fs');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
(async () => {
  try {
    const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;");
    fs.writeFileSync('table_check_result.json', JSON.stringify(tables, null, 2));
  } catch (e) {
    fs.writeFileSync('table_check_error.txt', e.toString());
  } finally {
    await prisma.$disconnect();
  }
})();
