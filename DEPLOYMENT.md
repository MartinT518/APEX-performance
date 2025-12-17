# Deployment Guide - APEX Performance

This guide covers deploying the APEX Performance application to Vercel.

## Prerequisites

- Vercel account
- Supabase project
- Git repository (GitHub, GitLab, or Bitbucket)

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

## Step 2: Vercel Deployment

### Option A: Deploy via Vercel Dashboard

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

### Option B: Deploy via CLI

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

Add these environment variables in Vercel dashboard (Settings > Environment Variables):

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
- Use Vercel's environment variable management for different environments (Production, Preview, Development)

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

### Vercel Analytics

1. Enable Vercel Analytics in project settings
2. Monitor:
   - Page views
   - Performance metrics
   - Error rates

### Supabase Logs

1. Go to Supabase Dashboard > Logs
2. Monitor:
   - API requests
   - Database queries
   - Authentication events

### Application Logs

- Check Vercel function logs for server-side errors
- Use browser console for client-side errors
- Logger utility (`src/lib/logger.ts`) respects environment log levels

## Step 7: Rollback Procedures

### Quick Rollback

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
- Check build logs in Vercel dashboard

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
1. Check Vercel deployment logs
2. Check Supabase logs
3. Review application error logs
4. Check browser console for client errors

## Security Notes

- Never commit `.env.local` or secrets
- Use Vercel's environment variable encryption
- Regularly rotate API keys
- Monitor for unauthorized access
- Keep dependencies updated

