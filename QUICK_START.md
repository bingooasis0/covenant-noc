# Quick Start Guide - Clerk + Neon

## 🚀 Get Started in 5 Minutes

### 1. Get Your API Keys

#### Clerk (Authentication)
1. Go to https://dashboard.clerk.com
2. Create a new application
3. Copy your **Publishable Key** and **Secret Key**

#### Neon (Database)
1. Go to https://console.neon.tech
2. Create a new project
3. Copy your **Connection String**

### 2. Configure Environment

Create a `.env` file:

```env
# Clerk Keys
CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
CLERK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Neon Database
DATABASE_URL=postgres://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Server Config
NODE_ENV=development
PORT=3000
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Sign Up

1. Open http://localhost:5173
2. Click "Sign up" on the Clerk login page
3. Create your account
4. Start monitoring sites!

## 📋 What You'll Need

- ✅ Node.js 18+ installed
- ✅ Free Clerk account
- ✅ Free Neon account
- ✅ 5 minutes of time

## ❓ Having Issues?

See the full guide: [CLERK_NEON_SETUP.md](CLERK_NEON_SETUP.md)

## 🔑 Key Features

- **Clerk Authentication**
  - Email/password login
  - OAuth (Google, GitHub, etc.)
  - Built-in user management
  - Session management
  - MFA support

- **Neon PostgreSQL**
  - Serverless PostgreSQL
  - Auto-scaling
  - Automatic backups
  - Built-in connection pooling
  - Free tier: 0.5 GB storage

## 🎯 Next Steps

After signing in:

1. **Add your first site** - Click the "+" button
2. **Configure monitoring** - Enable ICMP, SNMP, NetFlow, or API monitoring
3. **View the dashboard** - Switch between Table, Grid, and Map views
4. **Set up alerts** - Sites will automatically generate alerts based on metrics

## 📚 Documentation

- Full Setup Guide: [CLERK_NEON_SETUP.md](CLERK_NEON_SETUP.md)
- Dashboard Guide: [DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md)
- Project Structure: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
