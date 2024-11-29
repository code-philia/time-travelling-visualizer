import argparse

def parse_args():
    parser = argparse.ArgumentParser(description='Time Travelling Visualizer')
    parser.add_argument('--content_path', '-p', type=str, required=True, default='',
                       help='Training dynamic path')
    parser.add_argument('--vis_method', '-v', type=str, default='DVI',
                       help='Visualization method')
    return parser.parse_args()

def run(args):
    # Use args.input, args.output, args.format as needed
    # step 1: get high dimention representation

    # step 2: train visualize model

    # step 3: use visualize model to get 2-D embedding

    pass

if __name__ == "__main__":
    args = parse_args()
    run(args)