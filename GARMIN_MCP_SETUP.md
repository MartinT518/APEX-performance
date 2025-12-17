# Garmin MCP Server Setup Guide

This guide covers setting up the Garmin Connect MCP server for use with Cursor/Claude.

## Overview

The Garmin MCP (Model Context Protocol) server allows AI assistants to fetch and analyze Garmin activity data. The server is located in `garmin-connect-mcp-main/`.

## Prerequisites

- Python 3.10 or higher
- `uv` package manager (recommended) or `pip`
- Garmin Connect account credentials

## Step 1: Install Dependencies

### Option A: Using `uv` (Recommended)

```bash
cd garmin-connect-mcp-main
uv sync
```

### Option B: Using `pip`

```bash
cd garmin-connect-mcp-main
pip install -r requirements.txt
```

## Step 2: Configure Credentials

Create a `.env` file in `garmin-connect-mcp-main/`:

```env
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here
```

**Security Note**: Never commit this file to version control. It's already in `.gitignore`.

## Step 3: Authenticate

Run the authentication script:

```bash
cd garmin-connect-mcp-main
uv run garmin-connect-mcp-auth
```

Or with pip:

```bash
python -m garmin_connect_mcp.scripts.setup_auth
```

This will:
1. Prompt for your Garmin credentials
2. Handle MFA if enabled
3. Save authentication tokens for future use

## Step 4: Configure Cursor/Claude

### For Cursor

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

**Note**: Replace `YOUR_USERNAME` and the path with your actual values.

### Alternative: Use Environment Variables

You can omit credentials from the config if they're in the `.env` file:

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

## Step 5: Test Connection

1. Restart Cursor/Claude
2. Try asking: "Fetch my latest Garmin activity"
3. The MCP server should connect and fetch data

## Troubleshooting

### Authentication Failures

- Verify credentials are correct
- Check if MFA is enabled (may require additional setup)
- Try re-running the auth script

### MCP Server Not Found

- Verify the path in MCP config is correct
- Check that `uv` or Python is in PATH
- Try using absolute paths

### Import Errors

- Ensure dependencies are installed: `uv sync` or `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.10+)

### Connection Timeouts

- Check internet connection
- Verify Garmin Connect website is accessible
- Check if Garmin API is experiencing issues

## MCP Server Features

The server provides tools for:

- **Activity Queries**: Fetch activities by date, type, or ID
- **Activity Details**: Get detailed metrics for specific activities
- **Health Data**: Access HRV, sleep, and other health metrics
- **Device Info**: Get connected device information

## Security Best Practices

1. **Never commit credentials**: Keep `.env` in `.gitignore`
2. **Use environment variables**: Prefer env vars over hardcoded values
3. **Rotate passwords**: Change Garmin password periodically
4. **Monitor access**: Review Garmin Connect login history
5. **Limit scope**: Only grant necessary permissions

## Integration with APEX Performance

The MCP server is separate from the Next.js app's Garmin integration:

- **MCP Server**: Used by AI assistants (Cursor/Claude) for analysis
- **Next.js App**: Uses direct Garmin API via `garminClient.ts`

Both can use the same credentials but serve different purposes.

## Advanced Configuration

### Custom Cache Settings

Add to `.env`:

```env
GARMIN_TOOL_ENABLE_CACHING=true
GARMIN_TOOL_CACHE_TTL_SECONDS=3600
GARMIN_TOOL_DEFAULT_ACTIVITY_LIMIT=20
GARMIN_TOOL_MAX_ACTIVITY_LIMIT=100
```

### Unit Preferences

```env
GARMIN_TOOL_DISTANCE_UNIT=km
GARMIN_TOOL_ELEVATION_UNIT=m
GARMIN_TOOL_TEMPERATURE_UNIT=C
GARMIN_TOOL_WEIGHT_UNIT=kg
```

## Support

For issues:
1. Check MCP server logs in Cursor/Claude
2. Verify authentication tokens are valid
3. Test Garmin Connect website access
4. Review server documentation in `garmin-connect-mcp-main/README.md`

