import argparse
import time
import requests
import concurrent.futures
import json
import sys
import os
from pathlib import Path

# Load BATCH_SIZE from root .env file
_env_path = Path(__file__).resolve().parent.parent / '.env'
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        if line.startswith('VITE_BATCH_SIZE='):
            os.environ['VITE_BATCH_SIZE'] = line.split('=', 1)[1].strip()

SERVER_URL = "http://localhost:5050"
BATCH_SIZE = int(os.environ.get('VITE_BATCH_SIZE', 5))


def timed(fn):
    start = time.perf_counter()
    result = fn()
    elapsed = time.perf_counter() - start
    return result, elapsed


def get_available_epochs(content_path):
    resp = requests.get(f"{SERVER_URL}/getTrainingProcessInfo", params={"content_path": content_path})
    resp.raise_for_status()
    data = resp.json()
    return data["available_epochs"]


def fetch_projection(content_path, vis_id, epoch):
    resp = requests.post(f"{SERVER_URL}/updateProjection", json={
        "content_path": content_path, "vis_id": vis_id, "epoch": str(epoch)
    })
    resp.raise_for_status()
    return resp.json()


def fetch_prediction(content_path, epoch):
    resp = requests.post(f"{SERVER_URL}/getAttributes", json={
        "content_path": content_path, "epoch": str(epoch), "attributes": ["prediction"]
    })
    resp.raise_for_status()
    return resp.json()


def fetch_background(content_path, vis_id, epoch):
    resp = requests.post(f"{SERVER_URL}/getBackground", json={
        "content_path": content_path, "vis_id": vis_id, "epoch": str(epoch)
    })
    resp.raise_for_status()
    return resp.json()


def fetch_original_neighbors_all(content_path, epoch):
    """old: compute neighbors for ALL points at this epoch."""
    resp = requests.post(f"{SERVER_URL}/getOriginalNeighbors", json={
        "content_path": content_path, "epoch": str(epoch)
    })
    resp.raise_for_status()
    return resp.json()


def fetch_projection_neighbors_all(content_path, vis_id, epoch):
    """old: compute projection neighbors for ALL points at this epoch."""
    resp = requests.post(f"{SERVER_URL}/getProjectionNeighbors", json={
        "content_path": content_path, "vis_id": vis_id, "epoch": str(epoch)
    })
    resp.raise_for_status()
    return resp.json()


def fetch_neighbors_single_point(content_path, vis_id, epoch, sample_index):
    resp = requests.post(f"{SERVER_URL}/getNeighborsForSample", json={
        "content_path": content_path, "vis_id": vis_id,
        "epoch": epoch, "sample_index": sample_index
    })
    resp.raise_for_status()
    return resp.json()


# ─── old approach: sequencial and all neighbors ───────────────────────────

def benchmark_old(content_path, vis_id, epochs):
    print("\n" + "#" * 60)
    print("old approach: sequencial and all neighbors")
    print("#" * 60)

    total_start = time.perf_counter()
    epoch_times = []

    for epoch in epochs:
        epoch_start = time.perf_counter()

        # load data sequentially (projection, prediction, background)
        fetch_projection(content_path, vis_id, epoch)
        fetch_prediction(content_path, epoch)
        fetch_background(content_path, vis_id, epoch)

        # compute neighbors for all points
        fetch_original_neighbors_all(content_path, epoch)
        fetch_projection_neighbors_all(content_path, vis_id, epoch)

        epoch_elapsed = time.perf_counter() - epoch_start
        epoch_times.append(epoch_elapsed)
        print(f"  Epoch {epoch:>3d}: {epoch_elapsed:.2f}s")

    total_elapsed = time.perf_counter() - total_start
    avg_epoch = sum(epoch_times) / len(epoch_times)

    print(f"\n  Total:     {total_elapsed:.2f}s")
    print(f"  Avg/epoch: {avg_epoch:.2f}s")
    return total_elapsed, epoch_times


# ─── new approach: lazy loading and batches ─────────────────────

