from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 🧪 Isolation Test: Temporarily comment out sub-routers
# from .scan import router as scan_router
# from .scan_file import router as scan_file_router
# from .traffic import router as traffic_router
# from .metrics import router as metrics_router
# from .feedback import router as feedback_router
# from .feedback_stats import router as feedback_stats_router

app = FastAPI(title="PurifAI API")

# Crucial for Vercel: Allow your frontend to talk to your backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change this to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers (Commented out for isolation test)
# app.include_router(scan_router, prefix="/api")
# app.include_router(scan_file_router, prefix="/api")
# app.include_router(traffic_router, prefix="/api")
# app.include_router(metrics_router, prefix="/api")
# app.include_router(feedback_router, prefix="/api")
# app.include_router(feedback_stats_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "alive", "message": "Vercel Python is working!"}