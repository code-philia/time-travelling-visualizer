# Performance Optimization: Load Visualization

This document describes the performance optimizations made to the "Load Visualization" flow in the Time Travelling Visualizer. The goal was to reduce the loading time when a user clicks "Load Result" in the VS Code extension, which was extremely slow for large datasets.


## Context 

When a user clicked "Load Result", the system loaded data for every epoch sequentially. For each epoch, it:

1. Fetched the 2D projection coordinates
2. Fetched the model's predictions
3. Fetched the background image
4. **Computed k-nearest neighbors (k-NN) for ALL points in high-dimensional space**
5. **Computed k-nearest neighbors for ALL points in projection space**

Steps 4 and 5 were the problem. For a dataset with N=5000 points and 20 epochs:

- Each kNN call computes distances between all pairs of points — O(N²) per epoch. This ran sequentially: 20 epochs × 2 neighbor types × O(N²) = extremely slow

- The epochs loaded one at a time (sequential), meaning each epoch had to finish before the next could start.


## Architecture Context

The project has three layers:

1. **Extension** (`extension/src/`): Hosts the webview, sends commands like `loadVisualization`

2. **Web Frontend** (`web/src/`): React app that renders the scatter plot, handles user interaction

3. **Backend** (`tool/server/`): Flask API that reads data from disk and performs computations like KNN

The "Load Visualization" flow:

1. User clicks "Load Result" in  vscode

2. Extension sends `loadVisualization` message to the web view

3. `plotView.tsx` receives it, makes http calls to the flask backend for each epoch

4. Data is stored in the Zustand global store (`state.unified.ts`).

5. `chart.tsx` renders the plot from the store data.


## Solution

### Approach 1: Lazy Neighbor Loading

**Concept**: Previously the neighbors where calculated for every point of every epoch before the visualization started. The lazy loading approach calculates the neighbors only when a point is hovered.

#### 1.1 — Removed neighbors from EpochData type

**File**: `web/src/state/state.unified.ts`

The `EpochData` type originally contained `originalNeighbors` and `projectionNeighbors` arrays (one entry per point per epoch). These were commented out since neighbors are no longer loaded per epoch:

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

The neighbor lists in the detail panel (shown when hovering a point) were updated from allEpochData to neighborCache


This applies to three places:

- The HIGH-DIM neighbor list

- The PROJECTION neighbor list

- The `isCorrect` check (highlights projection neighbors that are also high-dim neighbors)

** The `?.` is because the cache entry doesn't exist yet when the user first hovers — it appears after the async fetch completes and triggers a re-render.

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

**`calculate_neighbors_for_point`**

- Loads high-dimensional embeddings from `epochs/epoch_N/embeddings.npy`

- Builds a k-NN index with sklearn's `NearestNeighbors`

- Queries **only the single point** at `point_index`

- Returns up to 10 neighbor indices

**`calculate_projection_neighbors_for_point`**

- Same approach but uses 2D projection coordinates from `visualize/{vis_id}/epochs/epoch_N/projection.npy`



**Why this is fast**: Building the knn index on 5000 points takes ~5–20ms. Querying 1 point is nearly instant. The old approach queried all 5000 points, which was the actual bottleneck.

---

### Strategy 2: Parallel epoch in batches

**Concept**: Instead of loading epochs in sequence, load them in parallel batches.

#### 2.1 — Batch loading loop in plotView.tsx

**File**: `web/src/views/plotView.tsx`

The old code made a loop in which calculated the neighbors and projection neighbors for each point of each epoch.
This was replaced by a parallel batch approach in which a function loadSingleEpoch was created to get the epoch projection, attribute resource and background. Then this function was called in epoch batches and excecuted with Promise.all for parallelism.


```typescript
const BATCH_SIZE = Number(import.meta.env.VITE_BATCH_SIZE) || 5;

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

Without this, flask processes the requests in sequence. With threaded=True the requests can be solved simultaniously.

#### 2.3 — `visId` stored during load

**File**: `web/src/views/plotView.tsx`

Added `setValue('visId', visualizationID)` at the start of `handleLoadVisualization` so the visualization ID is available globally for lazy neighbor fetching later.

#### 2.4 — .env variable

I used a .env to handle the BATCH_SIZE in case it propagates. The .env goes in the root folder and the env variable is 
```
VITE_BATCH_SIZE=5
```
---

### Extra: Loading Progress Overlay

**File**: `web/src/component/main-block.tsx`

I added a `LoadingOverlay` component that renders on top of the chart during loading like a progress bar:

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

It automatically appears when `progress > 0` and disappears when `progress >= 100`.

---

### Extra: Performance Benchmark Script

**File**: `tool/benchmark.py`

I created a script that compares the old approach to the new lazy loading and parallel approach to see the improvement in time.

**Usage**:
```bash
python tool/benchmark.py --content_path /path/to/dataset --vis_id TimeVis_1
```

**Optional arguments**:
- `--hover_points N` — number of hover events to simulate (default: 5)
- `--max_epochs N` — limit epochs to benchmark (default: all)

The script requires the Flask backend to be running (`python tool/server/server.py`).

### Extra: Draggable and collapsable blocks

I saw a TODO in the basic-component.tsx file that said  add resize/drag/dock-to mouse interaction so i did it as an extra. I only did the draggable and i wanted to do the collapse so it looks more organized.

**File**: `web/src/component/custom/basic-component.tsx`

**File**: `web/src/component/function-panel.tsx`

I created a DraggableBlock component and used it to wrap the FunctionalBlock that was already done. I also added the Collapse component so every block is collapsable.

I also changed the color legend panel a bit so it looks more organized.


**How to run it:**

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
 `ls /path/to/your/dataset/visualize/`
