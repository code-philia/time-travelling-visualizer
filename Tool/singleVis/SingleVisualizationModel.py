from torch import nn


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
import tensorflow as tf
from tensorflow import keras
class tfModel(keras.Model):
    def __init__(self, optimizer, loss, loss_weights, encoder_dims, decoder_dims, batch_size, withoutB=True, attention=True, prev_trainable_variables=None):

        super(tfModel, self).__init__()
        self._init_autoencoder(encoder_dims, decoder_dims)
        self.optimizer = optimizer  # optimizer
        self.withoutB = withoutB
        self.attention = attention

        self.loss = loss  # dict of 3 losses {"total", "umap", "reconstrunction", "regularization"}
        self.loss_weights = loss_weights  # weights for each loss (in total 3 losses)

        self.prev_trainable_variables = prev_trainable_variables  # weights for previous iteration
        self.batch_size = batch_size
    
    def _init_autoencoder(self, encoder_dims, decoder_dims):
        self.encoder = tf.keras.Sequential([
            tf.keras.layers.InputLayer(input_shape=(encoder_dims[0],)),
            tf.keras.layers.Flatten(),
        ])
        for i in range(1, len(encoder_dims)-1, 1):
            self.encoder.add(tf.keras.layers.Dense(units=encoder_dims[i], activation="relu"))
        self.encoder.add(tf.keras.layers.Dense(units=encoder_dims[-1]),)

        self.decoder = tf.keras.Sequential([
            tf.keras.layers.InputLayer(input_shape=(decoder_dims[0],)),
        ])
        for i in range(1, len(decoder_dims)-1, 1):
            self.decoder.add(tf.keras.layers.Dense(units=decoder_dims[i], activation="relu"))
        self.decoder.add(tf.keras.layers.Dense(units=decoder_dims[-1]))
        print(self.encoder.summary())
        print(self.decoder.summary())

    def train_step(self, x):

        to_x, from_x, to_alpha, from_alpha, n_rate, weight = x[0]
        to_x = tf.cast(to_x, dtype=tf.float32)
        from_x = tf.cast(from_x, dtype=tf.float32)
        to_alpha = tf.cast(to_alpha, dtype=tf.float32)
        from_alpha = tf.cast(from_alpha, dtype=tf.float32)
        n_rate = tf.cast(n_rate, dtype=tf.float32)
        weight = tf.cast(weight, dtype=tf.float32)

        # Forward pass
        with tf.GradientTape(persistent=True) as tape:

            # parametric embedding
            embedding_to = self.encoder(to_x)  # embedding for instance 1
            embedding_from = self.encoder(from_x)  # embedding for instance 1
            embedding_to_recon = self.decoder(embedding_to)  # reconstruct instance 1
            embedding_from_recon = self.decoder(embedding_from)  # reconstruct instance 1

            # concatenate embedding1 and embedding2 to prepare for umap loss
            embedding_to_from = tf.concat((embedding_to, embedding_from, weight),
                                          axis=1)
            # reconstruction loss
            if self.attention:
                reconstruct_loss = self.loss["reconstruction"](to_x, from_x, embedding_to_recon, embedding_from_recon,to_alpha, from_alpha)
            else:
                self.loss["reconstruction"] = tf.keras.losses.MeanSquaredError()
                reconstruct_loss = self.loss["reconstruction"](y_true=to_x, y_pred=embedding_to_recon)/2 + self.loss["reconstruction"](y_true=from_x, y_pred=embedding_from_recon)/2

            # umap loss
            umap_loss = self.loss["umap"](None, embed_to_from=embedding_to_from)  # w_(t-1), no gradient

            # compute alpha bar
            alpha_mean = tf.cast(tf.reduce_mean(tf.stop_gradient(n_rate)), dtype=tf.float32)
            # L2 norm of w current - w for last epoch (subject model's epoch)
            # dummy zeros-loss if no previous epoch
            if self.prev_trainable_variables is None:
                prev_trainable_variables = [tf.stop_gradient(x) for x in self.trainable_variables]
            else:
                prev_trainable_variables = self.prev_trainable_variables
            regularization_loss = self.loss["regularization"](w_prev=prev_trainable_variables,w_current=self.trainable_variables, to_alpha=alpha_mean)

                # aggregate loss, weighted average
            loss = tf.add(tf.add(tf.math.multiply(tf.constant(self.loss_weights["reconstruction"]), reconstruct_loss),
                                    tf.math.multiply(tf.constant(self.loss_weights["umap"]), umap_loss)),
                            tf.math.multiply(tf.constant(self.loss_weights["regularization"]), regularization_loss))

        # Compute gradients
        trainable_vars = self.trainable_variables
        grads = tape.gradient(loss, trainable_vars)

        # Update weights
        self.optimizer.apply_gradients(zip(grads, trainable_vars))

        return {"loss": loss, "umap": umap_loss, "reconstruction": reconstruct_loss,
                "regularization": regularization_loss}


