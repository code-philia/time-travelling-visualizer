import random

from tqdm import tqdm
from influence_function.utils import grad_loss, grad_pair_loss, calc_loss, calc_pair_loss, inverse_hessian_product
from influence_function.ContrastiveLoss import ContrastiveLossWrapper
from influence_function.CustomEncoderModel import CustomEncoderModel
import torch
from typing import Callable, List, Tuple
from torch import nn
from torch.utils.data import DataLoader, Dataset

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

class PairWiseEmpiricalIF:
    def __init__(
        self,
        dl_train: DataLoader,
        model: nn.Module,
        param_filter_fn: Callable[[str, nn.Parameter], bool] = None,
    ):
        self.dl_train = dl_train
        self.model = model
        self.criterion = ContrastiveLossWrapper()
        self.param_filter_fn = param_filter_fn
        self.train_samples = list(dl_train.dataset)
        self.num_train_samples = len(self.train_samples)

    @staticmethod
    def get_filtered_param_snapshot(
        model: nn.Module,
        param_filter_fn: Callable[[str, nn.Parameter], bool] = None
    ) -> List[torch.Tensor]:
        return [p.detach().clone() for n, p in model.named_parameters() if (param_filter_fn is None or param_filter_fn(n, p))]

    @staticmethod
    def restore_params(
        model: nn.Module,
        param_snapshot: List[torch.Tensor],
        param_filter_fn: Callable[[str, nn.Parameter], bool] = None
    ):
        idx = 0
        for n, p in model.named_parameters():
            if param_filter_fn is None or param_filter_fn(n, p):
                p.data.copy_(param_snapshot[idx].to(p.device))
                idx += 1

    @staticmethod
    def apply_gradient_update(
        model: nn.Module,
        grad_tensors: List[torch.Tensor],
        param_filter_fn: Callable[[str, nn.Parameter], bool],
        lr: float
    ):
        idx = 0
        for n, p in model.named_parameters():
            if param_filter_fn is None or param_filter_fn(n, p):
                grad_tensor = grad_tensors[idx].to(p.device)
                p.data -= lr * grad_tensor
                idx += 1

    def query_influence(
        self,
        query_doc: torch.Tensor,
        query_code: torch.Tensor,
        query_is_positive: bool, # True for anomaly 1, False for anomaly 2
        lr: float = 1e-2,
        num_negative_samples: int = 16
    ) -> List[Tuple[int, int, float, str]]:
        """
        计算所有训练样本对查询异常现象的影响。
        每个训练样本i会采样num_negative_samples个负样本j。
        返回结果: (doc_index, code_index, influence_value, "positive" or "negative")
        """
        # 确保输入是batch形式
        query_doc = query_doc.unsqueeze(0) if query_doc.dim() == 1 else query_doc
        query_code = query_code.unsqueeze(0) if query_code.dim() == 1 else query_code
        
        # 1. 计算查询对的“修复”梯度
        print("计算查询对的梯度...")
        query_grad = grad_pair_loss(
            self.model, self.criterion, query_doc, query_code, query_is_positive, self.param_filter_fn
        )

        # 2. 备份原始模型权重
        before_update = self.get_filtered_param_snapshot(self.model, self.param_filter_fn)

        # 3. 计算所有训练样本在扰动前后的“损失”变化
        all_influences = []

        # --- 正样本对 ---
        # 扰动前的损失
        print("计算训练样本（正）的原始损失...")
        positive_losses_before = calc_pair_loss(self.model, self.criterion, self.train_samples, is_positive=True)

        # --- 负样本对 ---
        # 为每个doc_i采样32个负样本code_j
        print(f"为每个训练样本采样 {num_negative_samples} 个负样本...")
        negative_sample_info = []
        possible_j_indices = list(range(self.num_train_samples))
        for i in range(self.num_train_samples):
            # 从所有j中排除i
            # 为了效率，我们不为每个i都新建列表
            # random.sample可以处理集合，但为了保持索引，我们用以下方式
            sampled_j_indices = random.sample([idx for idx in possible_j_indices if idx != i], num_negative_samples)
            doc_i = self.train_samples[i][0]
            for j in sampled_j_indices:
                code_j = self.train_samples[j][1]
                negative_sample_info.append({'i': i, 'j': j, 'data': (doc_i, code_j)})
        
        negative_samples_data = [info['data'] for info in negative_sample_info]
        
        # 扰动前的损失
        print("计算训练样本（负）的原始损失...")
        negative_losses_before = calc_pair_loss(self.model, self.criterion, negative_samples_data, is_positive=False)

        # --- 模拟梯度下降 ---
        print("模拟梯度下降...")
        self.apply_gradient_update(self.model, query_grad, self.param_filter_fn, lr=lr)
        positive_losses_after_descent = calc_pair_loss(self.model, self.criterion, self.train_samples, is_positive=True)
        negative_losses_after_descent = calc_pair_loss(self.model, self.criterion, negative_samples_data, is_positive=False)
        self.restore_params(self.model, before_update, self.param_filter_fn)

        # --- 模拟梯度上升 ---
        print("模拟梯度上升...")
        self.apply_gradient_update(self.model, query_grad, self.param_filter_fn, lr=-lr)
        positive_losses_after_ascent = calc_pair_loss(self.model, self.criterion, self.train_samples, is_positive=True)
        negative_losses_after_ascent = calc_pair_loss(self.model, self.criterion, negative_samples_data, is_positive=False)
        self.restore_params(self.model, before_update, self.param_filter_fn)
        
        # 4. 计算影响值
        print("计算影响值...")
        query_loss_before = calc_pair_loss(self.model, self.criterion, [(query_doc, query_code)], query_is_positive)[0]
        # 重新应用梯度下降以计算查询损失变化
        self.apply_gradient_update(self.model, query_grad, self.param_filter_fn, lr=lr)
        query_loss_after_descent = calc_pair_loss(self.model, self.criterion, [(query_doc, query_code)], query_is_positive)[0]
        self.restore_params(self.model, before_update, self.param_filter_fn)
        # 重新应用梯度上升以计算查询损失变化
        self.apply_gradient_update(self.model, query_grad, self.param_filter_fn, lr=-lr)
        query_loss_after_ascent = calc_pair_loss(self.model, self.criterion, [(query_doc, query_code)], query_is_positive)[0]
        self.restore_params(self.model, before_update, self.param_filter_fn)
        
        query_loss_change_descent = query_loss_after_descent - query_loss_before
        query_loss_change_ascent = query_loss_after_ascent - query_loss_before

        # --- 整合正样本影响 ---
        for i in range(self.num_train_samples):
            pos_loss_change_descent = positive_losses_after_descent[i] - positive_losses_before[i]
            pos_loss_change_ascent = positive_losses_after_ascent[i] - positive_losses_before[i]
            influence_pos = (query_loss_change_descent * pos_loss_change_descent + 
                             query_loss_change_ascent * pos_loss_change_ascent) / 2
            # 返回 (doc_idx, code_idx, influence, type)
            all_influences.append((i, i, influence_pos, "positive"))

        # --- 整合负样本影响 ---
        for idx, info in enumerate(negative_sample_info):
            i, j = info['i'], info['j']
            neg_loss_change_descent = negative_losses_after_descent[idx] - negative_losses_before[idx]
            neg_loss_change_ascent = negative_losses_after_ascent[idx] - negative_losses_before[idx]
            influence_neg = (query_loss_change_descent * neg_loss_change_descent +
                             query_loss_change_ascent * neg_loss_change_ascent) / 2
            # 返回 (doc_idx, code_idx, influence, type)
            all_influences.append((i, j, influence_neg, "negative"))
            
        # 排序并返回，根据影响力值（下标2）
        all_influences.sort(key=lambda x: x[2], reverse=True)
        return all_influences

        
# if __name__ == '__main__':

#     # Define a transform to normalize the data
#     transform = transforms.Compose([
#         transforms.ToTensor(),
#         transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
#     ])

#     # Load the training dataset
#     trainset = torchvision.datasets.CIFAR10(root='./data', train=True, download=True, transform=transform)
#     trainloader = torch.utils.data.DataLoader(trainset, batch_size=128, shuffle=False, num_workers=2)

#     # Load the test dataset
#     testset = torchvision.datasets.CIFAR10(root='./data', train=False, download=True, transform=transform)
#     testloader = torch.utils.data.DataLoader(testset, batch_size=1, shuffle=False, num_workers=2)

#     resnet18 = models.resnet18(pretrained=True)
#     num_classes = 10  # CIFAR-10 has 10 classes
#     resnet18.fc = nn.Linear(resnet18.fc.in_features, num_classes)  # Replace the last layer

#     IF = EmpiricalIF(dl_train=trainloader,
#                                model=resnet18,
#                                param_filter_fn=lambda name, param: 'fc' in name,
#                                criterion=nn.CrossEntropyLoss(reduction="none"))


#     for test_sample in testloader:
#         test_input, test_target = test_sample
#         IF_scores = IF.query_influence(test_input, test_target)