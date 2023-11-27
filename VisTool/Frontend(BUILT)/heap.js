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
        define("org_tensorflow_tensorboard/tensorboard/projector/heap", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Min-heap data structure. Provides O(1) for peek, returning the smallest key.
     */
    // TODO(@jart): Rename to Heap and use Comparator.
    class MinHeap {
        constructor() {
            this.arr = [];
        }
        /** Push an element with the provided key. */
        push(key, value) {
            this.arr.push({ key, value });
            this.bubbleUp(this.arr.length - 1);
        }
        /** Pop the element with the smallest key. */
        pop() {
            if (this.arr.length === 0) {
                throw new Error('pop() called on empty binary heap');
            }
            let item = this.arr[0];
            let last = this.arr.length - 1;
            this.arr[0] = this.arr[last];
            this.arr.pop();
            if (last > 0) {
                this.bubbleDown(0);
            }
            return item;
        }
        /** Returns, but doesn't remove the element with the smallest key */
        peek() {
            return this.arr[0];
        }
        /**
         * Pops the element with the smallest key and at the same time
         * adds the newly provided element. This is faster than calling
         * pop() and push() separately.
         */
        popPush(key, value) {
            if (this.arr.length === 0) {
                throw new Error('pop() called on empty binary heap');
            }
            let item = this.arr[0];
            this.arr[0] = { key, value };
            if (this.arr.length > 0) {
                this.bubbleDown(0);
            }
            return item;
        }
        /** Returns the number of elements in the heap. */
        size() {
            return this.arr.length;
        }
        /** Returns all the items in the heap. */
        items() {
            return this.arr;
        }
        swap(a, b) {
            let temp = this.arr[a];
            this.arr[a] = this.arr[b];
            this.arr[b] = temp;
        }
        bubbleDown(pos) {
            let left = (pos << 1) + 1;
            let right = left + 1;
            let largest = pos;
            if (left < this.arr.length && this.arr[left].key < this.arr[largest].key) {
                largest = left;
            }
            if (right < this.arr.length &&
                this.arr[right].key < this.arr[largest].key) {
                largest = right;
            }
            if (largest !== pos) {
                this.swap(largest, pos);
                this.bubbleDown(largest);
            }
        }
        bubbleUp(pos) {
            if (pos <= 0) {
                return;
            }
            let parent = (pos - 1) >> 1;
            if (this.arr[pos].key < this.arr[parent].key) {
                this.swap(pos, parent);
                this.bubbleUp(parent);
            }
        }
    }
    exports.MinHeap = MinHeap;
    /** List that keeps the K elements with the smallest keys. */
    class KMin {
        /** Constructs a new k-min data structure with the provided k. */
        constructor(k) {
            this.maxHeap = new MinHeap();
            this.k = k;
        }
        /** Adds an element to the list. */
        add(key, value) {
            if (this.maxHeap.size() < this.k) {
                this.maxHeap.push(-key, value);
                return;
            }
            let largest = this.maxHeap.peek();
            // If the new element is smaller, replace the largest with the new element.
            if (key < -largest.key) {
                this.maxHeap.popPush(-key, value);
            }
        }
        /** Returns the k items with the smallest keys. */
        getMinKItems() {
            let items = this.maxHeap.items();
            items.sort((a, b) => b.key - a.key);
            return items.map((a) => a.value);
        }
        /** Returns the size of the list. */
        getSize() {
            return this.maxHeap.size();
        }
        /** Returns the largest key in the list. */
        getLargestKey() {
            return this.maxHeap.size() === 0 ? null : -this.maxHeap.peek().key;
        }
    }
    exports.KMin = KMin;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVhcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3RlbnNvcmJvYXJkL3Byb2plY3Rvci9oZWFwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O2dGQWFnRjs7Ozs7Ozs7Ozs7O0lBTWhGOztPQUVHO0lBQ0gsa0RBQWtEO0lBQ2xELE1BQWEsT0FBTztRQUFwQjtZQUNVLFFBQUcsR0FBa0IsRUFBRSxDQUFDO1FBaUZsQyxDQUFDO1FBaEZDLDZDQUE2QztRQUM3QyxJQUFJLENBQUMsR0FBVyxFQUFFLEtBQVE7WUFDeEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFDRCw2Q0FBNkM7UUFDN0MsR0FBRztZQUNELElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7YUFDdEQ7WUFDRCxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUMvQixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNmLElBQUksSUFBSSxHQUFHLENBQUMsRUFBRTtnQkFDWixJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3BCO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFD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LElBQUksRUFBRSxDQUFDO1FBQzdCLENBQUM7UUFDRCwyQ0FBMkM7UUFDM0MsYUFBYTtZQUNYLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQztRQUNyRSxDQUFDO0tBQ0Y7SUFqQ0Qsb0JBaUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyogQ29weXJpZ2h0IDIwMTYgVGhlIFRlbnNvckZsb3cgQXV0aG9ycy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5leHBvcnQgdHlwZSBIZWFwSXRlbTxUPiA9IHtcbiAga2V5OiBudW1iZXI7XG4gIHZhbHVlOiBUO1xufTtcbi8qKlxuICogTWluLWhlYXAgZGF0YSBzdHJ1Y3R1cmUuIFByb3ZpZGVzIE8oMSkgZm9yIHBlZWssIHJldHVybmluZyB0aGUgc21hbGxlc3Qga2V5LlxuICovXG4vLyBUT0RPKEBqYXJ0KTogUmVuYW1lIHRvIEhlYXAgYW5kIHVzZSBDb21wYXJhdG9yLlxuZXhwb3J0IGNsYXNzIE1pbkhlYXA8VD4ge1xuICBwcml2YXRlIGFycjogSGVhcEl0ZW08VD5bXSA9IFtdO1xuICAvKiogUHVzaCBhbiBlbGVtZW50IHdpdGggdGhlIHByb3ZpZGVkIGtleS4gKi9cbiAgcHVzaChrZXk6IG51bWJlciwgdmFsdWU6IFQpOiB2b2lkIHtcbiAgICB0aGlzLmFyci5wdXNoKHtrZXksIHZhbHVlfSk7XG4gICAgdGhpcy5idWJibGVVcCh0aGlzLmFyci5sZW5ndGggLSAxKTtcbiAgfVxuICAvKiogUG9wIHRoZSBlbGVtZW50IHdpdGggdGhlIHNtYWxsZXN0IGtleS4gKi9cbiAgcG9wKCk6IEhlYXBJdGVtPFQ+IHtcbiAgICBpZiAodGhpcy5hcnIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvcCgpIGNhbGxlZCBvbiBlbXB0eSBiaW5hcnkgaGVhcCcpO1xuICAgIH1cbiAgICBsZXQgaXRlbSA9IHRoaXMuYXJyWzBdO1xuICAgIGxldCBsYXN0ID0gdGhpcy5hcnIubGVuZ3RoIC0gMTtcbiAgICB0aGlzLmFyclswXSA9IHRoaXMuYXJyW2xhc3RdO1xuICAgIHRoaXMuYXJyLnBvcCgpO1xuICAgIGlmIChsYXN0ID4gMCkge1xuICAgICAgdGhpcy5idWJibGVEb3duKDApO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICAvKiogUmV0dXJucywgYnV0IGRvZXNuJ3QgcmVtb3ZlIHRoZSBlbGVtZW50IHdpdGggdGhlIHNtYWxsZXN0IGtleSAqL1xuICBwZWVrKCk6IEhlYXBJdGVtPFQ+IHtcbiAgICByZXR1cm4gdGhpcy5hcnJbMF07XG4gIH1cbiAgLyoqXG4gICAqIFBvcHMgdGhlIGVsZW1lbnQgd2l0aCB0aGUgc21hbGxlc3Qga2V5IGFuZCBhdCB0aGUgc2FtZSB0aW1lXG4gICAqIGFkZHMgdGhlIG5ld2x5IHByb3ZpZGVkIGVsZW1lbnQuIFRoaXMgaXMgZmFzdGVyIHRoYW4gY2FsbGluZ1xuICAgKiBwb3AoKSBhbmQgcHVzaCgpIHNlcGFyYXRlbHkuXG4gICAqL1xuICBwb3BQdXNoKGtleTogbnVtYmVyLCB2YWx1ZTogVCk6IEhlYXBJdGVtPFQ+IHtcbiAgICBpZiAodGhpcy5hcnIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvcCgpIGNhbGxlZCBvbiBlbXB0eSBiaW5hcnkgaGVhcCcpO1xuICAgIH1cbiAgICBsZXQgaXRlbSA9IHRoaXMuYXJyWzBdO1xuICAgIHRoaXMuYXJyWzBdID0ge2tleSwgdmFsdWV9O1xuICAgIGlmICh0aGlzLmFyci5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmJ1YmJsZURvd24oMCk7XG4gICAgfVxuICAgIHJldHVybiBpdGVtO1xuICB9XG4gIC8qKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gdGhlIGhlYXAuICovXG4gIHNpemUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5hcnIubGVuZ3RoO1xuICB9XG4gIC8qKiBSZXR1cm5zIGFsbCB0aGUgaXRlbXMgaW4gdGhlIGhlYXAuICovXG4gIGl0ZW1zKCk6IEhlYXBJdGVtPFQ+W10ge1xuICAgIHJldHVybiB0aGlzLmFycjtcbiAgfVxuICBwcml2YXRlIHN3YXAoYTogbnVtYmVyLCBiOiBudW1iZXIpIHtcbiAgICBsZXQgdGVtcCA9IHRoaXMuYXJyW2FdO1xuICAgIHRoaXMuYXJyW2FdID0gdGhpcy5hcnJbYl07XG4gICAgdGhpcy5hcnJbYl0gPSB0ZW1wO1xuICB9XG4gIHByaXZhdGUgYnViYmxlRG93bihwb3M6IG51bWJlcikge1xuICAgIGxldCBsZWZ0ID0gKHBvcyA8PCAxKSArIDE7XG4gICAgbGV0IHJpZ2h0ID0gbGVmdCArIDE7XG4gICAgbGV0IGxhcmdlc3QgPSBwb3M7XG4gICAgaWYgKGxlZnQgPCB0aGlzLmFyci5sZW5ndGggJiYgdGhpcy5hcnJbbGVmdF0ua2V5IDwgdGhpcy5hcnJbbGFyZ2VzdF0ua2V5KSB7XG4gICAgICBsYXJnZXN0ID0gbGVmdDtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgcmlnaHQgPCB0aGlzLmFyci5sZW5ndGggJiZcbiAgICAgIHRoaXMuYXJyW3JpZ2h0XS5rZXkgPCB0aGlzLmFycltsYXJnZXN0XS5rZXlcbiAgICApIHtcbiAgICAgIGxhcmdlc3QgPSByaWdodDtcbiAgICB9XG4gICAgaWYgKGxhcmdlc3QgIT09IHBvcykge1xuICAgICAgdGhpcy5zd2FwKGxhcmdlc3QsIHBvcyk7XG4gICAgICB0aGlzLmJ1YmJsZURvd24obGFyZ2VzdCk7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgYnViYmxlVXAocG9zOiBudW1iZXIpIHtcbiAgICBpZiAocG9zIDw9IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHBhcmVudCA9IChwb3MgLSAxKSA+PiAxO1xuICAgIGlmICh0aGlzLmFycltwb3NdLmtleSA8IHRoaXMuYXJyW3BhcmVudF0ua2V5KSB7XG4gICAgICB0aGlzLnN3YXAocG9zLCBwYXJlbnQpO1xuICAgICAgdGhpcy5idWJibGVVcChwYXJlbnQpO1xuICAgIH1cbiAgfVxufVxuLyoqIExpc3QgdGhhdCBrZWVwcyB0aGUgSyBlbGVtZW50cyB3aXRoIHRoZSBzbWFsbGVzdCBrZXlzLiAqL1xuZXhwb3J0IGNsYXNzIEtNaW48VD4ge1xuICBwcml2YXRlIGs6IG51bWJlcjtcbiAgcHJpdmF0ZSBtYXhIZWFwID0gbmV3IE1pbkhlYXA8VD4oKTtcbiAgLyoqIENvbnN0cnVjdHMgYSBuZXcgay1taW4gZGF0YSBzdHJ1Y3R1cmUgd2l0aCB0aGUgcHJvdmlkZWQgay4gKi9cbiAgY29uc3RydWN0b3IoazogbnVtYmVyKSB7XG4gICAgdGhpcy5rID0gaztcbiAgfVxuICAvKiogQWRkcyBhbiBlbGVtZW50IHRvIHRoZSBsaXN0LiAqL1xuICBhZGQoa2V5OiBudW1iZXIsIHZhbHVlOiBUKSB7XG4gICAgaWYgKHRoaXMubWF4SGVhcC5zaXplKCkgPCB0aGlzLmspIHtcbiAgICAgIHRoaXMubWF4SGVhcC5wdXNoKC1rZXksIHZhbHVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IGxhcmdlc3QgPSB0aGlzLm1heEhlYXAucGVlaygpO1xuICAgIC8vIElmIHRoZSBuZXcgZWxlbWVudCBpcyBzbWFsbGVyLCByZXBsYWNlIHRoZSBsYXJnZXN0IHdpdGggdGhlIG5ldyBlbGVtZW50LlxuICAgIGlmIChrZXkgPCAtbGFyZ2VzdC5rZXkpIHtcbiAgICAgIHRoaXMubWF4SGVhcC5wb3BQdXNoKC1rZXksIHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgLyoqIFJldHVybnMgdGhlIGsgaXRlbXMgd2l0aCB0aGUgc21hbGxlc3Qga2V5cy4gKi9cbiAgZ2V0TWluS0l0ZW1zKCk6IFRbXSB7XG4gICAgbGV0IGl0ZW1zID0gdGhpcy5tYXhIZWFwLml0ZW1zKCk7XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4gYi5rZXkgLSBhLmtleSk7XG4gICAgcmV0dXJuIGl0ZW1zLm1hcCgoYSkgPT4gYS52YWx1ZSk7XG4gIH1cbiAgLyoqIFJldHVybnMgdGhlIHNpemUgb2YgdGhlIGxpc3QuICovXG4gIGdldFNpemUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5tYXhIZWFwLnNpemUoKTtcbiAgfVxuICAvKiogUmV0dXJucyB0aGUgbGFyZ2VzdCBrZXkgaW4gdGhlIGxpc3QuICovXG4gIGdldExhcmdlc3RLZXkoKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubWF4SGVhcC5zaXplKCkgPT09IDAgPyBudWxsIDogLXRoaXMubWF4SGVhcC5wZWVrKCkua2V5O1xuICB9XG59XG4iXX0=