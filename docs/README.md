# Performance Optimization: Load Visualization

This document describes the performance optimizations made to the "Load Visualization" flow in the Time Travelling Visualizer. The goal was to reduce the loading time when a user clicks "Load Result" in the VS Code extension, which was extremely slow for large datasets.


## Context 

When a user clicked "Load Result", the system loaded data for every epoch sequentially. For each epoch, it:

1. Fetched the 2D projection coordinates
2. Fetched the model's predictions
3. Fetched the background image
4. **Computed k-nearest neighbors (k-NN) for ALL points in high-dimensional space**
5. **Computed k-nearest neighbors for ALL points in projection space**

Steps 4 and 5 were the bottleneck. For a dataset with N=5000 points and 20 epochs:
- Each k-NN call computes distances between all pairs of points — O(N²) per epoch
- This ran sequentially: 20 epochs × 2 neighbor types × O(N²) = extremely slow
- Most of this work was wasted — users typically only hover over a handful of points

Additionally, the epochs loaded one at a time (sequential), meaning each epoch had to finish before the next could start.

---

## Architecture Context

The project has three layers:

1. **Extension** (`extension/src/`): Hosts the webview, sends commands like `loadVisualization`
2. **Web Frontend** (`web/src/`): React app that renders the scatter plot, handles user interaction
3. **Backend** (`tool/server/`): Flask API that reads data from disk and performs computations like k-NN

The "Load Visualization" flow:
1. User clicks "Load Result" in VS Code
2. Extension sends `loadVisualization` message to the webview
3. `plotView.tsx` receives it, makes HTTP calls to the Flask backend for each epoch
4. Data is stored in the Zustand global store (`state.unified.ts`)
5. `chart.tsx` renders the scatter plot from the store data

---

## Solution

### Approach 1: Lazy Neighbor Loading

**Concept**: Previously the neighbors where calculated for every point of every epoch before the visualization started. The lazy loading approach calculates the neighbors only when a point is hovered

#### 1.1 — Removed neighbors from EpochData type

**File**: `web/src/state/state.unified.ts`

The `EpochData` type originally contained `originalNeighbors` and `projectionNeighbors` arrays (one entry per point per epoch). These were commented out since neighbors are no longer loaded per epoch:

```typescript
export type EpochData = {
    projection: number[][];
    prediction: number[];
    predProbability: number[][];
    // originalNeighbors: number[][];     ← removed
    // projectionNeighbors: number[][];   ← removed
    background: string;
};
```

#### 1.2 — Added `neighborCache` and `visId` to global store

**File**: `web/src/state/state.unified.ts`

Two new fields were added to `BaseMutableGlobalStore`:

- **`visId: string`** — Stores the visualization ID globally so its possible to make api calls outside plotView. 

- **`neighborCache** — A dictionary with keys `"epoch-pointIndex"` to save already fetched points.



#### 1.3 — On-demand neighbor fetching in chart.tsx

**File**: `web/src/component/chart.tsx`

A new `useEffect` hook triggers when the user hovers a point:

1. Checks if neighbor overlays are enabled (`revealOriginalNeighbors` or `revealProjectionNeighbors`)

2. Builds a cache key: `"${epoch}-${hoveredIndex}"`

3. If the key exists in `neighborCache`, it means the point is already cached

4. Otherwise, calls `BackendAPI.getNeighborsForSample(contentPath, visId, epoch, hoveredIndex)`

5. Stores the result in `neighborCache`

6. Includes a `cancelled` flag for cleanup if the hover changes before the fetch completes


The `neighborOverlayProps` useMemo was also updated to read from `neighborCache[cacheKey]`.

#### 1.4 — Updated sample-panel.tsx to read from cache

**File**: `web/src/component/sample-panel.tsx`

The neighbor lists in the detail panel (shown when hovering a point) were updated from:
```
allEpochData[epoch]?.originalNeighbors[hoveredIndex]?.map(...)
```
to:
```
neighborCache[`${epoch}-${hoveredIndex}`]?.originalNeighbors?.map(...)
```

This applies to three places:
- The HIGH-DIM neighbor list

- The PROJECTION neighbor list

- The `isCorrect` check (highlights projection neighbors that are also high-dim neighbors)

The `?.` optional chaining is important because the cache entry doesn't exist yet when the user first hovers — it appears after the async fetch completes and triggers a re-render.

#### 1.5 — New frontend API function

**File**: `web/src/communication/backend.ts`

Added `getNeighborsForSample()` function that calls the api endpoint to get the neighbors original and projection for a single point.

#### 1.6 — New backend endpoint

**File**: `tool/server/server.py`

Added `POST /getNeighborsForSample` endpoint:

- Accepts: `content_path`, `vis_id`, `epoch`, `sample_index`

- Calls `calculate_neighbors_for_point()` and `calculate_projection_neighbors_for_point()`

- Returns: `{ originalNeighbors: [...], projectionNeighbors: [...] }`

#### 1.7 — Per-point k-NN functions

**File**: `tool/server/server_utils.py`

Two new functions:

**`calculate_neighbors_for_point(content_path, vis_id, epoch, point_index, max_neighbors=10)`**
- Loads high-dimensional embeddings from `epochs/epoch_N/embeddings.npy`
- Builds a k-NN index with sklearn's `NearestNeighbors`
- Queries **only the single point** at `point_index`
- Returns up to 10 neighbor indices

**`calculate_projection_neighbors_for_point(content_path, vis_id, epoch, point_index, max_neighbors=10)`**
- Same approach but uses 2D projection coordinates from `visualize/{vis_id}/epochs/epoch_N/projection.npy`

Note: `calculate_neighbors_for_point` takes `vis_id` as a parameter for API consistency but doesn't use it — high-dimensional embeddings don't depend on the visualization method. `calculate_projection_neighbors_for_point` does use `vis_id` because different visualization methods produce different projections.

**Why this is fast**: Building the k-NN index (.fit()) on 5000 points takes ~5–20ms. Querying 1 point is nearly instant. The old approach queried all 5000 points, which was the actual bottleneck.

---

### Strategy 2: Parallel Epoch Batching

**Concept**: Instead of loading epochs sequentially, load them in parallel batches.

#### 2.1 — Batch loading loop in plotView.tsx

**File**: `web/src/views/plotView.tsx`

The old sequential loop:
```
for each epoch:
    await fetchProjection(epoch)
    await fetchPrediction(epoch)
    await fetchBackground(epoch)
    await fetchOriginalNeighbors(epoch)      ← removed
    await fetchProjectionNeighbors(epoch)     ← removed
