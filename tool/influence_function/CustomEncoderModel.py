# model.py

import torch
import torch.nn as nn

class CustomEncoderModel(nn.Module):
    def __init__(self, vocab_size: int, embed_dim: int, num_heads: int = 12, num_layers: int = 3, 
                 dropout: float = 0.1, max_len: int = 512, padding_idx: int = 0):
        """
        Args:
            vocab_size (int): 词汇表大小
            embed_dim (int): 嵌入维度
            num_heads (int): 多头注意力中的头数
            num_layers (int): Transformer 编码器层数
            dropout (float, optional): Dropout 概率. Defaults to 0.1.
            max_len (int, optional): 最大序列长度. Defaults to 512.
            padding_idx (int, optional): 用于 padding 的 token ID. Defaults to 0.
        """
        super(CustomEncoderModel, self).__init__()
        self.embed_dim = embed_dim
        self.padding_idx = padding_idx
        

        self.token_embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=self.padding_idx)
        self.position_embedding = nn.Embedding(max_len, embed_dim)
        
        self.layer_norm = nn.LayerNorm(embed_dim)
        self.dropout = nn.Dropout(dropout)
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, 
            nhead=num_heads,
            batch_first=True,
            dropout=dropout,
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        self.init_weights()

    def init_weights(self) -> None:
        initrange = 0.1
        self.token_embedding.weight.data.uniform_(-initrange, initrange)
        if self.padding_idx is not None:
             self.token_embedding.weight.data[self.padding_idx].zero_()
        self.position_embedding.weight.data.uniform_(-initrange, initrange)

    def forward(self, src: torch.Tensor) -> torch.Tensor:
        """
        前向传播。
        Args:
            src (torch.Tensor): 输入的 token ID 张量, shape [batch_size, seq_len]
        Returns:
            torch.Tensor: 池化后的输出向量, shape [batch_size, embed_dim]
        """
        src_padding_mask = (src == self.padding_idx)

        seq_len = src.size(1)
        
        position_ids = torch.arange(seq_len, dtype=torch.long, device=src.device).unsqueeze(0)
        
        token_embeds = self.token_embedding(src)
        pos_embeds = self.position_embedding(position_ids)
        
        embedded = token_embeds + pos_embeds
        embedded = self.layer_norm(embedded)
        embedded = self.dropout(embedded)

        output = self.transformer_encoder(embedded, src_key_padding_mask=src_padding_mask)
        
        pooled_output = output[:, 0, :]
        
        return pooled_output