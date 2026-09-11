import { prisma } from './src/config/database.js';

async function verify() {
  try {
    const count = await prisma.task.count();
    console.log(`Task count: ${count}`);
    console.log('Database connection successful!');

    // Test a few more queries
    const userCount = await prisma.user.count();
    console.log(`User count: ${userCount}`);

    const projectCount = await prisma.project.count();
    console.log(`Project count: ${projectCount}`);

    console.log('All queries successful!');
  } catch (error) {
    console.error('Database verification failed:', error);
    process.exit(1);
  }
}

verify();