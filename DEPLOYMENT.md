# Deployment Guide - APEX Performance

This guide covers deploying the APEX Performance application to various hosting platforms. **Free options are available** - see options below.

## Prerequisites

- Supabase project (free tier available)
- Git repository (GitHub, GitLab, or Bitbucket)
- Account for your chosen hosting platform (all listed options have free tiers)

## Deployment Options

### Free Options (Recommended)

1. **Netlify** ⭐ (Recommended) - Excellent Next.js support, generous free tier
2. **Cloudflare Pages** ⭐ - Unlimited requests, global CDN, great performance
3. **Render** - Good free tier, supports full-stack apps

### Paid Options

4. **Vercel** - Premium Next.js hosting (paid plans required for production)

## Step 1: Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Run the migration:
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Execute the migration
3. Get your Supabase credentials:
   - Project URL: Found in Settings > API
   - Publishable Key: Found in Settings > API (new format: `publishable_default_key`)
   - Secret Key: Found in Settings > API (new format: `secret_default_key`)

## Step 2: Choose Your Hosting Platform

### Option 1: Netlify (Recommended - Free) ⭐

**Free Tier**: 100 GB bandwidth, 300 build minutes/month, unlimited sites

#### Deploy via Netlify Dashboard

1. Go to https://netlify.com and sign up (free)
2. Click "Add new site" > "Import an existing project"
3. Connect your Git repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Framework preset**: Next.js (auto-detected)
5. Add environment variables (see Step 3)
6. Click "Deploy site"

#### Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

**Note**: Netlify requires a `netlify.toml` file for Next.js. Create one in your project root:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Option 2: Cloudflare Pages (Free) ⭐

**Free Tier**: Unlimited requests, unlimited bandwidth, global CDN

#### Deploy via Cloudflare Dashboard

1. Go to https://pages.cloudflare.com and sign up (free)
2. Click "Create a project" > "Connect to Git"
3. Select your repository
4. Configure build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
5. Add environment variables (see Step 3)
6. Click "Save and Deploy"

**Note**: Cloudflare Pages automatically detects Next.js and configures accordingly.

### Option 3: Render (Free)

**Free Tier**: 750 hours/month, automatic SSL, custom domains

#### Deploy via Render Dashboard

1. Go to https://render.com and sign up (free)
2. Click "New +" > "Web Service"
3. Connect your Git repository
4. Configure:
   - **Name**: Your app name
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables (see Step 3)
6. Click "Create Web Service"

**Note**: Render free tier spins down after 15 minutes of inactivity. First request may be slow.

### Option 4: Vercel (Paid)

**Note**: Vercel's free tier is limited. Paid plans start at $20/month for production use.

#### Deploy via Vercel Dashboard

