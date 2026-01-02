import json
import os
import random
import time
from pathlib import Path
from typing import Any, Dict, List
from xml.etree import ElementTree as ET

from locust import HttpUser, between, events, task

DEFAULT_HOST = os.getenv("LOCUST_HOST", "http://localhost:8000")
DEFAULT_CONTENT_PATH = os.getenv(
    "LOCUST_CONTENT_PATH",
    str((Path(__file__).resolve().parent / "test_data" / "Classification-mini-mini").as_posix()),
)
DEFAULT_VIS_ID = os.getenv("LOCUST_VIS_ID", "timevis_1")
DEFAULT_WAIT_MIN = float(os.getenv("LOCUST_WAIT_MIN", "1"))
DEFAULT_WAIT_MAX = float(os.getenv("LOCUST_WAIT_MAX", "5"))
SUMMARY_JSON_PATH = os.getenv("LOCUST_SUMMARY_JSON", "locust-summary.json")
JUNIT_XML_PATH = os.getenv("LOCUST_JUNIT_XML", "locust-junit.xml")
OUTPUT_DIR = Path(os.getenv("LOCUST_OUTPUT_DIR", ".")).resolve()


def _stats_entry_to_dict(entry) -> Dict[str, Any]:
    """Serialize a StatsEntry to a compact dict."""
    return {
        "name": entry.name,
        "method": entry.method,
        "num_requests": entry.num_requests,
        "num_failures": entry.num_failures,
        "avg_response_time": entry.avg_response_time,
        "min_response_time": entry.min_response_time or 0,
        "max_response_time": entry.max_response_time or 0,
        "median_response_time": entry.median_response_time,
        "current_rps": entry.current_rps,
        "fail_ratio": entry.fail_ratio,
        "avg_content_length": entry.avg_content_length,
    }


def _write_json_summary(environment) -> None:
    if not environment or not environment.stats:
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = Path(SUMMARY_JSON_PATH)
    if not json_path.is_absolute():
        json_path = OUTPUT_DIR / json_path

    total = environment.stats.total
    entries: List[Dict[str, Any]] = [
        _stats_entry_to_dict(entry) for entry in environment.stats.entries.values()
    ]
    payload = {
        "timestamp": int(time.time()),
        "host": environment.host,
        "user_count": getattr(environment.runner, "user_count", 0),
        "total": _stats_entry_to_dict(total),
        "entries": entries,
    }

    try:
        with json_path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)
        print(f"[locust] JSON summary written to {json_path}")
    except Exception as exc:  # noqa: BLE001
        print(f"[locust] Failed to write JSON summary: {exc}")


def _write_junit_report(environment, start_time: float) -> None:
    if not environment or not environment.stats:
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    xml_path = Path(JUNIT_XML_PATH)
    if not xml_path.is_absolute():
        xml_path = OUTPUT_DIR / xml_path

    duration = max(0.0, time.time() - start_time)
    entries = list(environment.stats.entries.values())

    testsuite = ET.Element(
        "testsuite",
        {
            "name": "locust",
            "tests": str(len(entries) or 1),
            "failures": str(sum(entry.num_failures for entry in entries)),
            "errors": "0",
            "time": f"{duration:.3f}",
        },
    )

    if not entries:
        case = ET.SubElement(
            testsuite, "testcase", {"name": "no_requests_executed", "time": f"{duration:.3f}"}
        )
        if environment.stats.total.num_failures:
            failure = ET.SubElement(
                case,
                "failure",
                {"message": "No requests executed but failures recorded", "type": "LocustFailure"},
            )
            failure.text = "Locust finished without executing HTTP calls."
    else:
        for entry in entries:
            case = ET.SubElement(
                testsuite,
                "testcase",
                {"name": f"{entry.method} {entry.name}", "time": f"{entry.avg_response_time/1000:.3f}"},
            )
            if entry.num_failures > 0:
                failure = ET.SubElement(
                    case,
                    "failure",
                    {
                        "message": f"{entry.num_failures} failures out of {entry.num_requests}",
                        "type": "LocustFailure",
                    },
                )
                failure.text = (
                    f"Fail ratio: {entry.fail_ratio:.3f}, "
                    f"avg rt: {entry.avg_response_time:.1f} ms, "
                    f"rps: {entry.current_rps:.2f}"
                )

    tree = ET.ElementTree(testsuite)
    try:
        tree.write(xml_path, encoding="utf-8", xml_declaration=True)
        print(f"[locust] JUnit report written to {xml_path}")
    except Exception as exc:  # noqa: BLE001
        print(f"[locust] Failed to write JUnit report: {exc}")


