
import io
import zipfile
import fitparse
from garminconnect import Garmin

from ..auth import load_config
from ..client import init_garmin_client, GarminClientWrapper
from ..response_builder import ResponseBuilder

async def get_activity_fit_stream(activity_id: int) -> str:
    """
    Download and parse raw FIT file to extract high-fidelity streams.
    
    Crucial for 'Cadence Lock' detection (FR-K2) as it preserves raw data 
    without API smoothing.
    
    Args:
        activity_id: The Garmin Activity ID.
        
    Returns:
        JSON string containing list of records with [timestamp, heart_rate, cadence, speed].
    """
    try:
        config = load_config()
        client = init_garmin_client(config)
        if not client:
             return ResponseBuilder.build_error_response("Failed to initialize Garmin client")
             
        wrapper = GarminClientWrapper(client)

        # Download original file (comes as ZIP)
        zip_bytes = wrapper.safe_call("download_activity", activity_id, dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL)
        
        # Unzip
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            # Look for .fit file
            fit_files = [f for f in z.namelist() if f.lower().endswith('.fit')]
            if not fit_files:
                return ResponseBuilder.build_error_response("No FIT file found in download")
            
            fit_content = z.read(fit_files[0])
            
        # Parse FIT
        fitfile = fitparse.FitFile(io.BytesIO(fit_content))
        
        records = []
        for record in fitfile.get_messages("record"):
            point = {}
            # metrics of interest
            for data in record:
                if data.name in ['timestamp', 'heart_rate', 'cadence', 'speed', 'distance']:
                    # Handle timestamp to string if needed, or keep as object if json serializer handles it
                    # Usually better to isoformat
                    if data.name == 'timestamp' and hasattr(data.value, 'isoformat'):
                        point[data.name] = data.value.isoformat()
                    else:
                        point[data.name] = data.value
            
            if point: # Only add non-empty
                records.append(point)
                
        return ResponseBuilder.build_response(
            data={"stream": records, "count": len(records)},
            metadata={"source": "raw_fit_parse", "activity_id": activity_id}
        )

    except Exception as e:
        return ResponseBuilder.build_error_response(f"Failed to process FIT file: {str(e)}")
