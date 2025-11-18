/**
 * Kill all processes using ports 3000 and 3001
 * Run this before starting the dev server to avoid port conflicts
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function killPort(port) {
  try {
    // Windows command to find processes using the port
    const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
    
    if (!stdout.trim()) {
      console.log(`✓ Port ${port} is free`);
      return;
    }

    // Extract PIDs from output
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const match = line.match(/\s+(\d+)\s*$/);
      if (match) {
        pids.add(match[1]);
      }
    });

    if (pids.size === 0) {
      console.log(`✓ Port ${port} is free`);
      return;
    }

    // Kill each process
    for (const pid of pids) {
      try {
        await execPromise(`taskkill /PID ${pid} /F`);
        console.log(`✓ Killed process ${pid} on port ${port}`);
      } catch (err) {
        // Process might already be dead, ignore
        console.log(`  Process ${pid} already terminated`);
      }
    }
  } catch (error) {
    // No processes found or port is free
    if (error.message.includes('findstr')) {
      console.log(`✓ Port ${port} is free`);
    } else {
      console.error(`Error checking port ${port}:`, error.message);
    }
  }
}

async function main() {
  console.log('🔪 Killing processes on ports 3000 and 3001...\n');
  
  await killPort(3000);
  await killPort(3001);
  
  console.log('\n✅ Done! Ports should be free now.');
  console.log('You can now run: npm run dev\n');
}

main();

