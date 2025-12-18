# Quick Start: Using Garmin Sync in UI

## ✅ Yes, you can use it now!

After running `npm run dev`, the Garmin sync is fully integrated in the UI.

## How to Use

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the History page:**
   - Navigate to `/history` in your browser
   - Or click "History" in the sidebar

3. **Set your date range:**
   - Use the "Start Date" and "End Date" inputs
   - Default is last 30 days
   - For first sync, try 7 days or less

4. **Click "Sync Garmin" button:**
   - Located at the top right of the History page
   - Button shows "Syncing..." while in progress

5. **Watch the progress:**
   - Status messages appear below the button
   - Progress bar shows "Processing patch X of Y"
   - For date ranges >7 days, it automatically chunks into 7-day pieces

## What Happens Behind the Scenes

### First Attempt: MCP Client (if available)
- ✅ Uses Python script with token persistence
- ✅ Efficient date-range queries
- ✅ Single API call per chunk
- ✅ Lower rate limit risk

### Fallback: npm Client (if MCP fails)
- ✅ Automatically switches if Python unavailable
- ✅ Uses email/password authentication
- ✅ Still works, just slower

## Requirements

### Must Have:
- ✅ `.env.local` file with Garmin credentials:
  ```env
  GARMIN_EMAIL=your-email@example.com
  GARMIN_PASSWORD=your-password
  ```

### Nice to Have (for MCP):
- ✅ Python 3.11+ installed
- ✅ MCP dependencies installed (`cd garmin-connect-mcp-main && uv sync`)
- ✅ Authenticated once (`uv run garmin-connect-mcp-auth`)

## What You'll See

### Success:
```
✅ Sync complete: 15 sessions synced across 3 patch(es)
```

### Progress:
```
Processing patch 1 of 3...
Processing patch 2 of 3...
Processing patch 3 of 3...
```

### Rate Limited:
```
⚠️ Rate limited by Garmin at patch 1. Please wait 10-15 minutes before trying again.
```

### Cooldown:
```
⏳ Sync in cooldown. Please wait 3 more minute(s).
```

## Tips

1. **Start Small**: First sync, try 7 days or less
2. **Be Patient**: Large date ranges take time (15+ seconds between chunks)
3. **Check Logs**: Server logs show detailed progress
4. **Wait Between Syncs**: 5-minute cooldown between syncs

## Troubleshooting

### "Garmin credentials not configured"
- Create `.env.local` in project root
- Add `GARMIN_EMAIL` and `GARMIN_PASSWORD`
- Restart dev server

### "MCP sync failed, falling back to npm client"
- This is normal if Python/MCP not set up
- App still works with npm client
- To use MCP: install dependencies and authenticate

### "Rate limited"
- Wait 10-15 minutes
- Try smaller date range
- MCP client reduces rate limiting significantly

## You're Ready! 🚀

Just run `npm run dev` and go to the History page. The sync button is ready to use!