def benchmark_new(content_path, vis_id, epochs, hover_points=5):
    print("\n" + "#" * 60)
    print("new approach: lazy loading and batches ")
    print("#" * 60)

    # 1- load epoch data in parallel batches
    phase1_start = time.perf_counter()
    batch_times = []

    for i in range(0, len(epochs), BATCH_SIZE):
        batch = epochs[i:i + BATCH_SIZE]
        batch_start = time.perf_counter()
        
        # use concurrent.futures to load projection, prediction, and background for each epoch in the batch in parallel
        # TODO: see better options
        with concurrent.futures.ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
            futures = []
            for epoch in batch:
                futures.append(executor.submit(fetch_projection, content_path, vis_id, epoch))
                futures.append(executor.submit(fetch_prediction, content_path, epoch))
                futures.append(executor.submit(fetch_background, content_path, vis_id, epoch))

            concurrent.futures.wait(futures)

        batch_elapsed = time.perf_counter() - batch_start
        batch_times.append(batch_elapsed)
        print(f"  Batch {i // BATCH_SIZE + 1} (epochs {batch[0]}-{batch[-1]}): {batch_elapsed:.2f}s")

    phase1_elapsed = time.perf_counter() - phase1_start

    # 2- simulate hovering over a few points (on-demand neighbor fetch)
    phase2_start = time.perf_counter()
    hover_times = []

    test_epoch = epochs[0]
    print(f"\n  Simulating {hover_points} hover events at epoch {test_epoch}...")

    for point_idx in range(hover_points):
        _, t = timed(lambda idx=point_idx: fetch_neighbors_single_point(
            content_path, vis_id, test_epoch, idx
        ))
        hover_times.append(t)
        print(f"    Point {point_idx}: {t * 1000:.0f}ms")

    phase2_elapsed = time.perf_counter() - phase2_start
    avg_hover = (sum(hover_times) / len(hover_times)) * 1000  # in ms

    total_elapsed = phase1_elapsed  # loading time is what the user waits for
    print(f"\n  Loading total:   {phase1_elapsed:.2f}s")
    print(f"  Avg hover time:  {avg_hover:.0f}ms")
    return phase1_elapsed, phase2_elapsed, batch_times, hover_times


# ─── summary ─────────────────────────────────────────────────────────────

def print_summary(old_total, new_loading, new_hover_times, num_epochs, hover_points):
    avg_hover_ms = (sum(new_hover_times) / len(new_hover_times)) * 1000

    print("\n" + "#" * 60)
    print("SUMMARY")
    print("#" * 60)
    print(f"  Epochs:             {num_epochs}")
    print(f"  Hover points:       {hover_points}")
    print(f" ")
    print(f"  OLD total load:     {old_total:.2f}s")
    print(f"  NEW total load:     {new_loading:.2f}s")
    print(f"  NEW avg hover:      {avg_hover_ms:.0f}ms")
    print(f" ")

    speedup = old_total / new_loading if new_loading > 0 else float('inf')
    saved = old_total - new_loading
    print(f"  - Loading speedup:  {speedup:.1f}x faster")
    print(f"  - Time saved:       {saved:.1f}s")
    print(f"  - Hover latency:    {avg_hover_ms:.0f}ms")
    print("#" * 60)


def main():
    parser = argparse.ArgumentParser(description="Benchmark old vs new loading approach")
    parser.add_argument("--content_path", required=True, help="Path to the dataset directory")
    parser.add_argument("--vis_id", required=True, help="Visualization ID")
    parser.add_argument("--hover_points", type=int, default=5, help="Number of points to simulate hovering (default: 5)")
    parser.add_argument("--max_epochs", type=int, default=None, help="Limit number of epochs to benchmark (default: all)")
    args = parser.parse_args()

    # Verify server is running
    try:
        requests.get(f"{SERVER_URL}/", timeout=3)
    except requests.ConnectionError:
        print(f"ERROR: Cannot connect to backend at {SERVER_URL}")
        print("start the server first: python tool/server/server.py")
        sys.exit(1)

    # Get available epochs
    epochs = get_available_epochs(args.content_path)
    if args.max_epochs:
        epochs = epochs[:args.max_epochs]

    print(f"Benchmarking with {len(epochs)} epochs at: {args.content_path}")
    print(f"Visualization ID: {args.vis_id}")

    # Run benchmarks
    old_total, old_epoch_times = benchmark_old(args.content_path, args.vis_id, epochs)
    new_loading, new_hover_total, new_batch_times, new_hover_times = benchmark_new(
        args.content_path, args.vis_id, epochs, args.hover_points
    )

    # Print comparison
    print_summary(old_total, new_loading, new_hover_times, len(epochs), args.hover_points)


if __name__ == "__main__":
    main()
