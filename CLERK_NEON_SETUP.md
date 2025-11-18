# Clerk + Neon Migration Guide

This project has been updated to use **Clerk** for authentication and **Neon** for the PostgreSQL database.

## What Changed

### Authentication
- **Old**: Express sessions with bcrypt password hashing
- **New**: Clerk managed authentication with OAuth, social login, and user management

### Database
- **Old**: SQLite (better-sqlite3) with local file storage
- **New**: Neon serverless PostgreSQL with cloud hosting

## Prerequisites

1. **Node.js 18+** and npm
2. **Clerk Account** - Sign up at https://clerk.com
3. **Neon Account** - Sign up at https://neon.tech

## Step 1: Get Your Clerk API Keys

1. Go to https://dashboard.clerk.com
2. Create a new application (or use existing)
3. Click on **API Keys** in the sidebar
4. Copy your keys:
   - `Publishable Key` (starts with `pk_test_` or `pk_live_`)
   - `Secret Key` (starts with `sk_test_` or `sk_live_`)

## Step 2: Set Up Your Neon Database

1. Go to https://console.neon.tech
2. Create a new project
3. Once created, click on **Connection Details**
4. Copy the connection string that looks like:
   ```
   postgres://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

## Step 3: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your keys:

   ```env
   # ============ CLERK AUTHENTICATION ============
   CLERK_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
   CLERK_SECRET_KEY=sk_test_your_actual_secret_key_here

   # ============ NEON DATABASE ============
   DATABASE_URL=postgres://username:password@your-neon-hostname.neon.tech/neondb?sslmode=require

   # ============ SERVER CONFIGURATION ============
   NODE_ENV=development
   PORT=3000
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
   ```

   **Important**:
   - Use the same Clerk publishable key for both `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`
   - The `VITE_` prefix is required for Vite to expose the variable to the frontend

## Step 4: Install Dependencies

If you haven't already, install the new dependencies:

```bash
npm install
```

This will install:
- `@clerk/clerk-react` - Clerk React SDK
- `@clerk/express` - Clerk Express middleware
- `@neondatabase/serverless` - Neon PostgreSQL client

## Step 5: Initialize the Database

The database schema will be automatically created when you start the server for the first time. The new schema uses:

- **`user_metadata`** - Stores additional user data (Clerk handles core auth)
- **`sites`** - Your monitoring sites (now uses `clerk_user_id` instead of `user_id`)
- **`presets`** - Saved site presets
- **`audit_log`** - System audit trail
- **`monitoring_data`** - ICMP monitoring metrics
- **`snmp_data`** - SNMP monitoring metrics

## Step 6: Configure Clerk Settings

1. Go to https://dashboard.clerk.com and select your application
2. Navigate to **User & Authentication** → **Email, Phone, Username**
3. Configure your preferred sign-in methods:
   - Enable **Email** (recommended)
   - Optional: Enable **Google**, **GitHub**, or other OAuth providers
4. Under **Sessions**, configure session duration if needed

## Step 7: Start the Application

```bash
npm run dev
```

This will start:
- **Backend server** on `http://localhost:3000`
- **Frontend dev server** on `http://localhost:5173`

## Step 8: First Login

1. Navigate to `http://localhost:5173`
2. You'll be redirected to Clerk's sign-in page
3. Click **Sign up** to create your first account
4. Complete the sign-up process
5. You'll be automatically signed in and redirected to the dashboard

## Key Differences from Old System

### Authentication Flow

**Old System:**
- Manual registration endpoint (`/api/auth/register`)
- Login with username/password
- Session stored in SQLite
- Manual logout destroys session

**New System:**
- Clerk handles all auth UI
- Multiple sign-in methods (email, OAuth, etc.)
- Sessions managed by Clerk
- Automatic token refresh
- Built-in user management portal

### User Management

**Old System:**
- Users stored in local SQLite database
- Manual password hashing with bcrypt
- Basic user roles

**New System:**
- Users managed by Clerk
- Clerk handles password security, MFA, etc.
- User metadata stored in Neon (roles, preferences)
- Access Clerk Dashboard for user management

### Database

**Old System:**
- Local SQLite file (`nocturnal.db`)
- `INTEGER` primary keys with autoincrement
- Boolean stored as `INTEGER` (0/1)
- Foreign keys reference local user IDs

**New System:**
- Cloud PostgreSQL (Neon)
- `SERIAL` primary keys
- True `BOOLEAN` type
- Foreign keys reference Clerk user IDs (strings)

## Migrating Existing Data (Optional)

