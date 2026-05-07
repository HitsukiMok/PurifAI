from fastapi import APIRouter, Request
from utils import get_supabase
from datetime import datetime

router = APIRouter()

@router.get("/traffic")
async def traffic_scans(since: str = None):
    """
    Return scans newer than `since` (ISO format).
    The dashboard polls this every few seconds.
    """
    try:
        supabase = get_supabase()
        query = supabase.table("scans").select("*").order("timestamp", desc=True).limit(100)
        
        if since:
            query = query.gt("timestamp", since)
            
        response = query.execute()
        scans = response.data if response.data else []
        
        # Calculate metrics for the response (or get from another table if cached)
        # For MVP, we can calculate them on the fly or just return the scans
        return {
            "scans": scans
        }
    except Exception as e:
        return {"scans": [], "error": str(e)}
