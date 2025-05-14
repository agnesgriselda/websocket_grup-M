import asyncio
import websockets
import time

async def run_websocket_ping(uri="ws://localhost:8765"):
    async with websockets.connect(uri) as websocket:
        start_time = time.perf_counter()
        await websocket.send("ping")
        response = await websocket.recv()
        end_time = time.perf_counter()
        if response == "pong":
            return (end_time - start_time) * 1000  # Convert to milliseconds
        else:
            raise Exception(f"Unexpected WebSocket response: {response}")

async def measure_websocket_latency(num_pings=100):
    latencies = []
    for _ in range(num_pings):
        try:
            latency = await run_websocket_ping()
            latencies.append(latency)
        except Exception as e:
            print(f"WebSocket ping failed: {e}")
            # Optionally, append a high value or None, or just skip
    return latencies