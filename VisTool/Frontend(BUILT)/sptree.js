/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("org_tensorflow_tensorboard/tensorboard/projector/sptree", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * A Space-partitioning tree (https://en.wikipedia.org/wiki/Space_partitioning)
     * that recursively divides the space into regions of equal sizes. This data
     * structure can act both as a Quad tree and an Octree when the data is 2 or
     * 3 dimensional respectively. One usage is in t-SNE in order to do Barnes-Hut
     * approximation.
     */
    class SPTree {
        /**
         * Constructs a new tree with the provided data.
         *
         * @param data List of n-dimensional data points.
         * @param capacity Number of data points to store in a single node.
         */
        constructor(data) {
            if (data.length < 1) {
                throw new Error('There should be at least 1 data point');
            }
            // Make a bounding box based on the extent of the data.
            this.dim = data[0].length;
            // Each node has 2^d children, where d is the dimension of the space.
            // Binary masks (e.g. 000, 001, ... 111 in 3D) are used to determine in
            // which child (e.g. quadron in 2D) the new point is going to be assigned.
            // For more details, see the insert() method and its comments.
            this.masks = new Array(Math.pow(2, this.dim));
            for (let d = 0; d < this.masks.length; ++d) {
                this.masks[d] = 1 << d;
            }
            let min = new Array(this.dim);
            fillArray(min, Number.POSITIVE_INFINITY);
            let max = new Array(this.dim);
            fillArray(max, Number.NEGATIVE_INFINITY);
            for (let i = 0; i < data.length; ++i) {
                // For each dim get the min and max.
                // E.g. For 2-D, get the x_min, x_max, y_min, y_max.
                for (let d = 0; d < this.dim; ++d) {
                    min[d] = Math.min(min[d], data[i][d]);
                    max[d] = Math.max(max[d], data[i][d]);
                }
            }
            // Create a bounding box with the center of the largest span.
            let center = new Array(this.dim);
            let halfDim = 0;
            for (let d = 0; d < this.dim; ++d) {
                let span = max[d] - min[d];
                center[d] = min[d] + span / 2;
                halfDim = Math.max(halfDim, span / 2);
            }
            this.root = { box: { center: center, halfDim: halfDim }, point: data[0] };
            for (let i = 1; i < data.length; ++i) {
                this.insert(this.root, data[i]);
            }
        }
        /**
         * Visits every node in the tree. Each node can store 1 or more points,
         * depending on the node capacity provided in the constructor.
         *
         * @param accessor Method that takes the currently visited node, and the
         * low and high point of the region that this node occupies. E.g. in 2D,
         * the low and high points will be the lower-left corner and the upper-right
         * corner.
         */
        visit(accessor, noBox = false) {
            this.visitNode(this.root, accessor, noBox);
        }
        visitNode(node, accessor, noBox) {
            let skipChildren;
            if (noBox) {
                skipChildren = accessor(node);
            }
            else {
                let lowPoint = new Array(this.dim);
                let highPoint = new Array(this.dim);
                for (let d = 0; d < this.dim; ++d) {
                    lowPoint[d] = node.box.center[d] - node.box.halfDim;
                    highPoint[d] = node.box.center[d] + node.box.halfDim;
                }
                skipChildren = accessor(node, lowPoint, highPoint);
            }
            if (!node.children || skipChildren) {
                return;
            }
            for (let i = 0; i < node.children.length; ++i) {
                let child = node.children[i];
                if (child) {
                    this.visitNode(child, accessor, noBox);
                }
            }
        }
        insert(node, p) {
            // Subdivide and then add the point to whichever node will accept it.
            if (node.children == null) {
                node.children = new Array(this.masks.length);
            }
            // Decide which child will get the new point by constructing a D-bits binary
            // signature (D=3 for 3D) where the k-th bit is 1 if the point's k-th
            // coordinate is greater than the node's k-th coordinate, 0 otherwise.
            // Then the binary signature in decimal system gives us the index of the
            // child where the new point should be.
            let index = 0;
            for (let d = 0; d < this.dim; ++d) {
                if (p[d] > node.box.center[d]) {
                    index |= this.masks[d];
                }
            }
            if (node.children[index] == null) {
                this.makeChild(node, index, p);
            }
            else {
                this.insert(node.children[index], p);
            }
        }
        makeChild(node, index, p) {
            let oldC = node.box.center;
            let h = node.box.halfDim / 2;
            let newC = new Array(this.dim);
            for (let d = 0; d < this.dim; ++d) {
                newC[d] = index & (1 << d) ? oldC[d] + h : oldC[d] - h;
            }
            node.children[index] = { box: { center: newC, halfDim: h }, point: p };
        }
    }
    exports.SPTree = SPTree;
    function fillArray(arr, value) {
        for (let i = 0; i < arr.length; ++i) {
            arr[i] = value;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3B0cmVlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL3NwdHJlZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7Ozs7Ozs7Ozs7OztJQWdCaEY7Ozs7OztPQU1HO0lBQ0gsTUFBYSxNQUFNO1FBSWpCOzs7OztXQUtHO1FBQ0gsWUFBWSxJQUFhO1lBQ3ZCLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQzthQUMxRDtZQUNELHVEQUF1RDtZQUN2RCxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFDMUIscUVBQXFFO1lBQ3JFLHVFQUF1RTtZQUN2RSwwRUFBMEU7WUFDMUUsOERBQThEO1lBQzlELElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDOUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO2dCQUMxQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDeEI7WUFDRCxJQUFJLEdBQUcsR0FBVSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDckMsU0FBUyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUN6QyxJQUFJLEdBQUcsR0FBVSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDckMsU0FBUyxDQUFDLEdBQUcs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RCx3QkEwSEM7SUFDRCxTQUFTLFNBQVMsQ0FBSSxHQUFRLEVBQUUsS0FBUTtRQUN0QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUNuQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ2hCO0lBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuZXhwb3J0IHR5cGUgUG9pbnQgPSBudW1iZXJbXTtcbmV4cG9ydCBpbnRlcmZhY2UgQkJveCB7XG4gIGNlbnRlcjogUG9pbnQ7XG4gIGhhbGZEaW06IG51bWJlcjtcbn1cbi8qKiBBIG5vZGUgaW4gYSBzcGFjZS1wYXJ0aXRpb25pbmcgdHJlZS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU1BOb2RlIHtcbiAgLyoqIFRoZSBjaGlsZHJlbiBvZiB0aGlzIG5vZGUuICovXG4gIGNoaWxkcmVuPzogU1BOb2RlW107XG4gIC8qKiBUaGUgYm91bmRpbmcgYm94IG9mIHRoZSByZWdpb24gdGhpcyBub2RlIG9jY3VwaWVzLiAqL1xuICBib3g6IEJCb3g7XG4gIC8qKiBPbmUgb3IgbW9yZSBwb2ludHMgdGhpcyBub2RlIGhhcy4gKi9cbiAgcG9pbnQ6IFBvaW50O1xufVxuLyoqXG4gKiBBIFNwYWNlLXBhcnRpdGlvbmluZyB0cmVlIChodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TcGFjZV9wYXJ0aXRpb25pbmcpXG4gKiB0aGF0IHJlY3Vyc2l2ZWx5IGRpdmlkZXMgdGhlIHNwYWNlIGludG8gcmVnaW9ucyBvZiBlcXVhbCBzaXplcy4gVGhpcyBkYXRhXG4gKiBzdHJ1Y3R1cmUgY2FuIGFjdCBib3RoIGFzIGEgUXVhZCB0cmVlIGFuZCBhbiBPY3RyZWUgd2hlbiB0aGUgZGF0YSBpcyAyIG9yXG4gKiAzIGRpbWVuc2lvbmFsIHJlc3BlY3RpdmVseS4gT25lIHVzYWdlIGlzIGluIHQtU05FIGluIG9yZGVyIHRvIGRvIEJhcm5lcy1IdXRcbiAqIGFwcHJveGltYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBTUFRyZWUge1xuICByb290OiBTUE5vZGU7XG4gIHByaXZhdGUgbWFza3M6IG51bWJlcltdO1xuICBwcml2YXRlIGRpbTogbnVtYmVyO1xuICAvKipcbiAgICogQ29uc3RydWN0cyBhIG5ldyB0cmVlIHdpdGggdGhlIHByb3ZpZGVkIGRhdGEuXG4gICAqXG4gICAqIEBwYXJhbSBkYXRhIExpc3Qgb2Ygbi1kaW1lbnNpb25hbCBkYXRhIHBvaW50cy5cbiAgICogQHBhcmFtIGNhcGFjaXR5IE51bWJlciBvZiBkYXRhIHBvaW50cyB0byBzdG9yZSBpbiBhIHNpbmdsZSBub2RlLlxuICAgKi9cbiAgY29uc3RydWN0b3IoZGF0YTogUG9pbnRbXSkge1xuICAgIGlmIChkYXRhLmxlbmd0aCA8IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IDEgZGF0YSBwb2ludCcpO1xuICAgIH1cbiAgICAvLyBNYWtlIGEgYm91bmRpbmcgYm94IGJhc2VkIG9uIHRoZSBleHRlbnQgb2YgdGhlIGRhdGEuXG4gICAgdGhpcy5kaW0gPSBkYXRhWzBdLmxlbmd0aDtcbiAgICAvLyBFYWNoIG5vZGUgaGFzIDJeZCBjaGlsZHJlbiwgd2hlcmUgZCBpcyB0aGUgZGltZW5zaW9uIG9mIHRoZSBzcGFjZS5cbiAgICAvLyBCaW5hcnkgbWFza3MgKGUuZy4gMDAwLCAwMDEsIC4uLiAxMTEgaW4gM0QpIGFyZSB1c2VkIHRvIGRldGVybWluZSBpblxuICAgIC8vIHdoaWNoIGNoaWxkIChlLmcuIHF1YWRyb24gaW4gMkQpIHRoZSBuZXcgcG9pbnQgaXMgZ29pbmcgdG8gYmUgYXNzaWduZWQuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlscywgc2VlIHRoZSBpbnNlcnQoKSBtZXRob2QgYW5kIGl0cyBjb21tZW50cy5cbiAgICB0aGlzLm1hc2tzID0gbmV3IEFycmF5KE1hdGgucG93KDIsIHRoaXMuZGltKSk7XG4gICAgZm9yIChsZXQgZCA9IDA7IGQgPCB0aGlzLm1hc2tzLmxlbmd0aDsgKytkKSB7XG4gICAgICB0aGlzLm1hc2tzW2RdID0gMSA8PCBkO1xuICAgIH1cbiAgICBsZXQgbWluOiBQb2ludCA9IG5ldyBBcnJheSh0aGlzLmRpbSk7XG4gICAgZmlsbEFycmF5KG1pbiwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKTtcbiAgICBsZXQgbWF4OiBQb2ludCA9IG5ldyBBcnJheSh0aGlzLmRpbSk7XG4gICAgZmlsbEFycmF5KG1heCwgTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyArK2kpIHtcbiAgICAgIC8vIEZvciBlYWNoIGRpbSBnZXQgdGhlIG1pbiBhbmQgbWF4LlxuICAgICAgLy8gRS5nLiBGb3IgMi1ELCBnZXQgdGhlIHhfbWluLCB4X21heCwgeV9taW4sIHlfbWF4LlxuICAgICAgZm9yIChsZXQgZCA9IDA7IGQgPCB0aGlzLmRpbTsgKytkKSB7XG4gICAgICAgIG1pbltkXSA9IE1hdGgubWluKG1pbltkXSwgZGF0YVtpXVtkXSk7XG4gICAgICAgIG1heFtkXSA9IE1hdGgubWF4KG1heFtkXSwgZGF0YVtpXVtkXSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIENyZWF0ZSBhIGJvdW5kaW5nIGJveCB3aXRoIHRoZSBjZW50ZXIgb2YgdGhlIGxhcmdlc3Qgc3Bhbi5cbiAgICBsZXQgY2VudGVyOiBQb2ludCA9IG5ldyBBcnJheSh0aGlzLmRpbSk7XG4gICAgbGV0IGhhbGZEaW0gPSAwO1xuICAgIGZvciAobGV0IGQgPSAwOyBkIDwgdGhpcy5kaW07ICsrZCkge1xuICAgICAgbGV0IHNwYW4gPSBtYXhbZF0gLSBtaW5bZF07XG4gICAgICBjZW50ZXJbZF0gPSBtaW5bZF0gKyBzcGFuIC8gMjtcbiAgICAgIGhhbGZEaW0gPSBNYXRoLm1heChoYWxmRGltLCBzcGFuIC8gMik7XG4gICAgfVxuICAgIHRoaXMucm9vdCA9IHtib3g6IHtjZW50ZXI6IGNlbnRlciwgaGFsZkRpbTogaGFsZkRpbX0sIHBvaW50OiBkYXRhWzBdfTtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGRhdGEubGVuZ3RoOyArK2kpIHtcbiAgICAgIHRoaXMuaW5zZXJ0KHRoaXMucm9vdCwgZGF0YVtpXSk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBWaXNpdHMgZXZlcnkgbm9kZSBpbiB0aGUgdHJlZS4gRWFjaCBub2RlIGNhbiBzdG9yZSAxIG9yIG1vcmUgcG9pbnRzLFxuICAgKiBkZXBlbmRpbmcgb24gdGhlIG5vZGUgY2FwYWNpdHkgcHJvdmlkZWQgaW4gdGhlIGNvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBAcGFyYW0gYWNjZXNzb3IgTWV0aG9kIHRoYXQgdGFrZXMgdGhlIGN1cnJlbnRseSB2aXNpdGVkIG5vZGUsIGFuZCB0aGVcbiAgICogbG93IGFuZCBoaWdoIHBvaW50IG9mIHRoZSByZWdpb24gdGhhdCB0aGlzIG5vZGUgb2NjdXBpZXMuIEUuZy4gaW4gMkQsXG4gICAqIHRoZSBsb3cgYW5kIGhpZ2ggcG9pbnRzIHdpbGwgYmUgdGhlIGxvd2VyLWxlZnQgY29ybmVyIGFuZCB0aGUgdXBwZXItcmlnaHRcbiAgICogY29ybmVyLlxuICAgKi9cbiAgdmlzaXQoXG4gICAgYWNjZXNzb3I6IChub2RlOiBTUE5vZGUsIGxvd1BvaW50OiBQb2ludCwgaGlnaFBvaW50OiBQb2ludCkgPT4gYm9vbGVhbixcbiAgICBub0JveCA9IGZhbHNlXG4gICkge1xuICAgIHRoaXMudmlzaXROb2RlKHRoaXMucm9vdCwgYWNjZXNzb3IsIG5vQm94KTtcbiAgfVxuICBwcml2YXRlIHZpc2l0Tm9kZShcbiAgICBub2RlOiBTUE5vZGUsXG4gICAgYWNjZXNzb3I6IChub2RlOiBTUE5vZGUsIGxvd1BvaW50PzogUG9pbnQsIGhpZ2hQb2ludD86IFBvaW50KSA9PiBib29sZWFuLFxuICAgIG5vQm94OiBib29sZWFuXG4gICkge1xuICAgIGxldCBza2lwQ2hpbGRyZW46IGJvb2xlYW47XG4gICAgaWYgKG5vQm94KSB7XG4gICAgICBza2lwQ2hpbGRyZW4gPSBhY2Nlc3Nvcihub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGxvd1BvaW50ID0gbmV3IEFycmF5KHRoaXMuZGltKTtcbiAgICAgIGxldCBoaWdoUG9pbnQgPSBuZXcgQXJyYXkodGhpcy5kaW0pO1xuICAgICAgZm9yIChsZXQgZCA9IDA7IGQgPCB0aGlzLmRpbTsgKytkKSB7XG4gICAgICAgIGxvd1BvaW50W2RdID0gbm9kZS5ib3guY2VudGVyW2RdIC0gbm9kZS5ib3guaGFsZkRpbTtcbiAgICAgICAgaGlnaFBvaW50W2RdID0gbm9kZS5ib3guY2VudGVyW2RdICsgbm9kZS5ib3guaGFsZkRpbTtcbiAgICAgIH1cbiAgICAgIHNraXBDaGlsZHJlbiA9IGFjY2Vzc29yKG5vZGUsIGxvd1BvaW50LCBoaWdoUG9pbnQpO1xuICAgIH1cbiAgICBpZiAoIW5vZGUuY2hpbGRyZW4gfHwgc2tpcENoaWxkcmVuKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgbGV0IGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICB0aGlzLnZpc2l0Tm9kZShjaGlsZCwgYWNjZXNzb3IsIG5vQm94KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBpbnNlcnQobm9kZTogU1BOb2RlLCBwOiBQb2ludCkge1xuICAgIC8vIFN1YmRpdmlkZSBhbmQgdGhlbiBhZGQgdGhlIHBvaW50IHRvIHdoaWNoZXZlciBub2RlIHdpbGwgYWNjZXB0IGl0LlxuICAgIGlmIChub2RlLmNoaWxkcmVuID09IG51bGwpIHtcbiAgICAgIG5vZGUuY2hpbGRyZW4gPSBuZXcgQXJyYXkodGhpcy5tYXNrcy5sZW5ndGgpO1xuICAgIH1cbiAgICAvLyBEZWNpZGUgd2hpY2ggY2hpbGQgd2lsbCBnZXQgdGhlIG5ldyBwb2ludCBieSBjb25zdHJ1Y3RpbmcgYSBELWJpdHMgYmluYXJ5XG4gICAgLy8gc2lnbmF0dXJlIChEPTMgZm9yIDNEKSB3aGVyZSB0aGUgay10aCBiaXQgaXMgMSBpZiB0aGUgcG9pbnQncyBrLXRoXG4gICAgLy8gY29vcmRpbmF0ZSBpcyBncmVhdGVyIHRoYW4gdGhlIG5vZGUncyBrLXRoIGNvb3JkaW5hdGUsIDAgb3RoZXJ3aXNlLlxuICAgIC8vIFRoZW4gdGhlIGJpbmFyeSBzaWduYXR1cmUgaW4gZGVjaW1hbCBzeXN0ZW0gZ2l2ZXMgdXMgdGhlIGluZGV4IG9mIHRoZVxuICAgIC8vIGNoaWxkIHdoZXJlIHRoZSBuZXcgcG9pbnQgc2hvdWxkIGJlLlxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIChsZXQgZCA9IDA7IGQgPCB0aGlzLmRpbTsgKytkKSB7XG4gICAgICBpZiAocFtkXSA+IG5vZGUuYm94LmNlbnRlcltkXSkge1xuICAgICAgICBpbmRleCB8PSB0aGlzLm1hc2tzW2RdO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobm9kZS5jaGlsZHJlbltpbmRleF0gPT0gbnVsbCkge1xuICAgICAgdGhpcy5tYWtlQ2hpbGQobm9kZSwgaW5kZXgsIHApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmluc2VydChub2RlLmNoaWxkcmVuW2luZGV4XSwgcCk7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgbWFrZUNoaWxkKG5vZGU6IFNQTm9kZSwgaW5kZXg6IG51bWJlciwgcDogUG9pbnQpOiB2b2lkIHtcbiAgICBsZXQgb2xkQyA9IG5vZGUuYm94LmNlbnRlcjtcbiAgICBsZXQgaCA9IG5vZGUuYm94LmhhbGZEaW0gLyAyO1xuICAgIGxldCBuZXdDOiBQb2ludCA9IG5ldyBBcnJheSh0aGlzLmRpbSk7XG4gICAgZm9yIChsZXQgZCA9IDA7IGQgPCB0aGlzLmRpbTsgKytkKSB7XG4gICAgICBuZXdDW2RdID0gaW5kZXggJiAoMSA8PCBkKSA/IG9sZENbZF0gKyBoIDogb2xkQ1tkXSAtIGg7XG4gICAgfVxuICAgIG5vZGUuY2hpbGRyZW5baW5kZXhdID0ge2JveDoge2NlbnRlcjogbmV3QywgaGFsZkRpbTogaH0sIHBvaW50OiBwfTtcbiAgfVxufVxuZnVuY3Rpb24gZmlsbEFycmF5PFQ+KGFycjogVFtdLCB2YWx1ZTogVCk6IHZvaWQge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xuICAgIGFycltpXSA9IHZhbHVlO1xuICB9XG59XG4iXX0=