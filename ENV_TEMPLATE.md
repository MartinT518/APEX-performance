# Environment Variables Template

Copy these variables to your `.env.local` file (create it if it doesn't exist).

## Quick Setup

### Option 1: Use Setup Script (Recommended)

**Windows (PowerShell):**
```powershell
.\scripts\setup-env.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x scripts/setup-env.sh
./scripts/setup-env.sh
```

### Option 2: Manual Setup

Create a `.env.local` file in the project root and copy the template below, then fill in your actual values.

## Required Variables

### Supabase Configuration

```env
# Get these from: https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# New API Key Format (2025+)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key-here

# Legacy API Key Format (still supported)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: For server-side operations (keep secret!)
# New format: SUPABASE_SECRET_DEFAULT_KEY
# Legacy format: SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET_DEFAULT_KEY=your-secret-key-here
# or
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Note:** Supabase is transitioning to new API key names in 2025:
- `anon` → `publishable` (client-side)
- `service_role` → `secret` (server-side)

The code supports both formats for compatibility.

### Garmin Connect (Optional)

```env
# Used for direct Garmin API integration
# If not set, app runs in simulation mode
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here
```

## Complete Template

```env
# ============================================
# APEX Performance - Environment Variables
# ============================================
# Copy this to .env.local and fill in your actual values
# DO NOT commit .env.local to version control!

# ============================================
# Supabase Configuration
# ============================================
# Get these from your Supabase project: https://app.supabase.com/project/_/settings/api

# Public URL and publishable key (safe for client-side usage in browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# New API Key Format (2025+) - Recommended
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key-here

# Legacy API Key Format (still supported for backward compatibility)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Secret key (server-side only - KEEP SECRET! Never expose to client)
# Only use this in Server Actions or API routes
# New format: SUPABASE_SECRET_DEFAULT_KEY
SUPABASE_SECRET_DEFAULT_KEY=your-secret-key-here
# Legacy format: SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ============================================
# Garmin Connect Configuration
# ============================================
# Used for direct Garmin API integration (optional)
# If not set, the app will run in simulation mode

GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here

# ============================================
# Garmin MCP Server Configuration
# ============================================
# These are used by the Python FastMCP server (garmin-connect-mcp-main)
# The MCP server reads from .env file in its own directory
# 
# If using the MCP server, create a .env file in garmin-connect-mcp-main/ directory:
# 
# GARMIN_EMAIL=your-email@example.com
# GARMIN_PASSWORD=your-password-here
# 
# Optional MCP tool configuration:
# GARMIN_TOOL_ENABLE_CACHING=true
# GARMIN_TOOL_CACHE_TTL_SECONDS=3600
# GARMIN_TOOL_DEFAULT_ACTIVITY_LIMIT=20
# GARMIN_TOOL_MAX_ACTIVITY_LIMIT=100
# GARMIN_TOOL_DISTANCE_UNIT=km
# GARMIN_TOOL_ELEVATION_UNIT=m
# GARMIN_TOOL_TEMPERATURE_UNIT=C
# GARMIN_TOOL_WEIGHT_UNIT=kg
```

## MCP Server Setup (for Cursor/Claude)

If you want to use the Garmin MCP server with Cursor/Claude, you need to configure it separately:

### Option 1: MCP Settings File

Create or edit: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

Or on Windows: `C:\Users\YOUR_USERNAME\.cursor\mcp.json`

```json
{
  "mcpServers": {
    "garmin": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "C:/Users/YOUR_USERNAME/Documents/APEX performance/garmin-connect-mcp-main",
        "garmin-connect-mcp"
      ],
      "env": {
        "GARMIN_EMAIL": "your-email@example.com",
        "GARMIN_PASSWORD": "your-password-here"
      }
    }
  }
}
```

### Option 2: Environment Variables in MCP Config

You can also reference environment variables:

```json
{
  "mcpServers": {
    "garmin": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "C:/Users/YOUR_USERNAME/Documents/APEX performance/garmin-connect-mcp-main",
        "garmin-connect-mcp"
      ]
    }
  }
}
```

Then create a `.env` file in `garmin-connect-mcp-main/` directory with:
```env
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here
```

## Notes

- **Never commit `.env.local`** to version control (it's in `.gitignore`)
- The `NEXT_PUBLIC_` prefix is required for client-side access in Next.js
- Garmin credentials are optional - the app works in simulation mode without them
- Supabase credentials are required for database functionality
- MCP server configuration is separate from the Next.js app configuration

