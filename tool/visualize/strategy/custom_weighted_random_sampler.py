# tool/visualize/strategy/custom_weighted_random_sampler.py

import torch

class CustomWeightedRandomSampler:
    def __init__(self, weights, num_samples, replacement=True):
        self.weights = torch.as_tensor(weights, dtype=torch.double)
        self.num_samples = num_samples
        self.replacement = replacement
        # [TTAV] Keep a backup of original weights to allow resetting
        self.base_weights = self.weights.clone()

    def update_weights(self, selected_indices, focus_mode):
        """
        [TTAV] Dynamically adjust sampling probabilities based on user-selected focus area.
        """
        # 1. Reset to baseline weights first
        new_weights = self.base_weights.clone()
        
        # 2. Only apply multipliers if focus mode is active and points are selected
        if selected_indices and len(selected_indices) > 0:
            multiplier = 1.0
            if focus_mode == "balanced":
                multiplier = 2.0  # Double the appearance frequency
            elif focus_mode == "fine":
                multiplier = 5.0  # Significantly increase density for local optimization
            
            # 3. Apply the multiplier to the selected focus indices
            for idx in selected_indices:
                if idx < len(new_weights):
                    new_weights[idx] *= multiplier
        
        # Update the active weights used by the PyTorch sampler
        self.weights = new_weights