from influence_function.utils import grad_loss, calc_loss
import torchvision
import torchvision.transforms as transforms
import torch
import torchvision.models as models
from typing import Callable, List
from torch import nn
from torch.utils.data import DataLoader

class BaseInfluenceFunction():
    def __init__(
        self,
        dl_train: DataLoader,
        model: nn.Module,
        param_filter_fn: Callable[[str, nn.Parameter], bool] = None,
        criterion: nn.Module = nn.CrossEntropyLoss(reduction='none')
    ):

        self.dl_train = dl_train
        self.model = model
        self.criterion = criterion
        self.param_filter_fn = param_filter_fn
        self.n_train = len(dl_train.dataset)
        # self._cache_train_grad()
        # self.n_train = len(self.training_grads)

    def _cache_train_grad(self):
        self.training_grads = grad_loss(
            model=self.model,
            criterion=self.criterion,
            dl=self.dl_train,
            param_filter_fn=self.param_filter_fn
        ) # List of dl_train size, each inner list contains gradients of selected params for one sample

    def query_influence(
            self,
            query_input: torch.Tensor,
            query_target: torch.Tensor,
    ) -> List[float]:
        # Gradient of test input
        test_grad = grad_loss(
            model=self.model,
            criterion=self.criterion,
            dl=(query_input, query_target),
            param_filter_fn=self.param_filter_fn
        )[0]
        # Inverse Hessian-vector product s_test = (H⁻¹ · test_grad)
        h_inverse_v = inverse_hessian_product(
            model=self.model,
            criterion=self.criterion,
            v=test_grad,
            dl_tr=self.dl_train,
            param_filter_fn=self.param_filter_fn
        ) # List[List[Tensor]]

        # Influence = - <grad_train_i, s_test>
        influence_values = []
        for train_grad in self.training_grads:  # List[Tensor]
            dot = sum(torch.sum(g1 * g2.to(g1.device)) for g1, g2 in zip(train_grad, h_inverse_v))
            influence_values.append(-dot.item() / self.n_train)  # divide by training sample size

        return influence_values

