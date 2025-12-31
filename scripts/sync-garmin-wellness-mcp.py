#!/usr/bin/env python3
"""
Garmin Wellness Sync Script using MCP Client
This script uses the MCP server's client to sync wellness data (HRV, RHR, Sleep) with token persistence.
Called from Node.js server actions to avoid rate limiting and access HRV data.

Uses the same client initialization as the MCP server for:
- OAuth token persistence (~/.garminconnect/)
- Access to get_hrv_data method (not available in npm garminconnect)
- Proper error handling
"""

import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta

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


def sync_wellness_by_date_range(start_date: str, end_date: str) -> dict:
    """
    Sync Garmin wellness data (HRV, RHR, Sleep) for a date range using MCP client.
    
    This uses the same client as the MCP server, which provides:
    - Token persistence (saves to ~/.garminconnect/)
    - Access to get_hrv_data method (not in npm library)
    - Proper error handling with custom exceptions
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        dict with 'success', 'wellness_data', 'count' keys
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
        
        # Generate date list
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        dates = []
        current = start
        while current <= end:
            dates.append(current.strftime('%Y-%m-%d'))
            current += timedelta(days=1)
        
        logger.info(f"Fetching wellness data for {len(dates)} days ({start_date} to {end_date})")
        
        # Fetch wellness data for each date
        wellness_data = []
        for i, date_str in enumerate(dates):
            try:
                # Add delay to avoid rate limiting
                if i > 0:
                    import time
                    time.sleep(1)  # 1 second delay between requests
                
                entry = {'date': date_str}
                
                # 1. Fetch HRV data (using MCP client method)
                # This gets the average overnight HRV (sleep HRV) - the most relevant metric
                try:
                    hrv_data = client.safe_call('get_hrv_data', date_str)
                    # Extract average overnight HRV (sleep HRV) from various possible structures
                    if hrv_data:
                        # The get_hrv_data method returns overnight/average HRV during sleep
                        # Try different possible field names and nested structures
                        hrv = None
                        
                        # Check for nested hrvSummary structure
                        if isinstance(hrv_data, dict):
                            # Try hrvSummary.lastNightAvg (most common)
                            hrv_summary = hrv_data.get('hrvSummary') or hrv_data.get('hrvSummaryDTO')
                            if hrv_summary and isinstance(hrv_summary, dict):
                                hrv = hrv_summary.get('lastNightAvg') or hrv_summary.get('avgOvernightHrv')
                            
                            # Try direct fields
                            if hrv is None:
                                hrv = (hrv_data.get('lastNightAvg') or
                                       hrv_data.get('avgOvernightHrv') or
                                       hrv_data.get('averageHrv') or
                                       hrv_data.get('overnightAvg'))
                            
                            # Try nested hrv object
                            if hrv is None:
                                hrv_obj = hrv_data.get('hrv')
                                if isinstance(hrv_obj, dict):
                                    hrv = hrv_obj.get('lastNightAvg') or hrv_obj.get('avgOvernightHrv')
                            
                            # If it's a simple number, use it directly
                            if hrv is None and isinstance(hrv_data, (int, float)):
                                hrv = hrv_data
                        
                        if hrv is not None:
                            entry['hrv'] = float(hrv)
                            logger.debug(f"HRV extracted for {date_str}: {entry['hrv']}ms (avg overnight/sleep HRV)")
                        else:
                            logger.debug(f"HRV data structure for {date_str} doesn't match expected format: {hrv_data}")
                            entry['hrv'] = None
                    else:
                        entry['hrv'] = None
                except Exception as e:
                    logger.warning(f"HRV fetch failed for {date_str}: {type(e).__name__}: {str(e)}")
                    entry['hrv'] = None
                
                # 2. Fetch RHR (resting heart rate)
                # Try multiple methods as different Garmin API versions may use different endpoints
                try:
                    rhr = None
                    
                    # Method 1: Try get_rhr_day (most direct)
                    try:
                        rhr_data = client.safe_call('get_rhr_day', date_str)
                        if rhr_data is not None:
                            # Handle different response formats
                            if isinstance(rhr_data, (int, float)):
                                rhr = float(rhr_data)
                            elif isinstance(rhr_data, dict):
                                rhr = (rhr_data.get('restingHeartRate') or
                                       rhr_data.get('rhr') or
                                       rhr_data.get('value'))
                                if rhr is not None:
                                    rhr = float(rhr)
                    except Exception as rhr_err:
                        logger.debug(f"get_rhr_day failed for {date_str}, trying alternative: {rhr_err}")
                    
                    # Method 2: Try get_heart_rates (may contain RHR)
                    if rhr is None:
                        try:
                            hr_data = client.safe_call('get_heart_rates', date_str)
                            if hr_data and isinstance(hr_data, dict):
                                rhr = (hr_data.get('restingHeartRate') or
                                       hr_data.get('rhr') or
                                       hr_data.get('resting_hr'))
                                if rhr is not None:
                                    rhr = float(rhr)
                        except Exception as hr_err:
                            logger.debug(f"get_heart_rates failed for {date_str}: {hr_err}")
                    
                    # Method 3: Try sleep data (often includes RHR) - but we'll check this after fetching sleep data
                    # to avoid duplicate API calls
                    
                    entry['rhr'] = rhr
                    if rhr is not None:
                        logger.debug(f"RHR extracted for {date_str}: {entry['rhr']} bpm")
                        
                except Exception as e:
                    logger.warning(f"RHR fetch failed for {date_str}: {type(e).__name__}: {str(e)}")
                    entry['rhr'] = None
                
                # 3. Fetch Sleep data (also check for RHR if not found above)
                try:
                    sleep_data = client.safe_call('get_sleep_data', date_str)
                    if sleep_data:
                        dto = sleep_data.get('dailySleepDTO', {})
                        entry['sleepSeconds'] = dto.get('sleepTimeSeconds')
                        entry['sleepScore'] = (dto.get('sleepScores', {}).get('overall', {}).get('value')
                                              if isinstance(dto.get('sleepScores'), dict) else None)
                        
                        # Sleep data often includes RHR - use it if we didn't get it from other methods
                        if entry['rhr'] is None and isinstance(sleep_data, dict):
                            sleep_rhr = sleep_data.get('restingHeartRate')
                            if sleep_rhr is not None:
                                entry['rhr'] = float(sleep_rhr)
                                logger.debug(f"RHR extracted from sleep data for {date_str}: {entry['rhr']} bpm")
                    else:
                        entry['sleepSeconds'] = None
                        entry['sleepScore'] = None
                except Exception as e:
                    logger.warning(f"Sleep data fetch failed for {date_str}: {type(e).__name__}: {str(e)}")
                    entry['sleepSeconds'] = None
                    entry['sleepScore'] = None
                
                wellness_data.append(entry)
                
                if (i + 1) % 5 == 0:
                    logger.info(f"Fetched wellness data for {i + 1}/{len(dates)} days...")
                    
            except Exception as e:
                logger.error(f"Critical error fetching wellness data for {date_str}: {type(e).__name__}: {str(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Still add entry with None values so we don't lose track of the date
                wellness_data.append({
                    'date': date_str,
                    'hrv': None,
                    'rhr': None,
                    'sleepSeconds': None,
                    'sleepScore': None
                })
                continue
        
        # Count how many entries have actual data
        entries_with_data = sum(1 for entry in wellness_data 
                               if entry.get('hrv') is not None or 
                                  entry.get('rhr') is not None or 
                                  entry.get('sleepSeconds') is not None)
        
        logger.info(f"Fetched wellness data for {len(wellness_data)} days ({entries_with_data} with data, {len(wellness_data) - entries_with_data} empty)")
        
        return {
            'success': True,
            'wellness_data': wellness_data,
            'count': len(wellness_data),
            'entries_with_data': entries_with_data
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
            'message': 'Usage: sync-garmin-wellness-mcp.py <start_date> <end_date>'
        }))
        sys.exit(1)
    
    start_date = sys.argv[1]
    end_date = sys.argv[2]
    
    result = sync_wellness_by_date_range(start_date, end_date)
    print(json.dumps(result))
    
    sys.exit(0 if result['success'] else 1)
