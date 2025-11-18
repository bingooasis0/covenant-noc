# Setup Checklist - Clerk + Neon

Use this checklist to set up your migrated NOC Dashboard.

## ☑️ Pre-Migration Checklist

- [ ] **Backup your data** (if you have existing sites/data you want to keep)
  - [ ] Export site list from old system
  - [ ] Save any important configuration
  - [ ] Copy `.env` file to `.env.backup`

## ☑️ Account Creation

### Clerk Account
- [ ] Go to https://dashboard.clerk.com
- [ ] Click "Sign Up"
- [ ] Create account with email
- [ ] Verify your email address
- [ ] Complete onboarding

### Neon Account
- [ ] Go to https://console.neon.tech
- [ ] Click "Sign Up"
- [ ] Create account (can use GitHub)
- [ ] Verify your email address

## ☑️ Clerk Configuration

- [ ] Create a new application in Clerk Dashboard
  - [ ] Click "Create Application"
  - [ ] Name it "NOC Dashboard" (or your preference)
  - [ ] Select sign-in methods (recommend: Email)
  - [ ] Click "Create Application"

- [ ] Get your API keys
  - [ ] Navigate to "API Keys" in sidebar
  - [ ] Copy **Publishable Key** (starts with `pk_test_`)
  - [ ] Copy **Secret Key** (starts with `sk_test_`)
  - [ ] Save these keys securely

- [ ] Configure authentication (optional)
  - [ ] Go to "User & Authentication" → "Email, Phone, Username"
  - [ ] Enable desired sign-in methods
  - [ ] Customize sign-up fields if needed
  - [ ] Configure email templates (optional)

## ☑️ Neon Configuration

- [ ] Create a new project
  - [ ] Click "Create Project"
  - [ ] Name it "noc-dashboard" (or your preference)
  - [ ] Select region (closest to your users)
  - [ ] Click "Create Project"

- [ ] Get connection string
  - [ ] Wait for project to be created (~30 seconds)
  - [ ] Click "Connection Details"
  - [ ] Copy the connection string (should include `?sslmode=require`)
  - [ ] Save this securely

## ☑️ Environment Setup

- [ ] Create `.env` file
  ```bash
  copy .env.example .env
  ```

- [ ] Edit `.env` and add your keys:
  - [ ] Paste Clerk **Publishable Key** into `CLERK_PUBLISHABLE_KEY`
  - [ ] Paste Clerk **Secret Key** into `CLERK_SECRET_KEY`
  - [ ] Paste Clerk **Publishable Key** into `VITE_CLERK_PUBLISHABLE_KEY` (same as above)
  - [ ] Paste Neon **Connection String** into `DATABASE_URL`
  - [ ] Set `NODE_ENV=development`
  - [ ] Set `PORT=3000` (or change if needed)

- [ ] Verify `.env` format
  ```env
  CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXX
  CLERK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXX
  DATABASE_URL=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
  NODE_ENV=development
  PORT=3000
  VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXX
  ```

## ☑️ Installation

- [ ] Install dependencies
  ```bash
  npm install
  ```

- [ ] Verify new packages are installed
  - [ ] Check `package.json` includes `@clerk/clerk-react`
  - [ ] Check `package.json` includes `@clerk/express`
  - [ ] Check `package.json` includes `@neondatabase/serverless`

## ☑️ First Run

- [ ] Kill any processes on port 3000
  ```bash
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```

- [ ] Start the dev server
  ```bash
  npm run dev
  ```

- [ ] Verify server starts without errors
  - [ ] Backend should show: "✓ Neon database initialized"
  - [ ] Backend should show: "✓ Server running on port 3000"
  - [ ] Frontend should show: "VITE v5.x.x ready"

- [ ] Open browser to http://localhost:5173
  - [ ] Page should load without errors
  - [ ] Should redirect to Clerk sign-in page

## ☑️ First Sign-Up

- [ ] Create your first account
  - [ ] Click "Sign up" on Clerk page
  - [ ] Enter your email
  - [ ] Enter a password (8+ characters)
  - [ ] Complete verification if required
  - [ ] You should be redirected to the dashboard

- [ ] Verify dashboard loads
  - [ ] Dashboard should show empty state
  - [ ] Header should show your email/name
  - [ ] All buttons should be functional

