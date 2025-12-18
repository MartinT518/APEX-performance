#!/usr/bin/env python3
"""
Garmin Sync Script using MCP Client
This script uses the MCP server's client to sync activities with token persistence.
Called from Node.js server actions to avoid rate limiting.

Uses the same client initialization as the MCP server for:
- OAuth token persistence (~/.garminconnect/)
- Efficient get_activities_by_date() method
- Proper error handling
"""

import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Setup logging to stderr (won't interfere with JSON stdout)
logging.basicConfig(level=logging.INFO, format='%(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

# Add MCP source to path
project_root = Path(__file__).parent.parent
mcp_src = project_root / 'garmin-connect-mcp-main' / 'src'
if not mcp_src.exists():
    print(json.dumps({
        'success': False,
        'error': 'MCP_SOURCE_NOT_FOUND',
        'message': f'MCP source directory not found: {mcp_src}'
    }), file=sys.stderr)
    sys.exit(1)
sys.path.insert(0, str(mcp_src))

from garmin_connect_mcp.client import (
    init_garmin_client,
    GarminClientWrapper,
    GarminRateLimitError,
    GarminAuthenticationError,
    GarminAPIError
)
from garmin_connect_mcp.auth import load_config


def sync_activities_by_date_range(start_date: str, end_date: str) -> dict:
    """
    Sync Garmin activities for a date range using MCP client with token persistence.
    
    This uses the same client as the MCP server, which provides:
    - Token persistence (saves to ~/.garminconnect/)
    - Efficient get_activities_by_date() method (single API call)
    - Proper error handling with custom exceptions
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        dict with 'success', 'activities', 'error' keys
    """
    try:
        # Load config from .env.local (same as Node.js uses)
        env_path = project_root / '.env.local'
        if env_path.exists():
            load_dotenv(env_path)
        else:
            # Fallback to .env in MCP directory
            load_dotenv(project_root / 'garmin-connect-mcp-main' / '.env')
        
        config = load_config()
        
        # Initialize client (uses token persistence if available)
        # This will:
        # 1. Try to login with existing tokens from ~/.garminconnect/
        # 2. Fall back to credential login if tokens don't exist
        # 3. Save tokens for future use
        logger.info("Initializing Garmin client with token persistence...")
        garmin = init_garmin_client(config)
        if not garmin:
            return {
                'success': False,
                'error': 'AUTH_FAILED',
                'message': 'Failed to initialize Garmin client. Check credentials or run garmin-connect-mcp-auth.'
            }
        
        logger.info("Garmin client initialized successfully (using token persistence)")
        client = GarminClientWrapper(garmin)
        
        # Use efficient date-range query (single API call per date range)
        # This is MUCH more efficient than pagination
        activities = client.safe_call('get_activities_by_date', start_date, end_date, '')
        
        logger.info(f"Found {len(activities)} activities in date range {start_date} to {end_date}")
        
        # Format activities and fetch details for each
        formatted_activities = []
        for i, activity in enumerate(activities):
            try:
                # Extract basic info
                activity_id = activity.get('activityId')
                if not activity_id:
                    continue
                
                # Extract activity type
                activity_type_obj = activity.get('activityType', {})
                activity_type_key = activity_type_obj.get('typeKey', 'running') if isinstance(activity_type_obj, dict) else 'running'
                
                # Extract duration
                duration_obj = activity.get('duration', {})
                duration_seconds = duration_obj.get('totalSeconds', 0) if isinstance(duration_obj, dict) else 0
                
                # Fetch full activity details (needed for session stream)
                # Add small delay to avoid rate limiting
                if i > 0:
                    import time
                    time.sleep(2)  # 2 second delay between detail fetches
                
                try:
                    # Use get_activity() method to get full details
                    details = client.safe_call('get_activity', activity_id)
                except Exception as detail_err:
                    # If details fetch fails, still include basic info
                    logger.warning(f"Failed to fetch details for activity {activity_id}: {detail_err}")
                    details = None
                
                formatted_activities.append({
                    'activityId': activity_id,
                    'activityName': activity.get('activityName', ''),
                    'activityType': activity_type_key,
                    'startTimeGMT': activity.get('startTimeGMT'),
                    'startTimeLocal': activity.get('startTimeLocal'),
                    'durationInSeconds': duration_seconds,
                    'details': details  # Full activity details for session processing
                })
            except Exception as e:
                logger.warn(f"Error processing activity: {e}")
                continue
        
        return {
            'success': True,
            'activities': formatted_activities,
            'count': len(formatted_activities)
        }
        
    except GarminRateLimitError as e:
        return {
            'success': False,
            'error': 'RATE_LIMITED',
            'message': 'Rate limit exceeded. Please wait a few minutes before trying again.'
        }
    except GarminAuthenticationError as e:
        return {
            'success': False,
            'error': 'AUTH_FAILED',
            'message': 'Authentication failed. Please run garmin-connect-mcp-auth to re-authenticate.'
        }
    except GarminAPIError as e:
        return {
            'success': False,
            'error': 'API_ERROR',
            'message': str(e)
        }
    except Exception as e:
        return {
            'success': False,
            'error': 'UNKNOWN_ERROR',
            'message': f'Unexpected error: {str(e)}'
        }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({
            'success': False,
            'error': 'INVALID_ARGS',
            'message': 'Usage: sync-garmin-mcp.py <start_date> <end_date>'
        }))
        sys.exit(1)
    
    start_date = sys.argv[1]
    end_date = sys.argv[2]
    
    result = sync_activities_by_date_range(start_date, end_date)
    print(json.dumps(result))
    
    sys.exit(0 if result['success'] else 1)

