# Supabase Setup Guide

This directory contains database migrations and setup instructions for the APEX Performance application.

## Quick Start

1. **Create a Supabase Project**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Create a new project
   - Wait for the project to be fully provisioned

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy your `Project URL` and `anon/public` key
   - For server-side operations, also copy your `service_role` key (keep this secret!)

3. **Set Environment Variables**
   - Create a `.env.local` file in the project root (see `ENV_TEMPLATE.md` for complete template)
   - Add your Supabase credentials:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
     
     # New API Key Format (2025+) - Recommended
     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
     
     # Legacy format (still supported)
     # NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     
     # Secret key for server-side operations
     SUPABASE_SECRET_DEFAULT_KEY=your-secret-key
     # or legacy: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     ```
   - Optional: Add Garmin credentials for data ingestion:
     ```env
     GARMIN_EMAIL=your-email@example.com
     GARMIN_PASSWORD=your-password-here
     ```
   
   **Note:** Supabase is transitioning API key names in 2025. The code supports both new (`publishable`/`secret`) and legacy (`anon`/`service_role`) formats for compatibility.
   
   See `ENV_TEMPLATE.md` for the full template including Garmin MCP server configuration.

4. **Run Database Migration**
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Copy and paste the contents of `migrations/001_initial_schema.sql`
   - Click "Run" to execute the migration

5. **Verify Setup**
   - Check that all tables were created in the Table Editor
   - Verify Row Level Security (RLS) is enabled on all tables
   - Test authentication by creating a test user

## Database Schema

The migration creates the following tables:

- **`phenotype_profiles`** - User physiological configuration (FR-M1)
- **`daily_monitoring`** - Daily check-ins (niggle, strength, fueling) (FR-M2)
- **`session_logs`** - Training session data (FR-K1)
- **`agent_votes`** - Agent decision logs (FR-E1)
- **`baseline_metrics`** - Historical baseline calculations (FR-R1)

## Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only access their own data
- Users can insert/update their own records
- Proper foreign key relationships are maintained

## Authentication

The application uses Supabase Auth. To enable authentication:

1. Go to Authentication → Providers in your Supabase dashboard
2. Enable the providers you want (Email, OAuth, etc.)
3. Configure email templates if needed
4. The application will automatically use Supabase Auth for user sessions

## Next Steps

After running the migration:

1. Test the application - it should now connect to Supabase
2. Create a test user account
3. The app will automatically create a default phenotype profile on first login
4. Start logging daily monitoring data

## Troubleshooting

**"Missing Supabase environment variables" error:**
- Ensure `.env.local` exists and contains the required variables
- Restart your Next.js dev server after adding env vars

**"Failed to load profile" error:**
- Check that the migration ran successfully
- Verify RLS policies are correct
- Check browser console for detailed error messages

**Authentication issues:**
- Ensure Auth is enabled in Supabase dashboard
- Check that email provider is configured
- Verify RLS policies allow user access

