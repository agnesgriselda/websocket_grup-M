import requests
import time

def run_rest_ping(url="http://localhost:8000/ping"):
    start_time = time.perf_counter()
    response = requests.get(url)
    response.raise_for_status() # Raise an exception for bad status codes
    data = response.json()
    end_time = time.perf_counter()

    if data.get("message") == "pong":
        return (end_time - start_time) * 1000  # Convert to milliseconds
    else:
        raise Exception(f"Unexpected REST response: {data}")

def measure_rest_latency(num_pings=100):
    latencies = []
    # Sesi untuk re-use koneksi TCP, bisa lebih cepat untuk banyak request
    with requests.Session() as session:
        for _ in range(num_pings):
            try:
                start_time = time.perf_counter()
                response = session.get("http://localhost:8000/ping")
                response.raise_for_status()
                data = response.json()
                end_time = time.perf_counter()

                if data.get("message") == "pong":
                    latencies.append((end_time - start_time) * 1000)
                else:
                    raise Exception(f"Unexpected REST response: {data}")
            except Exception as e:
                print(f"REST ping failed: {e}")
    return latencies