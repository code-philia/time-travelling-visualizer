from torch import nn
import torch
from singleVis.backend import compute_cross_entropy,convert_distance_to_probability


class SingleVisualizationModel(nn.Module):
    def __init__(self, input_dims, output_dims, units, hidden_layer=3):
        super(SingleVisualizationModel, self).__init__()

        self.input_dims = input_dims
        self.output_dims = output_dims
        self.units = units
        self.hidden_layer = hidden_layer
        self._init_autoencoder()
    
    # TODO find the best model architecture
    def _init_autoencoder(self):
        self.encoder = nn.Sequential(
            nn.Linear(self.input_dims, self.units),
            nn.ReLU(True))
        for h in range(self.hidden_layer):
            self.encoder.add_module("{}".format(2*h+2), nn.Linear(self.units, self.units))
            self.encoder.add_module("{}".format(2*h+3), nn.ReLU(True))
        self.encoder.add_module("{}".format(2*(self.hidden_layer+1)), nn.Linear(self.units, self.output_dims))

        self.decoder = nn.Sequential(
            nn.Linear(self.output_dims, self.units),
            nn.ReLU(True))
        for h in range(self.hidden_layer):
            self.decoder.add_module("{}".format(2*h+2), nn.Linear(self.units, self.units))
            self.decoder.add_module("{}".format(2*h+3), nn.ReLU(True))
        self.decoder.add_module("{}".format(2*(self.hidden_layer+1)), nn.Linear(self.units, self.input_dims))

    def forward(self, edge_to, edge_from):
        outputs = dict()
        embedding_to = self.encoder(edge_to)
        embedding_from = self.encoder(edge_from)
        recon_to = self.decoder(embedding_to)
        recon_from = self.decoder(embedding_from)
        
        outputs["umap"] = (embedding_to, embedding_from)
        outputs["recon"] = (recon_to, recon_from)

        return outputs

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

        edge_to.requires_grad_()
        edge_from.requires_grad_()
        outputs = dict()
        embedding_to = self.encoder(edge_to)
        embedding_from = self.encoder(edge_from)
        recon_to = self.decoder(embedding_to)
        recon_from = self.decoder(embedding_from)
        
        outputs["umap"] = (embedding_to, embedding_from)
        outputs["recon"] = (recon_to, recon_from)
        

        return outputs
    


'''
The visualization model definition class
'''


# import torch.nn as nn
# """"""
# class VisModel(nn.Module):
#     def __init__(self, encoder_dims, decoder_dims):
#         super(VisModel, self).__init__()
#         assert len(encoder_dims) > 1
#         assert len(decoder_dims) > 1
#         self.encoder_dims = encoder_dims
#         self.decoder_dims = decoder_dims
#         self._init_autoencoder()
    
#     def _init_autoencoder(self):
#         self.encoder = nn.Sequential()
#         for i in range(len(self.encoder_dims) - 2):
#             self.encoder.add_module("encoder_lin_{}".format(i), nn.Linear(self.encoder_dims[i], self.encoder_dims[i+1]))
#             self.encoder.add_module("encoder_relu_{}".format(i), nn.ReLU(True))
#         # Add the final layer with a Sigmoid to normalize the latent space
#         self.encoder.add_module("encoder_final", nn.Linear(self.encoder_dims[-2], self.encoder_dims[-1]))
#         self.encoder.add_module("latent_sigmoid", nn.Sigmoid())

#         self.decoder = nn.Sequential()
#         for i in range(len(self.decoder_dims) - 2):
#             self.decoder.add_module("decoder_lin_{}".format(i), nn.Linear(self.decoder_dims[i], self.decoder_dims[i+1]))
#             self.decoder.add_module("decoder_relu_{}".format(i), nn.ReLU(True))
#         self.decoder.add_module("decoder_final", nn.Linear(self.decoder_dims[-2], self.decoder_dims[-1]))

#     def forward(self, edge_to, edge_from):
#         outputs = dict()
#         embedding_to = self.encoder(edge_to)
#         embedding_from = self.encoder(edge_from)
#         recon_to = self.decoder(embedding_to)
#         recon_from = self.decoder(embedding_from)
        
#         outputs["umap"] = (embedding_to, embedding_from)
#         outputs["recon"] = (recon_to, recon_from)

#         return outputs
