from fastapi import FastAPI
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
app = FastAPI()

@app.get("/ping")
async def ping():
    # logging.info("Received GET /ping, sending 'pong'")
    return {"message": "pong"}

@app.post("/ping_post") # Kadang POST digunakan untuk request yang lebih "aktif"
async def ping_post():
    # logging.info("Received POST /ping_post, sending 'pong'")
    return {"message": "pong"}

if __name__ == "__main__":
    logging.info("REST API Ping-Pong server starting on http://localhost:8000")
    uvicorn.run(app, host="localhost", port=8000, log_level="warning") # log_level warning agar tidak terlalu verbose