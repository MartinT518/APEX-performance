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


def extract_duration(activity: dict, details: dict | None = None) -> tuple[int, str]:
    """
    Extract duration from activity data.
    
    Based on actual Garmin API response structure:
    - duration: float number (seconds) - primary field
    - elapsedDuration: float number (seconds) - fallback
    - elapsedDurationInSeconds: float number (seconds) - alternative fallback
    
    The Garmin API consistently returns duration as a float number, not an object.
    
    Args:
        activity: Activity data from list response (get_activities_by_date)
        details: Optional full activity details from get_activity()
    
    Returns:
        Tuple of (duration_seconds, source_used)
    """
    # Priority 1: Check duration (direct float number from Garmin API)
    # This is the most common case - Garmin returns duration as a float
    duration = activity.get('duration')
    if duration is not None:
        # Handle both dict (unlikely but possible) and number (common case)
        if isinstance(duration, dict):
            total_seconds = duration.get('totalSeconds')
            if total_seconds and isinstance(total_seconds, (int, float)) and total_seconds > 0:
                return (int(total_seconds), "duration.totalSeconds")
        elif isinstance(duration, (int, float)) and duration > 0:
            return (int(duration), "duration")
    
    # Priority 2: Check elapsedDuration (also a float number)
    elapsed = activity.get('elapsedDuration')
    if elapsed is not None and isinstance(elapsed, (int, float)) and elapsed > 0:
        return (int(elapsed), "elapsedDuration")
    
    # Priority 3: Check elapsedDurationInSeconds (alternative field name)
    elapsed_sec = activity.get('elapsedDurationInSeconds')
    if elapsed_sec is not None and isinstance(elapsed_sec, (int, float)) and elapsed_sec > 0:
        return (int(elapsed_sec), "elapsedDurationInSeconds")
    
    # Priority 4: Fall back to details object if available
    if details:
        # Check details.duration (should also be a number, but handle dict case)
        details_duration = details.get('duration')
        if details_duration is not None:
            if isinstance(details_duration, dict):
                total_seconds = details_duration.get('totalSeconds')
                if total_seconds and isinstance(total_seconds, (int, float)) and total_seconds > 0:
                    return (int(total_seconds), "details.duration.totalSeconds")
            elif isinstance(details_duration, (int, float)) and details_duration > 0:
                return (int(details_duration), "details.duration")
        
        # Check details.elapsedDuration
        details_elapsed = details.get('elapsedDuration')
        if details_elapsed is not None and isinstance(details_elapsed, (int, float)) and details_elapsed > 0:
            return (int(details_elapsed), "details.elapsedDuration")
        
        # Check details.elapsedDurationInSeconds
        details_elapsed_sec = details.get('elapsedDurationInSeconds')
        if details_elapsed_sec is not None and isinstance(details_elapsed_sec, (int, float)) and details_elapsed_sec > 0:
            return (int(details_elapsed_sec), "details.elapsedDurationInSeconds")
        
        # Check details.summaryDTO (nested structure)
        summary_dto = details.get('summaryDTO')
        if summary_dto and isinstance(summary_dto, dict):
            summary_elapsed = summary_dto.get('elapsedDuration')
            if summary_elapsed is not None and isinstance(summary_elapsed, (int, float)) and summary_elapsed > 0:
                return (int(summary_elapsed), "details.summaryDTO.elapsedDuration")
            
            summary_duration = summary_dto.get('duration')
            if summary_duration is not None and isinstance(summary_duration, (int, float)) and summary_duration > 0:
                return (int(summary_duration), "details.summaryDTO.duration")
    
    return (0, "none")


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
                
                # Fetch full activity details (needed for session stream)
                # Add small delay to avoid rate limiting
                if i > 0:
                    import time
                    time.sleep(2)  # 2 second delay between detail fetches
                
                details = None
                try:
                    # Use get_activity() method to get full details
                    details = client.safe_call('get_activity', activity_id)
                except Exception as detail_err:
                    # If details fetch fails, still include basic info
                    logger.warning(f"Failed to fetch details for activity {activity_id}: {detail_err}")
                    details = None
                
                # Extract duration with fallback to details
                duration_seconds, duration_source = extract_duration(activity, details)
                
                # Log duration extraction for debugging
                if duration_seconds > 0:
                    logger.info(f"Activity {activity_id}: Extracted duration {duration_seconds}s from {duration_source}")
                else:
                    logger.warning(f"Activity {activity_id}: No valid duration found after checking all sources")
                    logger.debug(f"  Activity duration field: {activity.get('duration')}")
                    logger.debug(f"  Activity elapsedDuration: {activity.get('elapsedDuration')}")
                    logger.debug(f"  Activity elapsedDurationInSeconds: {activity.get('elapsedDurationInSeconds')}")
                    if details:
                        logger.debug(f"  Details duration: {details.get('duration')}")
                        logger.debug(f"  Details elapsedDuration: {details.get('elapsedDuration')}")
                        logger.debug(f"  Details summaryDTO: {details.get('summaryDTO')}")
                
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

