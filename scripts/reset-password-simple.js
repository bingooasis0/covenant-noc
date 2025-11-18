const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('\nUsage: node scripts/reset-password-simple.js <email> <new-password>\n');
    console.log('Example: node scripts/reset-password-simple.js colby@covenanttechnology.net mynewpassword\n');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.log('\n❌ Password must be at least 6 characters.\n');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim() }
    });

    if (!user) {
      console.log(`\n❌ User with email "${email}" not found.\n`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { email: email.trim() },
      data: { password: hashedPassword }
    });

    console.log(`\n✅ Password reset successfully for ${email}!`);
    console.log(`\nYou can now login with:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

