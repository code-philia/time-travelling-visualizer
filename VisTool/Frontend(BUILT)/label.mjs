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
/**
 * Accelerates label placement by dividing the view into a uniform grid.
 * Labels only need to be tested for collision with other labels that overlap
 * the same grid cells. This is a fork of {@code amoeba.CollisionGrid}.
 */
export class CollisionGrid {
    /**
     * Constructs a new Collision grid.
     *
     * @param bound The bound of the grid. Labels out of bounds will be rejected.
     * @param cellWidth Width of a cell in the grid.
     * @param cellHeight Height of a cell in the grid.
     */
    constructor(bound, cellWidth, cellHeight) {
        /** The bound of the grid. Labels out of bounds will be rejected. */
        this.bound = bound;
        /** Width of a cell in the grid. */
        this.cellWidth = cellWidth;
        /** Height of a cell in the grid. */
        this.cellHeight = cellHeight;
        /** Number of grid cells along the x axis. */
        this.numHorizCells = Math.ceil(this.boundWidth(bound) / cellWidth);
        /** Number of grid cells along the y axis. */
        this.numVertCells = Math.ceil(this.boundHeight(bound) / cellHeight);
        /**
         * The 2d grid (stored as a 1d array.) Each cell consists of an array of
         * BoundingBoxes for objects that are in the cell.
         */
        this.grid = new Array(this.numHorizCells * this.numVertCells);
    }
    boundWidth(bound) {
        return bound.hiX - bound.loX;
    }
    boundHeight(bound) {
        return bound.hiY - bound.loY;
    }
    boundsIntersect(a, b) {
        return !(a.loX > b.hiX || a.loY > b.hiY || a.hiX < b.loX || a.hiY < b.loY);
    }
    /**
     * Checks if a given bounding box has any conflicts in the grid and inserts it
     * if none are found.
     *
     * @param bound The bound to insert.
     * @param justTest If true, just test if it conflicts, without inserting.
     * @return True if the bound was successfully inserted; false if it
     *         could not be inserted due to a conflict.
     */
    insert(bound, justTest = false) {
        // Reject if the label is out of bounds.
        if (bound.hiX < this.bound.loX ||
            bound.loX > this.bound.hiX ||
            bound.hiY < this.bound.loY ||
            bound.loY > this.bound.hiY) {
            return false;
        }
        let minCellX = this.getCellX(bound.loX);
        let maxCellX = this.getCellX(bound.hiX);
        let minCellY = this.getCellY(bound.loY);
        let maxCellY = this.getCellY(bound.hiY);
        // Check all overlapped cells to verify that we can insert.
        let baseIdx = minCellY * this.numHorizCells + minCellX;
        let idx = baseIdx;
        for (let j = minCellY; j <= maxCellY; j++) {
            for (let i = minCellX; i <= maxCellX; i++) {
                let cell = this.grid[idx++];
                if (cell) {
                    for (let k = 0; k < cell.length; k++) {
                        if (this.boundsIntersect(bound, cell[k])) {
                            return false;
                        }
                    }
                }
            }
            idx += this.numHorizCells - (maxCellX - minCellX + 1);
        }
        if (justTest) {
            return true;
        }
        // Insert into the overlapped cells.
        idx = baseIdx;
        for (let j = minCellY; j <= maxCellY; j++) {
            for (let i = minCellX; i <= maxCellX; i++) {
                if (!this.grid[idx]) {
                    this.grid[idx] = [bound];
                }
                else {
                    this.grid[idx].push(bound);
                }
                idx++;
            }
            idx += this.numHorizCells - (maxCellX - minCellX + 1);
        }
        return true;
    }
    /**
     * Returns the x index of the grid cell where the given x coordinate falls.
     *
     * @param x the coordinate, in world space.
     * @return the x index of the cell.
     */
    getCellX(x) {
        return Math.floor((x - this.bound.loX) / this.cellWidth);
    }
    /**
     * Returns the y index of the grid cell where the given y coordinate falls.
     *
     * @param y the coordinate, in world space.
     * @return the y index of the cell.
     */
    getCellY(y) {
        return Math.floor((y - this.bound.loY) / this.cellHeight);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZW5zb3Jib2FyZC9wcm9qZWN0b3IvbGFiZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Z0ZBYWdGO0FBUWhGOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sYUFBYTtJQU94Qjs7Ozs7O09BTUc7SUFDSCxZQUFZLEtBQWtCLEVBQUUsU0FBaUIsRUFBRSxVQUFrQjtRQUNuRSxvRUFBb0U7UUFDcEUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQzNCLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUM3Qiw2Q0FBNkM7UUFDN0MsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUM7UUFDbkUsNkNBQTZDO1FBQzdDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDO1FBQ3BFOzs7V0FHRztRQUNILElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUNPLFVBQVUsQ0FBQyxLQUFrQjtRQUNuQyxPQUFPLEtBQUssQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUMvQixDQUFDO0lBQ08sV0FBVyxDQUFDLEtBQWtCO1FBQ3BDLE9BQU8sS0FBSyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQy9CLENBQUM7SUFDTyxlQUFlLENBQUMsQ0FB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Q0FBQyxDQUFDO2lCQUM1QjtnQkFDRCxHQUFHLEVBQUUsQ0FBQzthQUNQO1lBQ0QsR0FBRyxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxRQUFRLEdBQUcsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ3ZEO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0Q7Ozs7O09BS0c7SUFDSyxRQUFRLENBQUMsQ0FBUztRQUN4QixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUNEOzs7OztPQUtHO0lBQ0ssUUFBUSxDQUFDLENBQVM7UUFDeEIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuZXhwb3J0IGludGVyZmFjZSBCb3VuZGluZ0JveCB7XG4gIGxvWDogbnVtYmVyO1xuICBsb1k6IG51bWJlcjtcbiAgaGlYOiBudW1iZXI7XG4gIGhpWTogbnVtYmVyO1xufVxuLyoqXG4gKiBBY2NlbGVyYXRlcyBsYWJlbCBwbGFjZW1lbnQgYnkgZGl2aWRpbmcgdGhlIHZpZXcgaW50byBhIHVuaWZvcm0gZ3JpZC5cbiAqIExhYmVscyBvbmx5IG5lZWQgdG8gYmUgdGVzdGVkIGZvciBjb2xsaXNpb24gd2l0aCBvdGhlciBsYWJlbHMgdGhhdCBvdmVybGFwXG4gKiB0aGUgc2FtZSBncmlkIGNlbGxzLiBUaGlzIGlzIGEgZm9yayBvZiB7QGNvZGUgYW1vZWJhLkNvbGxpc2lvbkdyaWR9LlxuICovXG5leHBvcnQgY2xhc3MgQ29sbGlzaW9uR3JpZCB7XG4gIHByaXZhdGUgbnVtSG9yaXpDZWxsczogbnVtYmVyO1xuICBwcml2YXRlIG51bVZlcnRDZWxsczogbnVtYmVyO1xuICBwcml2YXRlIGdyaWQ6IEJvdW5kaW5nQm94W11bXTtcbiAgcHJpdmF0ZSBib3VuZDogQm91bmRpbmdCb3g7XG4gIHByaXZhdGUgY2VsbFdpZHRoOiBudW1iZXI7XG4gIHByaXZhdGUgY2VsbEhlaWdodDogbnVtYmVyO1xuICAvKipcbiAgICogQ29uc3RydWN0cyBhIG5ldyBDb2xsaXNpb24gZ3JpZC5cbiAgICpcbiAgICogQHBhcmFtIGJvdW5kIFRoZSBib3VuZCBvZiB0aGUgZ3JpZC4gTGFiZWxzIG91dCBvZiBib3VuZHMgd2lsbCBiZSByZWplY3RlZC5cbiAgICogQHBhcmFtIGNlbGxXaWR0aCBXaWR0aCBvZiBhIGNlbGwgaW4gdGhlIGdyaWQuXG4gICAqIEBwYXJhbSBjZWxsSGVpZ2h0IEhlaWdodCBvZiBhIGNlbGwgaW4gdGhlIGdyaWQuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihib3VuZDogQm91bmRpbmdCb3gsIGNlbGxXaWR0aDogbnVtYmVyLCBjZWxsSGVpZ2h0OiBudW1iZXIpIHtcbiAgICAvKiogVGhlIGJvdW5kIG9mIHRoZSBncmlkLiBMYWJlbHMgb3V0IG9mIGJvdW5kcyB3aWxsIGJlIHJlamVjdGVkLiAqL1xuICAgIHRoaXMuYm91bmQgPSBib3VuZDtcbiAgICAvKiogV2lkdGggb2YgYSBjZWxsIGluIHRoZSBncmlkLiAqL1xuICAgIHRoaXMuY2VsbFdpZHRoID0gY2VsbFdpZHRoO1xuICAgIC8qKiBIZWlnaHQgb2YgYSBjZWxsIGluIHRoZSBncmlkLiAqL1xuICAgIHRoaXMuY2VsbEhlaWdodCA9IGNlbGxIZWlnaHQ7XG4gICAgLyoqIE51bWJlciBvZiBncmlkIGNlbGxzIGFsb25nIHRoZSB4IGF4aXMuICovXG4gICAgdGhpcy5udW1Ib3JpekNlbGxzID0gTWF0aC5jZWlsKHRoaXMuYm91bmRXaWR0aChib3VuZCkgLyBjZWxsV2lkdGgpO1xuICAgIC8qKiBOdW1iZXIgb2YgZ3JpZCBjZWxscyBhbG9uZyB0aGUgeSBheGlzLiAqL1xuICAgIHRoaXMubnVtVmVydENlbGxzID0gTWF0aC5jZWlsKHRoaXMuYm91bmRIZWlnaHQoYm91bmQpIC8gY2VsbEhlaWdodCk7XG4gICAgLyoqXG4gICAgICogVGhlIDJkIGdyaWQgKHN0b3JlZCBhcyBhIDFkIGFycmF5LikgRWFjaCBjZWxsIGNvbnNpc3RzIG9mIGFuIGFycmF5IG9mXG4gICAgICogQm91bmRpbmdCb3hlcyBmb3Igb2JqZWN0cyB0aGF0IGFyZSBpbiB0aGUgY2VsbC5cbiAgICAgKi9cbiAgICB0aGlzLmdyaWQgPSBuZXcgQXJyYXkodGhpcy5udW1Ib3JpekNlbGxzICogdGhpcy5udW1WZXJ0Q2VsbHMpO1xuICB9XG4gIHByaXZhdGUgYm91bmRXaWR0aChib3VuZDogQm91bmRpbmdCb3gpIHtcbiAgICByZXR1cm4gYm91bmQuaGlYIC0gYm91bmQubG9YO1xuICB9XG4gIHByaXZhdGUgYm91bmRIZWlnaHQoYm91bmQ6IEJvdW5kaW5nQm94KSB7XG4gICAgcmV0dXJuIGJvdW5kLmhpWSAtIGJvdW5kLmxvWTtcbiAgfVxuICBwcml2YXRlIGJvdW5kc0ludGVyc2VjdChhOiBCb3VuZGluZ0JveCwgYjogQm91bmRpbmdCb3gpIHtcbiAgICByZXR1cm4gIShhLmxvWCA+IGIuaGlYIHx8IGEubG9ZID4gYi5oaVkgfHwgYS5oaVggPCBiLmxvWCB8fCBhLmhpWSA8IGIubG9ZKTtcbiAgfVxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gYm91bmRpbmcgYm94IGhhcyBhbnkgY29uZmxpY3RzIGluIHRoZSBncmlkIGFuZCBpbnNlcnRzIGl0XG4gICAqIGlmIG5vbmUgYXJlIGZvdW5kLlxuICAgKlxuICAgKiBAcGFyYW0gYm91bmQgVGhlIGJvdW5kIHRvIGluc2VydC5cbiAgICogQHBhcmFtIGp1c3RUZXN0IElmIHRydWUsIGp1c3QgdGVzdCBpZiBpdCBjb25mbGljdHMsIHdpdGhvdXQgaW5zZXJ0aW5nLlxuICAgKiBAcmV0dXJuIFRydWUgaWYgdGhlIGJvdW5kIHdhcyBzdWNjZXNzZnVsbHkgaW5zZXJ0ZWQ7IGZhbHNlIGlmIGl0XG4gICAqICAgICAgICAgY291bGQgbm90IGJlIGluc2VydGVkIGR1ZSB0byBhIGNvbmZsaWN0LlxuICAgKi9cbiAgaW5zZXJ0KGJvdW5kOiBCb3VuZGluZ0JveCwganVzdFRlc3QgPSBmYWxzZSk6IGJvb2xlYW4ge1xuICAgIC8vIFJlamVjdCBpZiB0aGUgbGFiZWwgaXMgb3V0IG9mIGJvdW5kcy5cbiAgICBpZiAoXG4gICAgICBib3VuZC5oaVggPCB0aGlzLmJvdW5kLmxvWCB8fFxuICAgICAgYm91bmQubG9YID4gdGhpcy5ib3VuZC5oaVggfHxcbiAgICAgIGJvdW5kLmhpWSA8IHRoaXMuYm91bmQubG9ZIHx8XG4gICAgICBib3VuZC5sb1kgPiB0aGlzLmJvdW5kLmhpWVxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBsZXQgbWluQ2VsbFggPSB0aGlzLmdldENlbGxYKGJvdW5kLmxvWCk7XG4gICAgbGV0IG1heENlbGxYID0gdGhpcy5nZXRDZWxsWChib3VuZC5oaVgpO1xuICAgIGxldCBtaW5DZWxsWSA9IHRoaXMuZ2V0Q2VsbFkoYm91bmQubG9ZKTtcbiAgICBsZXQgbWF4Q2VsbFkgPSB0aGlzLmdldENlbGxZKGJvdW5kLmhpWSk7XG4gICAgLy8gQ2hlY2sgYWxsIG92ZXJsYXBwZWQgY2VsbHMgdG8gdmVyaWZ5IHRoYXQgd2UgY2FuIGluc2VydC5cbiAgICBsZXQgYmFzZUlkeCA9IG1pbkNlbGxZICogdGhpcy5udW1Ib3JpekNlbGxzICsgbWluQ2VsbFg7XG4gICAgbGV0IGlkeCA9IGJhc2VJZHg7XG4gICAgZm9yIChsZXQgaiA9IG1pbkNlbGxZOyBqIDw9IG1heENlbGxZOyBqKyspIHtcbiAgICAgIGZvciAobGV0IGkgPSBtaW5DZWxsWDsgaSA8PSBtYXhDZWxsWDsgaSsrKSB7XG4gICAgICAgIGxldCBjZWxsID0gdGhpcy5ncmlkW2lkeCsrXTtcbiAgICAgICAgaWYgKGNlbGwpIHtcbiAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGNlbGwubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJvdW5kc0ludGVyc2VjdChib3VuZCwgY2VsbFtrXSkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWR4ICs9IHRoaXMubnVtSG9yaXpDZWxscyAtIChtYXhDZWxsWCAtIG1pbkNlbGxYICsgMSk7XG4gICAgfVxuICAgIGlmIChqdXN0VGVzdCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIC8vIEluc2VydCBpbnRvIHRoZSBvdmVybGFwcGVkIGNlbGxzLlxuICAgIGlkeCA9IGJhc2VJZHg7XG4gICAgZm9yIChsZXQgaiA9IG1pbkNlbGxZOyBqIDw9IG1heENlbGxZOyBqKyspIHtcbiAgICAgIGZvciAobGV0IGkgPSBtaW5DZWxsWDsgaSA8PSBtYXhDZWxsWDsgaSsrKSB7XG4gICAgICAgIGlmICghdGhpcy5ncmlkW2lkeF0pIHtcbiAgICAgICAgICB0aGlzLmdyaWRbaWR4XSA9IFtib3VuZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5ncmlkW2lkeF0ucHVzaChib3VuZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWR4Kys7XG4gICAgICB9XG4gICAgICBpZHggKz0gdGhpcy5udW1Ib3JpekNlbGxzIC0gKG1heENlbGxYIC0gbWluQ2VsbFggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHggaW5kZXggb2YgdGhlIGdyaWQgY2VsbCB3aGVyZSB0aGUgZ2l2ZW4geCBjb29yZGluYXRlIGZhbGxzLlxuICAgKlxuICAgKiBAcGFyYW0geCB0aGUgY29vcmRpbmF0ZSwgaW4gd29ybGQgc3BhY2UuXG4gICAqIEByZXR1cm4gdGhlIHggaW5kZXggb2YgdGhlIGNlbGwuXG4gICAqL1xuICBwcml2YXRlIGdldENlbGxYKHg6IG51bWJlcikge1xuICAgIHJldHVybiBNYXRoLmZsb29yKCh4IC0gdGhpcy5ib3VuZC5sb1gpIC8gdGhpcy5jZWxsV2lkdGgpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB5IGluZGV4IG9mIHRoZSBncmlkIGNlbGwgd2hlcmUgdGhlIGdpdmVuIHkgY29vcmRpbmF0ZSBmYWxscy5cbiAgICpcbiAgICogQHBhcmFtIHkgdGhlIGNvb3JkaW5hdGUsIGluIHdvcmxkIHNwYWNlLlxuICAgKiBAcmV0dXJuIHRoZSB5IGluZGV4IG9mIHRoZSBjZWxsLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRDZWxsWSh5OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5mbG9vcigoeSAtIHRoaXMuYm91bmQubG9ZKSAvIHRoaXMuY2VsbEhlaWdodCk7XG4gIH1cbn1cbiJdfQ==