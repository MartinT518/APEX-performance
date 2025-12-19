
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

# Add MCP source to path
project_root = Path(__file__).parent.parent
mcp_src = project_root / 'garmin-connect-mcp-main' / 'src'
sys.path.insert(0, str(mcp_src))

from garmin_connect_mcp.client import (
    init_garmin_client,
    GarminClientWrapper
)
from garmin_connect_mcp.auth import load_config

def test_details(activity_id):
    env_path = project_root / '.env.local'
    load_dotenv(env_path)
    config = load_config()
    garmin = init_garmin_client(config)
    if not garmin:
        print("Auth failed")
        return
    
    client = GarminClientWrapper(garmin)
    
    print(f"Fetching get_activity for {activity_id}...")
    act = client.safe_call('get_activity', activity_id)
    with open('debug_act.json', 'w') as f:
        json.dump(act, f, indent=2)
        
    print(f"Fetching get_activity_details for {activity_id}...")
    try:
        details = client.safe_call('get_activity_details', activity_id)
        with open('debug_details.json', 'w') as f:
            json.dump(details, f, indent=2)
        print("Details saved to debug_details.json")
    except Exception as e:
        print(f"get_activity_details failed: {e}")

if __name__ == '__main__':
    test_details(21283985151)
