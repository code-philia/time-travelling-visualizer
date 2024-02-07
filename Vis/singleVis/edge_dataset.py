"""
Edge dataset from temporal complex
"""
from abc import ABC, abstractmethod
from torch.utils.data import Dataset
from PIL import Image
import numpy as np

class DataHandlerAbstractClass(Dataset, ABC):
    def __init__(self, edge_to, edge_from, feature_vector) -> None:
        super().__init__()
        self.edge_to = edge_to
        self.edge_from = edge_from
        self.data = feature_vector

    @abstractmethod
    def __getitem__(self, item):
        pass

    @abstractmethod
    def __len__(self):
        pass

class DataHandler(Dataset):
    def __init__(self, edge_to, edge_from, feature_vector, attention, probs, transform=None):
        self.edge_to = edge_to
        self.edge_from = edge_from
        self.data = feature_vector
        self.attention = attention
        self.transform = transform
        self.probs = probs

    def __getitem__(self, item):

        edge_to_idx = self.edge_to[item]
        edge_from_idx = self.edge_from[item]
        edge_to = self.data[edge_to_idx]
        edge_from = self.data[edge_from_idx]
        a_to = self.attention[edge_to_idx]
        a_from = self.attention[edge_from_idx]
        probs = self.probs[item]
        if self.transform is not None:
            # TODO correct or not?
            edge_to = Image.fromarray(edge_to)
            edge_to = self.transform(edge_to)
            edge_from = Image.fromarray(edge_from)
            edge_from = self.transform(edge_from)
        return edge_to, edge_from, a_to, a_from, probs

    def __len__(self):
        # return the number of all edges
        return len(self.edge_to)

class VisDataHandler(Dataset):
    def __init__(self, edge_to, edge_from, feature_vector, attention, probs, pred, transform=None):
        self.edge_to = edge_to
        self.edge_from = edge_from
        self.data = feature_vector
        self.attention = attention
        self.transform = transform
        self.probs = probs
        self.pred = pred

    def __getitem__(self, item):
        edge_to_idx = self.edge_to[item]
        edge_from_idx = self.edge_from[item]
        edge_to = self.data[edge_to_idx]
        edge_from = self.data[edge_from_idx]
        edge_to_pred = self.pred[edge_to_idx]
        edge_from_pred = self.pred[edge_from_idx]
        a_to = self.attention[edge_to_idx]
        a_from = self.attention[edge_from_idx]
        probs = self.probs[item]
    
        if self.transform is not None:
            # TODO correct or not?
            edge_to = Image.fromarray(edge_to)
            edge_to = self.transform(edge_to)
            edge_from = Image.fromarray(edge_from)
            edge_from = self.transform(edge_from)
        return edge_to_idx, edge_from_idx, edge_to, edge_from, a_to, a_from, probs,edge_to_pred,edge_from_pred

    def __len__(self):
        # return the number of all edges
        return len(self.edge_to)

