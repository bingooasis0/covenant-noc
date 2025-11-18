const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    console.log('\n=== User Account Management ===\n');
    
    // List all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (users.length === 0) {
      console.log('No users found in database.\n');
      console.log('You can register a new account at: http://localhost:3001');
      await prisma.$disconnect();
      rl.close();
      return;
    }

    console.log('Existing users:\n');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.role})`);
      if (user.firstName || user.lastName) {
        console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`.trim());
      }
      console.log(`   Created: ${user.createdAt.toLocaleString()}\n`);
    });

    const action = await question('\nWhat would you like to do?\n1. Reset password for a user\n2. Create new user\n3. Exit\n\nEnter choice (1-3): ');

    if (action === '1') {
      const email = await question('\nEnter email address to reset password: ');
      
      const user = await prisma.user.findUnique({
        where: { email: email.trim() }
      });

      if (!user) {
        console.log(`\n❌ User with email "${email}" not found.`);
        await prisma.$disconnect();
        rl.close();
        return;
      }

      const newPassword = await question('Enter new password (min 6 characters): ');
      
      if (newPassword.length < 6) {
        console.log('\n❌ Password must be at least 6 characters.');
        await prisma.$disconnect();
        rl.close();
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await prisma.user.update({
        where: { email: email.trim() },
        data: { password: hashedPassword }
      });

      console.log(`\n✅ Password reset successfully for ${email}!`);
      console.log(`\nYou can now login with:\nEmail: ${email}\nPassword: ${newPassword}\n`);

    } else if (action === '2') {
      const email = await question('\nEnter email address: ');
      const password = await question('Enter password (min 6 characters): ');
      const firstName = await question('Enter first name (optional): ');
      const lastName = await question('Enter last name (optional): ');
      const role = await question('Enter role (user/admin, default: user): ') || 'user';

      if (password.length < 6) {
        console.log('\n❌ Password must be at least 6 characters.');
        await prisma.$disconnect();
        rl.close();
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      try {
        const user = await prisma.user.create({
          data: {
            email: email.trim(),
            password: hashedPassword,
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            role: role.trim() || 'user'
          }
        });

        console.log(`\n✅ User created successfully!`);
        console.log(`\nYou can now login with:\nEmail: ${email}\nPassword: ${password}\n`);

      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`\n❌ User with email "${email}" already exists.`);
        } else {
          console.log(`\n❌ Error creating user: ${error.message}`);
        }
      }

    } else {
      console.log('\nExiting...\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();