1. Go to https://vercel.com and sign in
2. Click "New Project"
3. Import your Git repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: `.` (or leave default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
5. Add environment variables (see Step 3)
6. Click "Deploy"

#### Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# For production
vercel --prod
```

## Step 3: Environment Variables

Add these environment variables in your hosting platform's dashboard:

### Netlify
- Go to Site settings > Environment variables

### Cloudflare Pages
- Go to Pages > Your project > Settings > Environment variables

### Render
- Go to Environment tab in your service

### Vercel
- Go to Project settings > Environment variables

### Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
SUPABASE_SECRET_DEFAULT_KEY=your-secret-key
```

### Optional Variables

```env
# Garmin Integration (optional)
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password
```

**Important**: 
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Never commit secrets to version control
- All platforms support environment-specific variables (Production, Preview, Development)
- Free tiers typically support environment variables

## Step 4: Database Migration

After deployment, verify the database schema:

1. Go to Supabase SQL Editor
2. Run: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`
3. Verify all tables exist:
   - `phenotype_profiles`
   - `daily_monitoring`
   - `session_logs`
   - `agent_votes`
   - `baseline_metrics`

## Step 5: Post-Deployment Verification

### Checklist

- [ ] Application loads without errors
- [ ] User can sign up and log in
- [ ] Phenotype settings can be saved
- [ ] Daily monitoring data persists
- [ ] Coach analysis runs successfully
- [ ] Session history displays correctly
- [ ] Error boundaries catch errors gracefully

### Test Endpoints

1. **Authentication**: `/` - Should redirect to login if not authenticated
2. **Dashboard**: `/dashboard` - Should display after login
3. **Settings**: `/settings` - Should allow phenotype configuration
4. **History**: `/history` - Should display session logs

## Step 6: Monitoring and Logging

### Platform-Specific Analytics

**Netlify**:
- Built-in analytics available (paid add-on)
- Access logs in Site settings > Analytics

**Cloudflare Pages**:
- Built-in analytics dashboard
- Access via Pages > Your project > Analytics

**Render**:
- Built-in logs and metrics
- Access via your service > Logs tab

**Vercel**:
- Enable Vercel Analytics in project settings
- Monitor page views, performance metrics, error rates

### Supabase Logs

1. Go to Supabase Dashboard > Logs
2. Monitor:
   - API requests
   - Database queries
   - Authentication events

### Application Logs

- **Netlify**: Check function logs in Site settings > Functions
- **Cloudflare Pages**: Check build logs and runtime logs in dashboard
- **Render**: Check logs in your service > Logs tab
- **Vercel**: Check function logs in deployment details
- Use browser console for client-side errors
- Logger utility (`src/lib/logger.ts`) respects environment log levels

## Step 7: Rollback Procedures

### Quick Rollback

**Netlify**:
1. Go to Site overview > Deploys
2. Find the previous working deployment
3. Click "..." menu > "Publish deploy"

**Cloudflare Pages**:
1. Go to Pages > Your project > Deployments
2. Find the previous working deployment
3. Click "..." menu > "Retry deployment" or "Rollback"

**Render**:
1. Go to your service > Deploys
2. Find the previous working deployment
3. Click "..." menu > "Rollback to this deploy"

**Vercel**:
1. Go to Vercel Dashboard > Deployments
2. Find the previous working deployment
3. Click "..." menu > "Promote to Production"

### Database Rollback

If schema changes need to be reverted:

1. Create a new migration file with rollback SQL
2. Run in Supabase SQL Editor
3. Test thoroughly before deploying

## Step 8: Environment-Specific Configurations

The app automatically detects environment:

- **Development**: `localhost` or `127.0.0.1`
- **Staging**: Hostname contains `staging` or `preview`
- **Production**: All other hostnames

Configuration is managed in `src/lib/config.ts`.

## Troubleshooting

### Build Failures

- Check Node.js version (should be 18+)
- Verify all environment variables are set
- Check build logs in your platform's dashboard:
  - **Netlify**: Site overview > Deploys > Click failed deploy
  - **Cloudflare Pages**: Pages > Your project > Deployments > Click failed deploy
  - **Render**: Your service > Deploys > Click failed deploy
  - **Vercel**: Project > Deployments > Click failed deploy

### Database Connection Issues

- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Verify RLS policies allow access

### Authentication Issues

- Verify Supabase auth is enabled
- Check redirect URLs in Supabase settings
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is correct

### Garmin Integration Issues

- Verify credentials are set (optional)
- App will run in simulation mode without Garmin
- Check logs for Garmin-specific errors

## Maintenance

### Regular Tasks

1. **Weekly**: Review error logs
2. **Monthly**: Update dependencies
3. **Quarterly**: Review and optimize database queries
4. **As needed**: Backup database (see `scripts/backup-database.ps1`)

### Database Backups

Use Supabase dashboard or backup scripts:
- Automated backups: Supabase handles daily backups
- Manual backups: Use `scripts/backup-database.ps1`

## Support

For issues:
1. Check your platform's deployment logs (see Step 6)
2. Check Supabase logs
3. Review application error logs
4. Check browser console for client errors

### Platform Support

- **Netlify**: https://docs.netlify.com (excellent documentation)
- **Cloudflare Pages**: https://developers.cloudflare.com/pages (comprehensive docs)
- **Render**: https://render.com/docs (good documentation)
- **Vercel**: https://vercel.com/docs (excellent documentation)

## Security Notes

- Never commit `.env.local` or secrets
- All platforms provide encrypted environment variable storage
- Regularly rotate API keys
- Monitor for unauthorized access
- Keep dependencies updated
- Use platform-specific security features:
  - **Netlify**: Built-in DDoS protection, secure headers
  - **Cloudflare Pages**: Automatic DDoS protection, WAF (Web Application Firewall)
  - **Render**: Built-in security features
  - **Vercel**: Enterprise-grade security features

## Cost Comparison

| Platform | Free Tier | Paid Plans Start At |
|----------|-----------|---------------------|
| **Netlify** | 100 GB bandwidth, 300 build min/month | $19/month (Pro) |
| **Cloudflare Pages** | Unlimited requests, unlimited bandwidth | Free (paid for advanced features) |
| **Render** | 750 hours/month, spins down after inactivity | $7/month (Starter) |
| **Vercel** | Limited free tier | $20/month (Pro) |

**Recommendation**: Start with **Netlify** or **Cloudflare Pages** for the best free experience with Next.js applications.