```

Was replaced with a parallel batched approach:

```typescript
const BATCH_SIZE = 5;

const loadSingleEpoch = async (epochNum) => {
    // All requests for one epoch fire in parallel
    const results = await Promise.all([
        fetchEpochProjection(...),
        getAttributeResource('prediction'),
        getBackground(...)
    ]);
    return { epochNum, epochData };
};

// Process in batches of 5
for (let i = 0; i < epochs.length; i += BATCH_SIZE) {
    const batch = epochs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(loadSingleEpoch));
    // Update store after each batch (progressive loading)
    setValue('allEpochData', { ...allEpochDataTemp });
    setProgress((completedCount / epochs.length) * 100);
}
```

This means:
- Within each epoch: projection + prediction + background fire simultaneously
- Across epochs: 5 epochs load at the same time per batch
- After each batch: the store updates so the UI can show partial results immediately

#### 2.2 — Enabled threaded Flask server

**File**: `tool/server/server.py`

Added `threaded=True` to `app.run()`:
```python
app.run(host=host, port=port, threaded=True)
```

Without this, Flask processes requests one at a time, negating the benefit of parallel frontend requests. With `threaded=True`, each request gets its own thread and multiple requests are handled concurrently.

#### 2.3 — `visId` stored during load

**File**: `web/src/views/plotView.tsx`

Added `setValue('visId', visualizationID)` at the start of `handleLoadVisualization` so the visualization ID is available globally for lazy neighbor fetching later.

---

### Extra: Loading Progress Overlay

**File**: `web/src/component/main-block.tsx`

A new `LoadingOverlay` component was added that renders on top of the chart during loading:

```typescript
function LoadingOverlay({ progress, totalEpochs }) {
    if (progress <= 0 || progress >= 100) return null;
    const loadedEpochs = Math.round((progress / 100) * totalEpochs);
    return (
        <div style={{ /* semi-transparent overlay */ }}>
            <div>Loading epoch {loadedEpochs} / {totalEpochs}</div>
            <div>/* progress bar */</div>
            <div>{Math.round(progress)}%</div>
        </div>
    );
}
```

It shows:
- **"Loading epoch 5 / 20"** — text counter
- **A blue progress bar** — fills left-to-right with CSS transition
- **Percentage** — e.g. "25%"

It automatically appears when `progress > 0` and disappears when `progress >= 100`. The existing timeline node coloring (which turns nodes blue as they load) continues to work alongside this overlay.

The `progress` state is updated in `plotView.tsx` after each batch completes:
```typescript
setProgress((completedCount / epochs.length) * 100);
```

---

### Extra: Performance Benchmark Script

**File**: `tool/benchmark.py`

A standalone Python script that measures the old vs new approach by making actual HTTP calls to the Flask backend.

**Usage**:
```bash
python tool/benchmark.py --content_path /path/to/dataset --vis_id TimeVis_1
```

**Optional arguments**:
- `--hover_points N` — number of hover events to simulate (default: 5)
- `--max_epochs N` — limit epochs to benchmark (default: all)

**What it measures**:

| Phase | OLD approach | NEW approach |
|---|---|---|
| Loading | Sequential: projection + prediction + background + ALL-point neighbors × each epoch | Parallel batches of 5: projection + prediction + background only |
| Neighbors | Included in load time (all points, all epochs) | On-demand: single-point fetch per hover event |

**Output**: Prints per-epoch/batch times, then a summary:
```
SUMMARY
  OLD total load:     45.23s
  NEW total load:      4.12s
  ⚡ Loading speedup:  11.0x faster
  ⚡ Time saved:       41.1s
  ⚡ Hover latency:    85ms (imperceptible to user)
