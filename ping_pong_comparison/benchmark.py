import asyncio
import time
import numpy as np # Untuk rata-rata dan std dev

from websocket_client_logic import measure_websocket_latency
from rest_client_logic import measure_rest_latency
from grpc_client_logic import measure_grpc_latency

NUM_PINGS = 1000 # Jumlah ping-pong untuk diukur

async def main():
    print(f"Starting benchmark with {NUM_PINGS} pings per protocol...\n")

    # --- WebSocket Benchmark ---
    print("Benchmarking WebSocket...")
    start_ws = time.perf_counter()
    ws_latencies = await measure_websocket_latency(NUM_PINGS)
    end_ws = time.perf_counter()
    if ws_latencies:
        avg_ws_latency = np.mean(ws_latencies)
        std_ws_latency = np.std(ws_latencies)
        print(f"WebSocket: {NUM_PINGS} pings in {end_ws - start_ws:.2f}s")
        print(f"  Avg Latency: {avg_ws_latency:.4f} ms")
        print(f"  Std Dev Latency: {std_ws_latency:.4f} ms")
        print(f"  Min Latency: {np.min(ws_latencies):.4f} ms")
        print(f"  Max Latency: {np.max(ws_latencies):.4f} ms")
    else:
        print("WebSocket: No successful pings.")
        avg_ws_latency = float('inf') # Agar tidak error di plotting jika gagal
    print("-" * 30)

    # --- REST API Benchmark ---
    print("Benchmarking REST API (FastAPI)...")
    start_rest = time.perf_counter()
    rest_latencies = measure_rest_latency(NUM_PINGS) # Ini fungsi sinkron
    end_rest = time.perf_counter()
    if rest_latencies:
        avg_rest_latency = np.mean(rest_latencies)
        std_rest_latency = np.std(rest_latencies)
        print(f"REST API: {NUM_PINGS} pings in {end_rest - start_rest:.2f}s")
        print(f"  Avg Latency: {avg_rest_latency:.4f} ms")
        print(f"  Std Dev Latency: {std_rest_latency:.4f} ms")
        print(f"  Min Latency: {np.min(rest_latencies):.4f} ms")
        print(f"  Max Latency: {np.max(rest_latencies):.4f} ms")
    else:
        print("REST API: No successful pings.")
        avg_rest_latency = float('inf')
    print("-" * 30)

    # --- gRPC Benchmark ---
    print("Benchmarking gRPC...")
    start_grpc = time.perf_counter()
    grpc_latencies = measure_grpc_latency(NUM_PINGS) # Ini fungsi sinkron
    end_grpc = time.perf_counter()
    if grpc_latencies:
        avg_grpc_latency = np.mean(grpc_latencies)
        std_grpc_latency = np.std(grpc_latencies)
        print(f"gRPC: {NUM_PINGS} pings in {end_grpc - start_grpc:.2f}s")
        print(f"  Avg Latency: {avg_grpc_latency:.4f} ms")
        print(f"  Std Dev Latency: {std_grpc_latency:.4f} ms")
        print(f"  Min Latency: {np.min(grpc_latencies):.4f} ms")
        print(f"  Max Latency: {np.max(grpc_latencies):.4f} ms")
    else:
        print("gRPC: No successful pings.")
        avg_grpc_latency = float('inf')
    print("-" * 30)

    # Data untuk plotting
    results = {
        "WebSocket": {"avg_latency": avg_ws_latency, "all_latencies": ws_latencies},
        "REST API": {"avg_latency": avg_rest_latency, "all_latencies": rest_latencies},
        "gRPC": {"avg_latency": avg_grpc_latency, "all_latencies": grpc_latencies},
    }
    
    # Simpan hasil untuk diplot oleh skrip terpisah
    # atau bisa langsung panggil fungsi plot dari sini
    import json
    with open("benchmark_results.json", "w") as f:
        # Mengubah numpy array menjadi list agar bisa di-serialize JSON
        serializable_results = {}
        for key, value in results.items():
            serializable_results[key] = {
                "avg_latency": value["avg_latency"],
                "all_latencies": [float(l) for l in value["all_latencies"]] if value["all_latencies"] else []
            }
        json.dump(serializable_results, f, indent=2)
    print("\nBenchmark results saved to benchmark_results.json")
    print("Run plot_results.py to visualize.")

if __name__ == "__main__":
    # Pastikan server-server sudah berjalan sebelum menjalankan benchmark ini
    # Idealnya, start server di proses terpisah
    print("MAKE SURE ALL SERVERS (WebSocket, REST, gRPC) ARE RUNNING IN SEPARATE TERMINALS!")
    input("Press Enter to start benchmark once servers are running...")
    asyncio.run(main())