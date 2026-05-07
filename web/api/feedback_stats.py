from fastapi import FastAPI
from .utils import get_supabase

app = FastAPI()

@app.get("/api/feedback/stats")
async def feedback_stats():
    """
    Returns the total number of feedback reports from Supabase.
    """
    try:
        supabase = get_supabase()
        # count='exact' allows getting the count without fetching all rows
        response = supabase.table("feedback").select("*", count="exact").execute()
        count = response.count if response.count is not None else 0
        return {"total_reports": count}
    except Exception as e:
        return {"total_reports": 0, "error": str(e)}
