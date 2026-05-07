from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

# Import routers from the current package
# Note: When running as a package (python -m api.app), use relative imports.
# When running inside Docker where api/ is copied to root, use absolute or adjust.
try:
    from .scan import router as scan_router
    from .scan_file import router as scan_file_router
    from .traffic import router as traffic_router
    from .metrics import router as metrics_router
    from .feedback import router as feedback_router
    from .feedback_stats import router as feedback_stats_router
except ImportError:
    from scan import router as scan_router
    from scan_file import router as scan_file_router
    from traffic import router as traffic_router
    from metrics import router as metrics_router
    from feedback import router as feedback_router
    from feedback_stats import router as feedback_stats_router

app = FastAPI(title="PurifAI API — Local Inference")

# Configure CORS for Chrome Extension access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all functional routers
app.include_router(scan_router, prefix="/api")
app.include_router(scan_file_router, prefix="/api")
app.include_router(traffic_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(feedback_stats_router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PurifAI Local Inference Backend",
        "environment": "Hugging Face Docker Space"
    }

@app.get("/api/health")
def health_check():
    return {"status": "alive", "inference": "local"}

if __name__ == "__main__":
    # HF Spaces use port 7860 by default
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
