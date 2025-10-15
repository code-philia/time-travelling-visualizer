import torch
from torch import nn
import torch.nn.functional as F

class ContrastiveLossWrapper(nn.Module):
    """
    封装成对样本的“损失”计算，实则为距离或相似度的代理。
    EIF的目标将始终是最小化这个函数的输出。
    """
    def forward(self, model: nn.Module, doc_inputs: torch.Tensor, code_inputs: torch.Tensor, is_positive_pair: bool):
        code_embeds = model(code_inputs)
        doc_embeds = model(doc_inputs)

        code_embeds = F.normalize(code_embeds, p=2, dim=1)
        doc_embeds = F.normalize(doc_embeds, p=2, dim=1)

        cosine_sim = (code_embeds * doc_embeds).sum(dim=1)

        if is_positive_pair:
            # 对于正样本，我们希望相似度接近1。目标函数为 1 - sim。
            # 值越大，表示距离越远（越差）。
            return 1.0 - cosine_sim
        else:
            # 对于负样本，我们希望相似度接近-1。目标函数为 sim。
            # 值越大，表示距离越近（越差）。
            # 为了与正样本情况统一（值越大越差），我们也可以使用 1 + sim，但直接用sim更直观。
            return cosine_sim