If you have existing data in the old SQLite database that you want to migrate:

### Option 1: Manual Migration

1. Export sites from old database
2. Sign in to new system with Clerk
3. Manually re-create sites in the new system

### Option 2: Automated Migration Script

Create a migration script to:
1. Read data from `nocturnal.db`
2. Map old user IDs to new Clerk user IDs
3. Insert data into Neon database

Example script structure:
```javascript
const Database = require('better-sqlite3');
const { neon } = require('@neondatabase/serverless');

// Read from old DB
const oldDb = new Database('./nocturnal.db');
const sites = oldDb.prepare('SELECT * FROM sites').all();

// Write to new DB
const sql = neon(process.env.DATABASE_URL);
for (const site of sites) {
  await sql`INSERT INTO sites (...) VALUES (...)`;
}
```

## Troubleshooting

### "Missing Clerk Publishable Key" Error

**Problem**: Frontend throws error about missing Clerk key

**Solution**:
1. Make sure you added `VITE_CLERK_PUBLISHABLE_KEY` to `.env`
2. Restart the dev server (`npm run dev`)
3. Vite only loads `.env` files on startup

### "Database connection failed" Error

**Problem**: Server can't connect to Neon

**Solution**:
1. Verify your `DATABASE_URL` is correct
2. Ensure it includes `?sslmode=require` at the end
3. Check your Neon database is active (it may pause after inactivity)
4. Visit the Neon console to wake it up

### Port 3000 Already in Use

**Problem**: Server fails to start because port is in use

**Solution**:
```bash
# Find the process
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Clerk Sign-In Page Not Loading

**Problem**: Redirects to Clerk but page doesn't load

**Solution**:
1. Check your Clerk publishable key is valid
2. Verify the key starts with `pk_test_` (test) or `pk_live_` (production)
3. Check browser console for CORS errors
4. Ensure Clerk application is active in the dashboard

### Database Tables Not Created

**Problem**: Server starts but queries fail

**Solution**:
1. Check server logs for database initialization errors
2. Verify Neon connection string is correct
3. Manually run the schema from `server/db-neon.js`

## Production Deployment

### Environment Variables

Set these in your production environment:

```env
CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_SECRET_KEY=sk_live_your_production_key
DATABASE_URL=postgres://user:pass@production-host.neon.tech/neondb?sslmode=require
NODE_ENV=production
PORT=3000
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
```

### Build the Frontend

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### Start the Server

```bash
npm start
```

The server will:
1. Serve the built frontend from `dist/`
2. Handle API requests
3. Proxy authentication through Clerk

### Recommended: Use PM2

```bash
npm install -g pm2
pm2 start server/index.js --name "noc-dashboard"
pm2 save
pm2 startup
```

## Security Considerations

### Clerk
- ✅ Handles password security and encryption
- ✅ Built-in brute force protection
- ✅ Optional MFA/2FA support
- ✅ SOC 2 Type II compliant

### Neon
- ✅ Automatic SSL/TLS encryption
- ✅ Regular backups
- ✅ Connection pooling
- ✅ SQL injection protection via parameterized queries

### Best Practices
1. **Never commit** `.env` file to version control
2. **Use production keys** only in production
3. **Enable MFA** for admin accounts in Clerk
4. **Regular backups** of Neon database
5. **Monitor audit logs** for suspicious activity

## Backup Files

The migration created backup copies of the old code:

- `server/index-old-sqlite.js` - Original Express server with session auth
- `server/db-old-sqlite.js` - Original SQLite database setup
- `src/App-old-session.jsx` - Original App component with session auth
- `src/components/Login.jsx` - Original login component (no longer used)

These can be deleted once you've verified the new system works correctly.

## Need Help?

- **Clerk Documentation**: https://clerk.com/docs
- **Neon Documentation**: https://neon.tech/docs
- **Project Issues**: Check the project README.md

## Rollback Instructions

If you need to rollback to the old system:

1. Stop the server
2. Restore old files:
   ```bash
   powershell -Command "Copy-Item 'server/index-old-sqlite.js' 'server/index.js' -Force"
   powershell -Command "Copy-Item 'server/db-old-sqlite.js' 'server/db.js' -Force"
   powershell -Command "Copy-Item 'src/App-old-session.jsx' 'src/App.jsx' -Force"
   ```
3. Uninstall new dependencies:
   ```bash
   npm uninstall @clerk/clerk-react @clerk/express @neondatabase/serverless
   ```
4. Restore old `.env` file
5. Start the server: `npm run dev`
