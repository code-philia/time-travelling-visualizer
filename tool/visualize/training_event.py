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

    def _detect_inconsistent_movement_events(self) -> List[Dict[str, Any]]:
        """
        Detects pairs of representations that move contrary to the contrastive learning objective.
        1. Positive pairs (doc-code from the same sample) that move farther apart.
        2. Negative pairs (doc-code from different samples) that move significantly closer.
        """
        events = []
        epoch_index = self.available_epochs.index(self.epoch)
        prev_epoch = self.available_epochs[epoch_index - 5] if epoch_index > 4 else -1
        
        if prev_epoch < 0:
            # Cannot compare if there's no previous epoch
            return events

        # 1. Load embeddings for the current and previous epochs
        curr_emb = self.data_provider.get_representation(self.epoch)
        prev_emb = self.data_provider.get_representation(prev_epoch)
        
        if curr_emb is None or prev_emb is None:
            return events

        # 2. Separate doc and code embeddings and normalize them for cosine distance calculation
        # Embeddings are stored as [doc0, code0, doc1, code1, ...]
        curr_docs = curr_emb[0::2]
        curr_codes = curr_emb[1::2]
        prev_docs = prev_emb[0::2]
        prev_codes = prev_emb[1::2]
        
        # L2 normalization
        curr_docs /= np.linalg.norm(curr_docs, axis=1, keepdims=True)
        curr_codes /= np.linalg.norm(curr_codes, axis=1, keepdims=True)
        prev_docs /= np.linalg.norm(prev_docs, axis=1, keepdims=True)
        prev_codes /= np.linalg.norm(prev_codes, axis=1, keepdims=True)

        # 3. Calculate pairwise cosine distance matrices for both epochs
        # Cosine Distance = 1 - Cosine Similarity
        # For normalized vectors, Similarity = A @ B.T
        prev_dist_matrix = 1 - (prev_docs @ prev_codes.T)
        curr_dist_matrix = 1 - (curr_docs @ curr_codes.T)

        # 4. Calculate the change in distance between epochs
        # delta > 0 means they moved farther apart
        # delta < 0 means they moved closer
        delta_matrix = curr_dist_matrix - prev_dist_matrix
        
        # 5. Define a statistical threshold for "significant" movement
        # We use mean + 2*std of the absolute changes to capture outliers
        abs_deltas = np.abs(delta_matrix)
        # threshold = np.mean(abs_deltas) + 2 * np.std(abs_deltas)
        threshold = np.mean(abs_deltas)
        
        num_pairs = curr_docs.shape[0]

        # 6. Iterate through all pairs to find inconsistent movements
        for i in range(num_pairs):  # Index for docstrings
            for j in range(num_pairs):  # Index for code
                delta = delta_matrix[i, j]
                
                # Case 1: Positive Pair (doc_i and code_i)
                if i == j:
                    # Inconsistency: Positive pairs should get closer (delta < 0), but they moved farther (delta > 0)
                    if delta > threshold:
                        events.append(dict(
                            index=2 * i,          # Original index of doc_i
                            index1=2 * j + 1,     # Original index of code_j
                            expectation="Aligned",
                            behavior="NotAligned",
                            distanceChange=float(delta),
                            type="InconsistentMovement"
                        ))
                # Case 2: Negative Pair (doc_i and code_j)
                else:
                    # Inconsistency: Negative pairs should get farther (delta > 0), but they moved closer (delta < 0)
                    if delta < 0 and abs(delta) > 6 * threshold:
                        events.append(dict(
                            index=2 * i,
                            index1=2 * j + 1,
                            expectation="NotAligned",
                            behavior="Aligned",
                            distanceChange=float(delta),
                            type="InconsistentMovement"
                        ))
        
        # Sort events by the magnitude of the change, showing the most severe cases first
        events.sort(key=lambda x: abs(x["distanceChange"]), reverse=True)
        print(f"Detected {len(events)} inconsistent movement events at epoch {self.epoch}.")
        return events

    def _detect_inconsistent_movement_events_token(self, std_dev_multiplier=2.5):
        events = []
        epoch_index = self.available_epochs.index(self.epoch)
        if epoch_index == 0:
            return events

        prev_epoch_index = 0 if epoch_index < 3 else epoch_index - 3
        prev_epoch = self.available_epochs[0]

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
        
        aligned_deltas = []
        not_aligned_deltas = []
        for i in range(n):
            for j in range(i + 1, n):
                if root[i] == root[j]:
                    aligned_deltas.append(dist_changes[i, j])
                else:
                    not_aligned_deltas.append(dist_changes[i, j])

        if not aligned_deltas or not not_aligned_deltas:
            return events

        aligned_mean = np.mean(aligned_deltas)
        aligned_std = np.std(aligned_deltas)
        alpha = aligned_mean + std_dev_multiplier * aligned_std
        
        not_aligned_mean = np.mean(not_aligned_deltas)
        not_aligned_std = np.std(not_aligned_deltas)
        beta = not_aligned_mean - std_dev_multiplier * not_aligned_std
        
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
                            distanceChange=float(delta),
                            type="InconsistentMovement"
                        ))
                else:
                    if delta < beta:
                        events.append(dict(
                            index=i,
                            index1=j,
                            expectation="NotAligned",
                            behavior="Aligned",
                            distanceChange=float(delta),
                            type="InconsistentMovement"
                        ))

        return events