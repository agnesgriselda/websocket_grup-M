import asyncio
import websockets
import logging

logging.basicConfig(level=logging.INFO)

CONNECTIONS = set()

async def handler(websocket, path):
    CONNECTIONS.add(websocket)
    logging.info(f"Client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            if message == "ping":
                await websocket.send("pong")
                # logging.info(f"Sent 'pong' to {websocket.remote_address}")
            else:
                logging.warning(f"Received unknown message: {message} from {websocket.remote_address}")
                await websocket.send("unknown_command")
    except websockets.exceptions.ConnectionClosedOK:
        logging.info(f"Client disconnected normally: {websocket.remote_address}")
    except websockets.exceptions.ConnectionClosedError as e:
        logging.error(f"Client connection closed with error: {e} from {websocket.remote_address}")
    finally:
        CONNECTIONS.remove(websocket)
        logging.info(f"Client removed: {websocket.remote_address}")


async def main():
    async with websockets.serve(handler, "localhost", 8765):
        logging.info("WebSocket Ping-Pong server started on ws://localhost:8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("WebSocket server shutting down.")