from fastapi import FastAPI

app = FastAPI()

@app.get("/api")
def read_root():
    return {"status": "PurifAI Serverless Backend is running"}
