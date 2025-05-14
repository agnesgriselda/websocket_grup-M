import matplotlib.pyplot as plt
import json
import numpy as np

def plot_benchmark_results(results_file="benchmark_results.json"):
    with open(results_file, "r") as f:
        results = json.load(f)

    protocols = list(results.keys())
    avg_latencies = [results[p]["avg_latency"] for p in protocols]
    
    # Filter out protocols with no successful pings (infinite latency)
    valid_protocols = [p for p, l in zip(protocols, avg_latencies) if l != float('inf')]
    valid_avg_latencies = [l for l in avg_latencies if l != float('inf')]

    if not valid_protocols:
        print("No valid data to plot.")
        return

    x_pos = np.arange(len(valid_protocols))

    # --- Bar Chart for Average Latency ---
    plt.figure(figsize=(10, 6))
    bars = plt.bar(x_pos, valid_avg_latencies, align='center', alpha=0.7, color=['skyblue', 'lightcoral', 'lightgreen'])
    plt.xticks(x_pos, valid_protocols)
    plt.ylabel('Average Latency (ms)')
    plt.title(f'Average Ping-Pong Latency Comparison ({results.get(protocols[0], {}).get("num_pings", "N/A")} pings)')
    plt.grid(axis='y', linestyle='--')

    # Add text labels on top of bars
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2.0, yval + 0.01 * max(valid_avg_latencies), f'{yval:.3f} ms', ha='center', va='bottom')

    plt.savefig("average_latency_comparison.png")
    print("Saved average latency comparison to average_latency_comparison.png")
    plt.show()

    # --- Box Plot for Latency Distribution ---
    all_latencies_data = []
    plot_labels = []
    for protocol in valid_protocols:
        latencies = results[protocol]["all_latencies"]
        if latencies: # Hanya plot jika ada data latensi
            all_latencies_data.append(latencies)
            plot_labels.append(protocol)

    if all_latencies_data:
        plt.figure(figsize=(12, 7))
        plt.boxplot(all_latencies_data, labels=plot_labels, showfliers=True) # showfliers=False untuk menghilangkan outliers jika terlalu banyak
        plt.ylabel('Latency (ms)')
        plt.title(f'Latency Distribution Comparison ({results.get(protocols[0], {}).get("num_pings", "N/A")} pings)')
        plt.grid(axis='y', linestyle='--')
        plt.savefig("latency_distribution_comparison.png")
        print("Saved latency distribution comparison to latency_distribution_comparison.png")
        plt.show()
    else:
        print("No detailed latency data to plot distribution.")


if __name__ == "__main__":
    try:
        plot_benchmark_results()
    except FileNotFoundError:
        print("Error: benchmark_results.json not found. Run benchmark.py first.")
    except Exception as e:
        print(f"An error occurred during plotting: {e}")