from typing import Optional, Dict, Any
import torch
import os
from .scripts.hparams import HParams
from .scripts.train_motion import main as train_motion_main
import train_refined from .scripts.train_motion_main

class DynaVisRunner:
    def __init__(self, content_path: str, vis_id: str, data_type: str, task_type: str, vis_config: Optional[Dict[str, Any]] = None):
        self.content_path = content_path
        self.vis_id = vis_id
        self.data_type = data_type
        self.task_type = task_type
        self.vis_config = {}

        defaults = {
            "D": 512,
            "d": 2,
            "bs": 32,
            "lr_ae": 1e-3,
            "lr_joint": 5e-4,
            "epochs_ae": 20,
            "epochs_joint": 20,
            "lambda_rec": 1.0,
            "lambda_dir": 4.0,
            "lambda_rank": 0.8,
            "dir_windows": (2, 4, 8),
            "dir_betas": (0.5, 0.5, 0.5),
            "dir_min_step_norm": 1e-4,
            "rank_margin_top_order": 0.02,
            "rank_margin_top_vs_rest": 0.01,
            "kl_weight": 0.5,
            "kl_tau_start": 0.7,
            "kl_tau_end": 0.25,
            "kl_weighted_by_p": True,
            "warmup_epochs": 16,
            "grad_clip": 0.5,
            "use_l2": False,
            "norm_mode": "robust",
            "std_clip_low": 1e-8,
            "std_clip_high": 0.0
        }

        cfg = {**defaults, **self.vis_config}
        data_dir = os.path.join(self.content_path, "epochs")
        out_root = os.path.join(self.content_path, "visualize", f"DynaVis_{self.vis_id}")

        self.hparams = HParams(
            D=cfg["D"],
            d=cfg["d"],
            bs=cfg["bs"],
            lr_ae=cfg["lr_ae"],
            lr_joint=cfg["lr_joint"],
            epochs_ae=cfg["epochs_ae"],
            epochs_joint=cfg["epochs_joint"],
            lambda_rec=cfg["lambda_rec"],
            lambda_dir=cfg["lambda_dir"],
            lambda_rank=cfg["lambda_rank"],
            dir_windows=tuple(cfg["dir_windows"]),
            dir_betas=tuple(cfg["dir_betas"]),
            dir_min_step_norm=cfg["dir_min_step_norm"],
            rank_margin_top_order=cfg["rank_margin_top_order"],
            rank_margin_top_vs_rest=cfg["rank_margin_top_vs_rest"],
            kl_weight=cfg["kl_weight"],
            kl_tau_start=cfg["kl_tau_start"],
            kl_tau_end=cfg["kl_tau_end"],
            kl_weighted_by_p=cfg["kl_weighted_by_p"],
            warmup_epochs=cfg["warmup_epochs"],
            grad_clip=cfg["grad_clip"],
            norm_mode=cfg["norm_mode"],
            std_clip_low=cfg["std_clip_low"],
            std_clip_high=cfg["std_clip_high"],
            data_path=data_dir,
            ckpt_dir=out_root,
            device="cuda" if torch.cuda.is_available() else "cpu",
            use_l2=cfg["use_l2"],
        )

    def run(self):
        train_motion_main(self.hparams)
    
    def train(self):
        self.run()

    # 在 DynaVisRunner 内部处理 refine 逻辑
    def refine_train(self, focus_mode="fine"):
        # 根据交互模式决定微调轮次
        refine_epochs = 5 if focus_mode == "fine" else 2
        
        # 临时修改 hparams
        original_ae = self.hparams.epochs_ae
        original_joint = self.hparams.epochs_joint
        
        # 关键设置：跳过 AE 预训练，只进行少量的联合优化
        self.hparams.epochs_ae = 0 
        self.hparams.epochs_joint = refine_epochs
        
        # 执行训练
        self.train_refined(self.hparams) 
        
        # 恢复原始设置（防止影响下次 full train）
        self.hparams.epochs_ae = original_ae
        self.hparams.epochs_joint = original_joint

    def get_focus_mask(self, selected_indices):
        """
        根据选中的索引生成布尔 Mask。
        避开了对 self.data_provider 的直接依赖，转而通过读取数据目录获取总数。
        """
        import numpy as np
        import torch
        
        # 1. 自动获取数据集总大小
        # 假设你的数据目录下有 index.npy 或类似文件记录了所有点的索引
        try:
            # 路径对应你 __init__ 里的 data_dir
            data_info_path = os.path.join(self.hparams.data_path, "index.npy") 
            if os.path.exists(data_info_path):
                total_count = len(np.load(data_info_path))
            else:
                # 如果找不到文件，尝试从 selected_indices 推断（兜底方案）
                total_count = max(selected_indices) + 1 if selected_indices else 1000
        except Exception as e:
            print(f"Warning: Could not determine dataset size, using default. {e}")
            total_count = 10000 

        # 2. 生成 Mask
        mask = torch.zeros(total_count, dtype=torch.bool).to(self.hparams.device)
        if selected_indices:
            mask[selected_indices] = True
            
        return mask
    
    def update_ttav_context(self, indices, mode, mask):
        """
        Update trainer state. Called by the server before incremental training.
        """
        self.ttav_indices = indices
        self.ttav_mode = mode
        self.ttav_mask = mask # Boolean mask on GPU
                    