```

The script requires the Flask backend to be running (`python tool/server/server.py`).

---

### Bug Fix: Extension Development Path

**File**: `.vscode/launch.json`

Changed:
```
--extensionDevelopmentPath=${workspaceFolder}
```
to:
```
--extensionDevelopmentPath=${workspaceFolder}/extension
```

The old path pointed to the workspace root, causing VS Code to scan all subfolders and find `web/package.json` — which it tried to load as a VS Code extension, failing because it lacked the required `engines` field. The fix points directly to the `extension/` folder.

---

## File-by-File Reference

| File | Changes | Strategy |
|---|---|---|
| `web/src/state/state.unified.ts` | Commented out neighbors from `EpochData`, added `visId`, `neighborCache` | Lazy neighbors |
| `web/src/views/plotView.tsx` | Stored `visId`, replaced sequential loop with parallel batches of 5, removed neighbor calls | Parallel + Lazy |
| `web/src/component/chart.tsx` | Added on-demand neighbor fetch `useEffect`, reads from `neighborCache` | Lazy neighbors |
| `web/src/component/sample-panel.tsx` | Reads neighbor lists from `neighborCache` instead of `allEpochData` | Lazy neighbors |
| `web/src/communication/backend.ts` | Added `getNeighborsForSample()` API function | Lazy neighbors |
| `tool/server/server.py` | Added `/getNeighborsForSample` endpoint, `threaded=True` | Lazy + Parallel |
| `tool/server/server_utils.py` | Added `calculate_neighbors_for_point()`, `calculate_projection_neighbors_for_point()` | Lazy neighbors |
| `web/src/component/main-block.tsx` | Added `LoadingOverlay` component | Progress bar |
| `tool/benchmark.py` | New benchmark script comparing old vs new approach | Benchmark |
| `.vscode/launch.json` | Fixed `extensionDevelopmentPath` to point to `extension/` | Bug fix |

---

## How to Run the Benchmark

1. Start the backend server:
   ```bash
   cd tool/server
   python server.py
   ```

2. Run the benchmark:
   ```bash
   python tool/benchmark.py --content_path /path/to/your/dataset --vis_id YourVisId
   ```

3. Optional: limit to fewer epochs for a quick test:
   ```bash
   python tool/benchmark.py --content_path /path/to/dataset --vis_id TimeVis_1 --max_epochs 5
   ```

To find your `vis_id`, look at the folder names inside your dataset's `visualize/` directory:
```bash
ls /path/to/your/dataset/visualize/
```

---

## Concepts and Foundations

### Embeddings
High-dimensional vectors (e.g., 128 or 512 dimensions) that a neural network produces for each data point. Points that the model considers similar have embeddings that are close together in this space.

### Epochs
Each epoch is one full pass through the training data. The model's embeddings change at each epoch as it learns. The visualizer shows how these embeddings evolve over time.

### Dimensionality Reduction (Projection)
Algorithms like DVI, TimeVis, or UMAP reduce high-dimensional embeddings (e.g., 128D) down to 2D coordinates so they can be plotted on a scatter chart. Each visualization method (`vis_id`) produces a different 2D layout.

### k-Nearest Neighbors (k-NN)
For any given point, k-NN finds the k closest points by distance. The visualizer uses two types:
- **Original neighbors**: k-NN in the high-dimensional embedding space (the "true" neighbors)
- **Projection neighbors**: k-NN in the 2D projected space

Comparing these two reveals whether the 2D projection preserves the true neighborhood structure. Projection neighbors shown in green are also original neighbors (good projection); those in red are not (distortion).

### Lazy Loading
A pattern where data is only fetched when it's actually needed, rather than upfront. In this case, neighbors are fetched only when the user hovers a point, not for all points at load time.

### Parallel Batching
Instead of processing items one at a time (sequential), multiple items are processed simultaneously (parallel). `Promise.all` in JavaScript and `ThreadPoolExecutor` in Python are used to achieve this. The batch size (5) balances parallelism with not overwhelming the server.

### Caching
Storing previously computed results so they don't need to be recomputed. The `neighborCache` stores neighbors keyed by `"epoch-pointIndex"`. If the user hovers the same point again, the cached result is returned instantly without any API call.