test_start_time = time.time()


@events.test_start.add_listener
def _on_test_start(environment, **kwargs):
    global test_start_time
    test_start_time = time.time()
    print(f"[locust] Test started. Host={environment.host}")


@events.test_stop.add_listener
def _on_test_stop(environment, **kwargs):
    _write_json_summary(environment)
    _write_junit_report(environment, test_start_time)
    print("[locust] Test finished.")


class VisualizationUser(HttpUser):
    wait_time = between(DEFAULT_WAIT_MIN, DEFAULT_WAIT_MAX)
    host = DEFAULT_HOST
    content_path = DEFAULT_CONTENT_PATH
    available_epochs: List[int] = []
    vis_id = DEFAULT_VIS_ID
    total_samples = 0
    active = True

    def on_start(self):
        """
        Initialize user: trigger visualization once and cache epochs/sample info.
        """
        if "__YOUR_CONTENT_PATH__" in str(self.content_path):
            print("[locust] content_path is not configured. Set LOCUST_CONTENT_PATH.")
            self.active = False
            return

        if not Path(self.content_path).exists():
            print(f"[locust] content_path does not exist: {self.content_path}")
            self.active = False
            return

        if not VisualizationUser.available_epochs:
            try:
                with self.client.post(
                    "/startVisualizing",
                    json={
                        "content_path": self.content_path,
                        "vis_method": "DVI",
                        "vis_id": self.vis_id,
                        "data_type": "image",
                        "task_type": "classification",
                        "vis_config": {},
                    },
                    name="/startVisualizing",
                    catch_response=True,
                ) as response:
                    if response.status_code >= 400:
                        print(f"[locust] startVisualizing returned {response.status_code}; continuing")
                    response.success()
            except Exception as exc:  # noqa: BLE001
                print(f"[locust] Failed to start visualization: {exc}")
                self.active = False
                return

            try:
                url = f"/getTrainingProcessInfo?content_path={self.content_path}"
                with self.client.get(url, name="/getTrainingProcessInfo", catch_response=True) as response:
                    if response.status_code == 200:
                        data = response.json()
                        VisualizationUser.available_epochs = data.get("available_epochs", [])
                        VisualizationUser.total_samples = len(data.get("label_text_list", []))
                        if not VisualizationUser.available_epochs:
                            print("[locust] No epochs available; update_projection will be skipped.")
                        if VisualizationUser.total_samples == 0:
                            print("[locust] No samples reported; get_image_data will be skipped.")
                        response.success()
                    else:
                        print(f"[locust] getTrainingProcessInfo returned {response.status_code}; continuing")
                        response.success()
            except Exception as exc:  # noqa: BLE001
                print(f"[locust] Failed to initialize user: {exc}")
                self.active = False


    @task(3) # This task will be picked 3 times more often than the other
    def update_projection(self):
        """
        Simulates a user requesting projection data for a random epoch.
        """
        if not self.active:
            return
        if not self.available_epochs:
            print("Skipping update_projection: no epochs available.")
            return

        random_epoch = random.choice(self.available_epochs)
        
        payload = {
            "content_path": self.content_path,
            "vis_id": self.vis_id,
            "epoch": random_epoch
        }
        self.client.post("/updateProjection", json=payload, name="/updateProjection")

    @task(1)
    def get_image_data(self):
        """
        Simulates a user requesting image data for a random sample.
        """
        if not self.active:
            return
        if self.total_samples == 0:
            print("Skipping get_image_data: total samples unknown.")
            return
            
        random_index = random.randint(0, self.total_samples - 1)
        
        payload = {
            "content_path": self.content_path,
            "index": random_index
        }
        self.client.post("/getImageData", json=payload, name="/getImageData")
