from fastapi import FastAPI
from .utils import get_supabase

app = FastAPI()

@app.get("/api/metrics")
async def get_metrics():
    try:
        supabase = get_supabase()
        
        # Get total scanned
        scanned_res = supabase.table("scans").select("*", count="exact").execute()
        total_scanned = scanned_res.count if scanned_res.count is not None else 0
        
        # Get total blocked
        blocked_res = supabase.table("scans").select("*", count="exact").eq("is_safe", False).execute()
        total_blocked = blocked_res.count if blocked_res.count is not None else 0
        
        return {
            "scanned": total_scanned,
            "blocked": total_blocked
        }
    except Exception as e:
        return {"scanned": 0, "blocked": 0, "error": str(e)}
