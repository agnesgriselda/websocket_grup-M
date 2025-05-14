from concurrent import futures
import grpc
import time
import logging

# Pastikan generated/ ada di PYTHONPATH atau sys.path ditambah
import sys
import os

# Dapatkan direktori tempat skrip ini berada (misalnya, .../ping_pong_comparison/)
script_dir = os.path.dirname(os.path.abspath(__file__))

# Tambahkan direktori root proyek (parent dari 'generated') ke sys.path
# Ini memungkinkan 'from generated import ...'
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# Tambahkan direktori 'generated' itu sendiri ke sys.path
# Ini memungkinkan 'import pingpong_pb2' dari dalam 'pingpong_pb2_grpc.py'
# untuk menemukan 'pingpong_pb2.py' di dalam 'generated/'
generated_dir_path = os.path.join(script_dir, "generated")
if generated_dir_path not in sys.path:
    sys.path.insert(0, generated_dir_path)

from generated import pingpong_pb2
from generated import pingpong_pb2_grpc

logging.basicConfig(level=logging.INFO)

class PingPongServicer(pingpong_pb2_grpc.PingPongServiceServicer):
    def SendPing(self, request, context):
        if request.message == "ping":
            # logging.info("Received gRPC ping, sending pong")
            return pingpong_pb2.PongResponse(message="pong")
        else:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Message must be 'ping'")
            return pingpong_pb2.PongResponse()

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    pingpong_pb2_grpc.add_PingPongServiceServicer_to_server(PingPongServicer(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    logging.info("gRPC Ping-Pong server started on port 50051")
    try:
        while True:
            time.sleep(86400) # one day in seconds
    except KeyboardInterrupt:
        logging.info("gRPC server shutting down.")
        server.stop(0)

if __name__ == '__main__':
    serve()