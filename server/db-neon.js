const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// Initialize database schema
async function initializeDatabase() {
  try {
    // Create users table (Clerk will handle auth, but we might store additional user metadata)
    await sql`
      CREATE TABLE IF NOT EXISTS user_metadata (
        clerk_user_id TEXT PRIMARY KEY,
        role TEXT DEFAULT 'viewer',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create sites table
    await sql`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        customer TEXT NOT NULL,
        name TEXT NOT NULL,
        ip TEXT NOT NULL,
        failover_ip TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        devices TEXT,
        status TEXT DEFAULT 'operational',
        isp TEXT,
        device TEXT,
        monitoring_icmp BOOLEAN DEFAULT true,
        monitoring_snmp BOOLEAN DEFAULT false,
        monitoring_netflow BOOLEAN DEFAULT false,
        monitoring_api BOOLEAN DEFAULT false,
        snmp_community TEXT,
        netflow_port TEXT DEFAULT '2055',
        api_key TEXT,
        api_endpoint TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create presets table
    await sql`
      CREATE TABLE IF NOT EXISTS presets (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sites TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create audit_log table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL,
        site_id TEXT,
        site_name TEXT,
        customer TEXT,
        message TEXT NOT NULL,
        severity TEXT DEFAULT 'info'
      )
    `;

    // Create monitoring_data table
    await sql`
      CREATE TABLE IF NOT EXISTS monitoring_data (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        latency REAL,
        packet_loss REAL,
        jitter REAL,
        status TEXT,
        using_failover BOOLEAN DEFAULT false,
        active_ip TEXT
      )
    `;

    // Create snmp_data table
    await sql`
      CREATE TABLE IF NOT EXISTS snmp_data (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cpu_usage INTEGER,
        memory_total BIGINT,
        memory_used BIGINT,
        memory_percent INTEGER,
        uptime BIGINT,
        interfaces TEXT
      )
    `;

    // Create indexes for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(clerk_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_presets_user ON presets(clerk_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(clerk_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_monitoring_site ON monitoring_data(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_monitoring_timestamp ON monitoring_data(timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_snmp_site ON snmp_data(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_snmp_timestamp ON snmp_data(timestamp)`;

    console.log('✓ Neon database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Export the SQL client and initialization function
module.exports = {
  sql,
  initializeDatabase
};
