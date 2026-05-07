from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import your separated route files
# (Ensure your other files use router = APIRouter() instead of app = FastAPI())
from api.scan import router as scan_router
from api.scan_file import router as scan_file_router
from api.traffic import router as traffic_router
from api.metrics import router as metrics_router

app = FastAPI(title="PurifAI API")

# Crucial for Vercel: Allow your frontend to talk to your backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change this to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(scan_router, prefix="/api")
app.include_router(scan_file_router, prefix="/api")
app.include_router(traffic_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "deployment": "vercel-serverless"}