from torch import nn

class VisModel(nn.Module):
    """define you own visualizatio model by specifying the structure

    """
    def __init__(self, encoder_dims, decoder_dims):
        """define you own visualizatio model by specifying the structure

        Parameters
        ----------
        encoder_dims : list of int
            the neuron number of your encoder
            for example, [100,50,2], denote two fully connect layers, with shape (100,50) and (50,2)
        decoder_dims : list of int
            same as encoder_dims
        """
        super(VisModel, self).__init__()
        assert len(encoder_dims) > 1
        assert len(decoder_dims) > 1
        self.encoder_dims = encoder_dims
        self.decoder_dims = decoder_dims
        self._init_autoencoder()
    
    def _init_autoencoder(self):
        self.encoder = nn.Sequential()
        for i in range(0, len(self.encoder_dims)-2):
            self.encoder.add_module("{}".format(len(self.encoder)), nn.Linear(self.encoder_dims[i], self.encoder_dims[i+1]))
            self.encoder.add_module("{}".format(len(self.encoder)), nn.ReLU(True))
        self.encoder.add_module("{}".format(len(self.encoder)), nn.Linear(self.encoder_dims[-2], self.encoder_dims[-1]))
        
        self.decoder = nn.Sequential()
        for i in range(0, len(self.decoder_dims)-2):
            self.decoder.add_module("{}".format(len(self.decoder)), nn.Linear(self.decoder_dims[i], self.decoder_dims[i+1]))
            self.decoder.add_module("{}".format(len(self.decoder)), nn.ReLU(True))
        self.decoder.add_module("{}".format(len(self.decoder)), nn.Linear(self.decoder_dims[-2], self.decoder_dims[-1]))


    def forward(self, edge_to, edge_from):
        outputs = dict()
        embedding_to = self.encoder(edge_to)
        embedding_from = self.encoder(edge_from)
        recon_to = self.decoder(embedding_to)
        recon_from = self.decoder(embedding_from)
        
        outputs["umap"] = (embedding_to, embedding_from)
        outputs["recon"] = (recon_to, recon_from)

        return outputs


