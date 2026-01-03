Locust Performance Test Guide
=============================

Overview
--------
This repo includes a Locust script (`tool/server/locustfile.py`) to exercise the visualization API. It is parameterized for local runs and prepared for CI consumption (JUnit/text summaries), but CI wiring is intentionally **not** done yet.

Configuration
-------------
Environment variables (all optional):

- `LOCUST_HOST`: Target host (default `http://localhost:8000`)
- `LOCUST_CONTENT_PATH`: Dataset root; defaults to `tool/server/test_data/Classification-mini-mini`
- `LOCUST_VIS_ID`: Visualization ID (default `DVI_1`)
- `LOCUST_WAIT_MIN` / `LOCUST_WAIT_MAX`: Wait time bounds in seconds (default `1` / `5`)
- `LOCUST_OUTPUT_DIR`: Base directory for generated reports (default current dir)
- `LOCUST_SUMMARY_JSON`: JSON summary filename (default `locust-summary.json`)
- `LOCUST_JUNIT_XML`: JUnit report filename (default `locust-junit.xml`)

Run Examples
------------
Headless (recommended for automation):
```
LOCUST_HOST=http://localhost:8000 \
LOCUST_CONTENT_PATH=/abs/path/to/Classification-mini-mini \
locust -f tool/server/locustfile.py --headless -u 10 -r 2 -t 1m
```

Web UI:
```
LOCUST_HOST=http://localhost:8000 \
LOCUST_CONTENT_PATH=/abs/path/to/Classification-mini-mini \
locust -f tool/server/locustfile.py
```

Outputs
-------
- JSON summary: `${LOCUST_OUTPUT_DIR}/${LOCUST_SUMMARY_JSON}` (aggregated totals plus per-endpoint stats)
- JUnit XML: `${LOCUST_OUTPUT_DIR}/${LOCUST_JUNIT_XML}` (per-endpoint testcases; failures recorded when HTTP failures > 0)
- Standard Locust HTML/CSV outputs remain available via Locust CLI flags.

Notes
-----
- If `LOCUST_CONTENT_PATH` is missing or invalid, the user will log a warning and skip traffic instead of failing hard.
- `available_epochs` or `total_samples` fetched from `/getTrainingProcessInfo` gate optional tasks; missing data will skip dependent calls to avoid noisy failures.