class EmpiricalIF(BaseInfluenceFunction):
    @staticmethod
    def get_filtered_param_snapshot(
            model: nn.Module,
            param_filter_fn: Callable[[str, nn.Parameter], bool] = None
    ) -> List[torch.Tensor]:
        """
        Return a list of parameter tensors (deepcopied) that match param_filter_fn.

        Args:
            model: nn.Module
            param_filter_fn: function (name, param) -> bool

        Returns:
            List[Tensor]: copied parameter tensors
        """
        snapshot = []
        for name, param in model.named_parameters():
            if param_filter_fn is None or param_filter_fn(name, param):
                snapshot.append(param.detach().clone())
        return snapshot

    @staticmethod
    def restore_params(
        model: nn.Module,
        param_snapshot: List[torch.Tensor],
        param_filter_fn: Callable[[str, nn.Parameter], bool] = None
    ):
        """
        Restore model parameters from a snapshot.

        Args:
            model: nn.Module
            param_snapshot: list of tensors (same order as get_filtered_param_snapshot)
            param_filter_fn: function (name, param) -> bool
        """
        idx = 0
        for name, param in model.named_parameters():
            if param_filter_fn is None or param_filter_fn(name, param):
                param.data.copy_(param_snapshot[idx].to(param.device))
                idx += 1

    @staticmethod
    def apply_test_gradient_update(
        model: nn.Module,
        test_grad: List[torch.Tensor],
        param_filter_fn: Callable[[str, nn.Parameter], bool],
        lr: float
    ):
        """
        Apply one gradient descent step using test_grad to selected model parameters.

        Arguments:
            model: torch.nn.Module
            test_grad: List[Tensor], gradients corresponding to filtered parameters
            param_filter_fn: function (name, param) -> bool to filter parameters
            lr: learning rate
        """
        named_params = list(model.named_parameters())
        idx = 0

        for name, param in named_params:
            if param_filter_fn is None or param_filter_fn(name, param):
                grad_tensor = test_grad[idx].to(param.device)
                param.data -= lr * grad_tensor  # gradient descent step
                idx += 1

    def query_influence(
        self,
        query_input: torch.Tensor,
        query_target: torch.Tensor,
    ) -> List[float]:

        # Gradient of test input
        test_grad = grad_loss(
            model=self.model,
            criterion=self.criterion,
            dl=(query_input, query_target),
            param_filter_fn=self.param_filter_fn
        )[0]

        # Backup
        before_update = self.get_filtered_param_snapshot(self.model, self.param_filter_fn)

        # loss before update
        train_loss_before = calc_loss(self.model, self.criterion, self.dl_train)
        test_loss_before  = calc_loss(self.model, self.criterion, (query_input, query_target))

        # Gradient descent
        self.apply_test_gradient_update(
            model=self.model,
            test_grad=test_grad,
            param_filter_fn=self.param_filter_fn,
            lr=1e-1
        )

        # Compute training loss change and testing loss change
        train_loss_after_descent  = calc_loss(self.model, self.criterion, self.dl_train)
        train_loss_change_descent = train_loss_after_descent - train_loss_before # (N_train,)
        test_loss_after_descent   = calc_loss(self.model, self.criterion, (query_input, query_target))
        test_loss_change_descent  = test_loss_after_descent  - test_loss_before # (1,)

        # 恢复原始权重
        self.restore_params(self.model, before_update, self.param_filter_fn)

        # Gradient ascent
        self.apply_test_gradient_update(
            model=self.model,
            test_grad=test_grad,
            param_filter_fn=self.param_filter_fn,
            lr=-1e-1
        )

        # Compute training loss change and testing loss change
        train_loss_after_ascent  = calc_loss(self.model, self.criterion, self.dl_train)
        train_loss_change_ascent = train_loss_after_ascent - train_loss_before # (N_train,)
        test_loss_after_ascent   = calc_loss(self.model, self.criterion, (query_input, query_target))
        test_loss_change_ascent  = test_loss_after_ascent - test_loss_before # (1,)

        # 恢复原始权重
        self.restore_params(self.model, before_update, self.param_filter_fn)

        # Influence = - <l'(train)-l(train), l'(train)-l(train)>
        influence_values = (float(test_loss_change_ascent) * train_loss_change_ascent +
                            float(test_loss_change_descent) * train_loss_change_descent) / 2 # shape: (N_train,)

        return influence_values

    def reverse_check(
        self,
        query_input: torch.Tensor,
        query_target: torch.Tensor,
        influence_values: List[float],
        check_ratio: float = 0.01
    ):
        """
        Perform reverse check by perturbing selected training samples (via gradient ascent and descent),
        and measuring how they affect the test loss of the query sample.

        Two groups of training samples are considered:
            1. Most influential (top-k by absolute influence value)
            2. Least influential (bottom-k by absolute influence value)

        Args:
            query_input (Tensor): The input tensor for the query (test) sample.
            query_target (Tensor): The target label for the query (test) sample.
            influence_values (List[float]): Influence values for all training samples.
            check_ratio (float): Fraction of training samples to check for each of the two groups.

        Returns:
            tuple(List[tuple], List[tuple]): (most_influential, least_influential)
                - most_influential: [(idx, influence_value, reverse_influence_value), ...],
                - least_influential: [(idx, influence_value, reverse_influence_value), ...],
        """
        test_loss_before = calc_loss(self.model, self.criterion, (query_input, query_target))
        N = len(influence_values)
        k = max(1, int(N * check_ratio))

        influence_tensor = torch.tensor(influence_values)
        abs_sorted_indices = torch.argsort(influence_tensor, descending=True)

        # k most influential samples
        topk_indices = abs_sorted_indices[:k].tolist()
        # k least influential samples
        bottomk_indices = abs_sorted_indices[-k:].tolist()[::-1]

        def evaluate_reverse(indices):
            results = []
            for idx in indices:
                # get training sample
                train_input, train_target = self.dl_train.dataset[idx]
                train_input = train_input.unsqueeze(0).to(query_input.device)
                train_target = torch.tensor([train_target]).to(query_input.device)

                train_loss_before = calc_loss(self.model, self.criterion, (train_input, train_target))

                # compute gradients for the training sample
                train_grad = grad_loss(
                    model=self.model,
                    criterion=self.criterion,
                    dl=(train_input, train_target),
                    param_filter_fn=self.param_filter_fn
                )[0]
                
                # backup
                before_update = self.get_filtered_param_snapshot(self.model, self.param_filter_fn)

                # descent
                self.apply_test_gradient_update(
                    model=self.model,
                    test_grad=train_grad,
                    param_filter_fn=self.param_filter_fn,
                    lr=1e-3
                )
                train_loss_after_descent = calc_loss(self.model, self.criterion, (train_input, train_target))
                train_loss_change_descent = train_loss_after_descent - train_loss_before # (1,)
                test_loss_after_descent = calc_loss(self.model, self.criterion, (query_input, query_target))
                test_loss_change_descent = test_loss_after_descent - test_loss_before # (1,)
                self.restore_params(self.model, before_update, self.param_filter_fn)

                # ascent
                self.apply_test_gradient_update(
                    model=self.model,
                    test_grad=train_grad,
                    param_filter_fn=self.param_filter_fn,
                    lr=-1e-3
                )
                train_loss_after_ascent = calc_loss(self.model, self.criterion, (train_input, train_target))
                train_loss_change_ascent = train_loss_after_ascent - train_loss_before # (1,)
                test_loss_after_ascent = calc_loss(self.model, self.criterion, (query_input, query_target))
                test_loss_change_ascent = test_loss_after_ascent - test_loss_before # (1,)
                self.restore_params(self.model, before_update, self.param_filter_fn)

                reverse_influence_value = (float(test_loss_change_ascent) * float(train_loss_change_ascent) +
                    float(test_loss_change_descent) * float(train_loss_change_descent)) / 2

                results.append((idx, float(influence_tensor[idx]), reverse_influence_value))
            return results

        most_influential = evaluate_reverse(topk_indices)
        least_influential = evaluate_reverse(bottomk_indices)
        
        return most_influential, least_influential
        
        
if __name__ == '__main__':

    # Define a transform to normalize the data
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
    ])

    # Load the training dataset
    trainset = torchvision.datasets.CIFAR10(root='./data', train=True, download=True, transform=transform)
    trainloader = torch.utils.data.DataLoader(trainset, batch_size=128, shuffle=False, num_workers=2)

    # Load the test dataset
    testset = torchvision.datasets.CIFAR10(root='./data', train=False, download=True, transform=transform)
    testloader = torch.utils.data.DataLoader(testset, batch_size=1, shuffle=False, num_workers=2)

    resnet18 = models.resnet18(pretrained=True)
    num_classes = 10  # CIFAR-10 has 10 classes
    resnet18.fc = nn.Linear(resnet18.fc.in_features, num_classes)  # Replace the last layer

    IF = EmpiricalIF(dl_train=trainloader,
                               model=resnet18,
                               param_filter_fn=lambda name, param: 'fc' in name,
                               criterion=nn.CrossEntropyLoss(reduction="none"))


    for test_sample in testloader:
        test_input, test_target = test_sample
        IF_scores = IF.query_influence(test_input, test_target)
