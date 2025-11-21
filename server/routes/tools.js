const express = require('express');
const router = express.Router();
const { requireAuth } = require('../auth/middleware');
const ping = require('ping');
const { exec } = require('child_process');
const platform = require('os').platform();

// Helper to run traceroute
const runTraceroute = (host) => {
  return new Promise((resolve, reject) => {
    const command = platform === 'win32' ? `tracert -h 15 -w 500 ${host}` : `traceroute -m 15 -w 1 ${host}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Traceroute often exits with error codes even on partial success, 
        // but we'll return the output anyway if we have it.
        if (stdout) resolve(stdout);
        else reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

// POST /api/tools/ping
router.post('/ping', requireAuth, async (req, res) => {
  const { host } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  try {
    const result = await ping.promise.probe(host, {
      timeout: 5,
      extra: platform === 'win32' ? ['-n', '4'] : ['-c', '4'],
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tools/traceroute
router.post('/traceroute', requireAuth, async (req, res) => {
  const { host } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  // Basic sanitization to prevent command injection
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    return res.status(400).json({ error: 'Invalid host format' });
  }

  try {
    const output = await runTraceroute(host);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: 'Traceroute failed', details: err.message });
  }
});

module.exports = router;

