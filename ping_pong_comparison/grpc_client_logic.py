import grpc
import time

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

def run_grpc_ping(stub):
    request = pingpong_pb2.PingRequest(message="ping")
    start_time = time.perf_counter()
    response = stub.SendPing(request)
    end_time = time.perf_counter()

    if response.message == "pong":
        return (end_time - start_time) * 1000  # Convert to milliseconds
    else:
        raise Exception(f"Unexpected gRPC response: {response.message}")

def measure_grpc_latency(num_pings=100, target='localhost:50051'):
    latencies = []
    # Buat channel sekali untuk semua ping, ini lebih efisien
    with grpc.insecure_channel(target) as channel:
        stub = pingpong_pb2_grpc.PingPongServiceStub(channel)
        for _ in range(num_pings):
            try:
                latency = run_grpc_ping(stub)
                latencies.append(latency)
            except Exception as e:
                print(f"gRPC ping failed: {e}")
    return latencies