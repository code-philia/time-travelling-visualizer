import os

# main experiments
# os.system("python hybrid.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist")  # finish
# os.system("python hybrid.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist") # finish
# os.system("python hybrid.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10")    # finish

# ablation study on segments
# finish
# os.system("python ablation_segment.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist")
# os.system("python ablation_segment.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist")
# os.system("python ablation_segment.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10")

# ablation study on smoothness
# finish
# os.system("python ablation_smoothness.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist --wt 0")
# os.system("python ablation_smoothness.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist --wt 1")
# os.system("python ablation_smoothness.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist --wt 0")
# os.system("python ablation_smoothness.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist --wt 1")
# os.system("python ablation_smoothness.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10 --wt 0")
# os.system("python ablation_smoothness.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10 --wt 1")

# evaluation on ablation study on segments
# finish
# for exp in range(20):
#     os.system("python test_ablation_seg.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist -g 0 --exp exp_{}".format(str(exp)))
#     os.system("python test_ablation_seg.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist -g 0 --exp exp_{}".format(str(exp)))
#     os.system("python test_ablation_seg.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10 -g 0 --exp exp_{}".format(str(exp))) 


# # evaluation ablation study on smoothness
# os.system("python test_ablation.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist -g 0 --exp without_smoothness")
# os.system("python test_ablation.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist -g 0 --exp without_tl")
# os.system("python test_ablation.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist -g 0 --exp without_smoothness")
# os.system("python test_ablation.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist -g 0 --exp without_tl")
# os.system("python test_ablation.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10 -g 0 --exp without_smoothness")
# os.system("python test_ablation.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10 -g 0 --exp without_tl")

# # test hybird
# os.system("python test.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist")
# os.system("python test.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist")
# os.system("python test.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10")

# os.system("python deepdebugger_main.py --content_path /home/xianglin/projects/DVI_data/resnet18_mnist")
# os.system("python deepdebugger_main.py --content_path /home/xianglin/projects/DVI_data/resnet18_fmnist")
# os.system("python deepdebugger_main.py --content_path /home/xianglin/projects/DVI_data/resnet18_cifar10")

# timevis on noisy dataset
# datasets = ["cifar10","mnist","fmnist"]
# rates = ["5", "10", "20"]
# for data in datasets:
#     for rate in rates:
#         os.system("python timevis_main.py --content_path /home/xianglin/projects/DVI_data/noisy/symmetric/{}/{}".format(data, rate))
# timevis on active learning dataset
# datasets = ["CIFAR10", "FMNIST", "MNIST"]
# rates = ["10", "20", "30"]
# for data in datasets:
#     for rate in rates:
#         os.system("python timevis_main.py --content_path /home/xianglin/projects/DVI_data/active_learning/random/resnet18/{}/{}".format(data, rate))

# # feedback on noisy dataset
# datasets = ["mnist", "fmnist", "cifar10"]
# rates = ["5", "10", "20"]
# methods = ["tfDVI", "TimeVis"]
# for data in datasets:
#     for rate in rates:
#         for method in methods:
#             os.system("python feedback_noise.py --dataset {} --noise_rate {} --method {}".format(data, rate, method))

# # feedback on active learning dataset
# rates = ["10", "20", "30"]
# for data in datasets:
#     for rate in rates:
#         for method in methods:
#             os.system("python feedback_al.py --dataset {} --rate {} --method {}".format(data.upper(), rate, method))

# repeat = 4
# for _ in range(repeat):
#     # # feedback test on noisy dataset
#     datasets = ["mnist", "fmnist", "cifar10"]
#     rates = ["5", "10", "20"]
#     for data in datasets:
#         for rate in rates:
#             os.system("python feedback_noise_test.py --dataset {} --noise_rate {} --tolerance 0.03 0.05 0.1 0.15 --repeat 2 --round 50".format(data, rate))

#     # feedback test on active learning dataset
#     rates = ["10", "20", "30"]
#     for data in datasets:
#         for rate in rates:
#             os.system("python feedback_al_test.py --dataset {} --rate {} --tolerance 0.03 0.05 0.1 0.15 --repeat 1 --round 50".format(data, rate))

os.system("python anomaly_detection.py --dataset mnist --method tfDVI")
os.system("python anomaly_detection.py --dataset mnist --method TimeVis")
os.system("python anomaly_detection.py --dataset fmnist --method tfDVI")
os.system("python anomaly_detection.py --dataset fmnist --method TimeVis")
os.system("python anomaly_detection.py --dataset cifar10 --method tfDVI")
os.system("python anomaly_detection.py --dataset cifar10 --method TimeVis")