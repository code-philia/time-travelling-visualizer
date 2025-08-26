from scipy.spatial.distance import pdist, squareform
import numpy as np
from typing import List, Dict, Any

class TrainingEventDetector:
    def __init__(self, content_path, epoch, data_provider):
        self.epoch = epoch
        self.content_path = content_path
        self.data_provider = data_provider
        self.available_epochs = self.data_provider.get_available_epochs()

    def detect_events(self, event_types):
        events = []
        if 'PredictionFlip' in event_types:
            events.extend(self._detect_prediction_flip_events())
        if 'ConfidenceChange' in event_types:
            events.extend(self._detect_confidence_change_events())
        if 'SignificantMovement' in event_types:
            events.extend(self._detect_significant_movement_events())
        if 'InconsistentMovement' in event_types:
            events.extend(self._detect_inconsistent_movement_events())
        return events


    def _detect_prediction_flip_events(self) -> List[Dict[str, Any]]:
        events = []
        epoch_index = self.available_epochs.index(self.epoch)
        prev_epoch = self.available_epochs[epoch_index - 1] if epoch_index > 0 else -1
        if prev_epoch < 0:
            return events

        labels = self.data_provider.get_labels()
        prev_pred = self.data_provider.get_prediction(prev_epoch)
        curr_pred = self.data_provider.get_prediction(self.epoch)
        label_dict = self.data_provider.get_label_dict()
        
        if(prev_pred is None or curr_pred is None):
            return events

        for idx, label in enumerate(labels):
            if prev_pred[idx] == curr_pred[idx]:
                continue
            events.append({
                "index": idx,
                "label": label_dict.get(label, str(label)),
                "prevPred": label_dict.get(prev_pred[idx], str(prev_pred[idx])),
                "currPred": label_dict.get(curr_pred[idx], str(curr_pred[idx])),
                "prevCorrect": bool(prev_pred[idx] == label),
                "currCorrect": bool(curr_pred[idx] == label),
                "influenceTarget": label_dict.get(curr_pred[idx], str(curr_pred[idx])),
                "type": "PredictionFlip"
            })
        return events


    def _detect_confidence_change_events(self) -> List[Dict[str, Any]]:
        events = []
        epoch_index = self.available_epochs.index(self.epoch)
        prev_epoch = self.available_epochs[epoch_index - 1] if epoch_index > 0 else -1
        if prev_epoch < 0:
            return events

        labels = self.data_provider.get_labels()
        prev_prob = self.data_provider.get_probability(prev_epoch)  # (N, C)
        curr_prob = self.data_provider.get_probability(self.epoch)
        label_dict = self.data_provider.get_label_dict()

        if(prev_prob is None or curr_prob is None):
            return events

        for idx, label in enumerate(labels):
            prev_conf = float(prev_prob[idx, label])
            curr_conf = float(curr_prob[idx, label])

            if abs(curr_conf - prev_conf) <= 0.5:
                continue

            delta = curr_prob[idx] - prev_prob[idx]
            tgt = int(np.argmax(delta))
            events.append({
                "index": idx,
                "label": label_dict.get(label, str(label)),
                "prevConf": prev_conf,
                "currConf": curr_conf,
                "change": curr_conf - prev_conf,
                "influenceTarget": label_dict.get(tgt, str(tgt)),
                "type": "ConfidenceChange"
            })

        events.sort(key=lambda x: abs(x["change"]), reverse=True)
        return events


    def _detect_significant_movement_events(self) -> List[Dict[str, Any]]:
        events = []
        epoch_index = self.available_epochs.index(self.epoch)
        prev_epoch = self.available_epochs[epoch_index - 1] if epoch_index > 0 else -1
        last_epoch = self.available_epochs[-1] if len(self.available_epochs) > 0 else None
        if prev_epoch < 0 or last_epoch is None:
            return events

        prev_emb = self.data_provider.get_representation(prev_epoch)   # (N, d)
        curr_emb = self.data_provider.get_representation(self.epoch)
        last_emb = self.data_provider.get_representation(last_epoch)

        prev_dists = np.linalg.norm(prev_emb - last_emb, axis=1)
        curr_dists = np.linalg.norm(curr_emb - last_emb, axis=1)
        delta_dists = curr_dists - prev_dists

        closer_mask = delta_dists < 0
        farther_mask = delta_dists > 0

        closer_changes = np.abs(delta_dists[closer_mask])
        farther_changes = delta_dists[farther_mask]

        closer_thresh = 0.5 if closer_changes.size == 0 else \
            float(np.mean(closer_changes) + 2 * np.std(closer_changes))
        farther_thresh = 0.5 if farther_changes.size == 0 else \
            float(np.mean(farther_changes) + 2 * np.std(farther_changes))

        for idx, dd in enumerate(delta_dists):
            if dd < 0 and np.abs(dd) > closer_thresh:
                events.append({
                    "index": idx,
                    "prevDist": float(prev_dists[idx]),
                    "currDist": float(curr_dists[idx]),
                    "distanceChange": float(dd),
                    "movementType": "closer",
                    "type": "SignificantMovement"
                })
            elif dd > 0 and dd > farther_thresh:
                events.append({
                    "index": idx,
                    "prevDist": float(prev_dists[idx]),
                    "currDist": float(curr_dists[idx]),
                    "distanceChange": float(dd),
                    "movementType": "farther",
                    "type": "SignificantMovement"
                })

        events.sort(key=lambda x: abs(x["distanceChange"]), reverse=True)
        return events


    def _detect_inconsistent_movement_events(self):
        events = []
        epoch_index = self.available_epochs.index(self.epoch)
        prev_epoch = self.available_epochs[epoch_index - 1] if epoch_index > 0 else -1
        if prev_epoch < 0:
            return events

        prev_embeddings = self.data_provider.get_representation(prev_epoch)
        curr_embeddings = self.data_provider.get_representation(self.epoch)

        expected_alignment = self.data_provider.get_expected_alignment()
        n = prev_embeddings.shape[0]

        parent = list(range(n))

        def find(u):
            while parent[u] != u:
                parent[u] = parent[parent[u]]
                u = parent[u]
            return u

        def union(u, v):
            pu, pv = find(u), find(v)
            if pu != pv:
                parent[pv] = pu

        for i, j in expected_alignment:
            union(i, j)

        root = [find(i) for i in range(n)]

        prev_dist_matrix = squareform(pdist(prev_embeddings))
        curr_dist_matrix = squareform(pdist(curr_embeddings))
        dist_changes = curr_dist_matrix - prev_dist_matrix

        alpha = 1
        beta  = -1

        for i in range(n):
            for j in range(i + 1, n):
                delta = dist_changes[i, j]
                aligned = root[i] == root[j]

                if aligned:
                    if delta > alpha:
                        events.append(dict(
                            index=i,
                            index1=j,
                            expectation="Aligned",
                            behavior="NotAligned",
                            type="InconsistentMovement"
                        ))
                else:
                    if delta < beta:
                        events.append(dict(
                            index=i,
                            index1=j,
                            expectation="NotAligned",
                            behavior="Aligned",
                            type="InconsistentMovement"
                        ))

        return events