## ☑️ Test Functionality

- [ ] Add a test site
  - [ ] Click the "+" button
  - [ ] Fill in site details:
    - Customer: "Test Customer"
    - Name: "Test Site"
    - IP: "8.8.8.8" (Google DNS for testing)
  - [ ] Click "Add Site"
  - [ ] Site should appear in the dashboard

- [ ] Test site operations
  - [ ] Edit the test site
  - [ ] View site details
  - [ ] Delete the test site

- [ ] Test logout
  - [ ] Click logout button
  - [ ] Should redirect to Clerk sign-in
  - [ ] Sign back in
  - [ ] Should return to dashboard

## ☑️ Database Verification

- [ ] Verify Neon database tables were created
  - [ ] Go to Neon Console
  - [ ] Select your project
  - [ ] Click "Tables" tab
  - [ ] Should see: `sites`, `user_metadata`, `presets`, `audit_log`, `monitoring_data`, `snmp_data`

- [ ] Verify data is being saved
  - [ ] Add a site in the dashboard
  - [ ] Go to Neon Console → Tables → sites
  - [ ] Click "Browse data"
  - [ ] Should see your site record

## ☑️ Troubleshooting

If you encounter errors, check:

- [ ] **"Missing Clerk Publishable Key"**
  - [ ] Verify `VITE_CLERK_PUBLISHABLE_KEY` is in `.env`
  - [ ] Restart dev server (Vite only reads .env on startup)

- [ ] **"Database connection failed"**
  - [ ] Verify `DATABASE_URL` is correct
  - [ ] Check it ends with `?sslmode=require`
  - [ ] Verify Neon database is active (visit console)

- [ ] **Port 3000 already in use**
  - [ ] Find process: `netstat -ano | findstr :3000`
  - [ ] Kill process: `taskkill /PID <PID> /F`

- [ ] **Clerk sign-in not loading**
  - [ ] Verify publishable key starts with `pk_test_`
  - [ ] Check browser console for errors
  - [ ] Verify application is active in Clerk dashboard

## ☑️ Data Migration (Optional)

If you have existing data from the old system:

- [ ] Export data from old SQLite database
- [ ] Sign in to new system
- [ ] Manually re-create sites, or...
- [ ] Create a migration script (see `MIGRATION_SUMMARY.md`)

## ☑️ Production Deployment (When Ready)

- [ ] Create production Clerk application
  - [ ] Get production keys (`pk_live_` and `sk_live_`)

- [ ] Create production Neon project
  - [ ] Get production connection string

- [ ] Update production `.env`
  - [ ] Use production keys
  - [ ] Set `NODE_ENV=production`

- [ ] Build frontend
  ```bash
  npm run build
  ```

- [ ] Deploy to your hosting provider
  - [ ] Upload `dist/` folder
  - [ ] Upload `server/` folder
  - [ ] Set environment variables
  - [ ] Start server with `npm start`

## ☑️ Cleanup (After Verification)

Once everything is working:

- [ ] Delete backup files (optional)
  - [ ] `server/index-old-sqlite.js`
  - [ ] `server/db-old-sqlite.js`
  - [ ] `src/App-old-session.jsx`

- [ ] Remove unused dependencies (optional)
  ```bash
  npm uninstall express-session better-sqlite3-session-store better-sqlite3 bcryptjs
  ```

- [ ] Delete old SQLite database file (optional)
  - [ ] `nocturnal.db`
  - [ ] `nocturnal.db-shm`
  - [ ] `nocturnal.db-wal`

## 🎉 You're Done!

Your NOC Dashboard is now running with:
- ✅ Clerk authentication
- ✅ Neon PostgreSQL database
- ✅ Modern, scalable architecture

## 📚 Next Steps

- Read [DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md) for usage instructions
- Configure monitoring for your sites
- Customize Clerk branding (optional)
- Set up production deployment
- Enable MFA for security

## 🆘 Need Help?

- [QUICK_START.md](QUICK_START.md) - Quick reference guide
- [CLERK_NEON_SETUP.md](CLERK_NEON_SETUP.md) - Detailed setup guide
- [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) - What changed and why
- Clerk Docs: https://clerk.com/docs
- Neon Docs: https://neon.tech/docs
