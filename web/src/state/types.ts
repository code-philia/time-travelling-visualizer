export class SelectedListener{
    selectedIndices: Set<number> = new Set();
    private highlightChangedListeners: (() => void)[] = [];

    constructor() {
        this.selectedIndices = new Set();
    }

    setSelected(indices: number[]) {
        this.selectedIndices = new Set(indices);
    }

    addSelected(idx: number) {
        this.selectedIndices.add(idx);
        this.notifyHighlightChanged();
    }

    removeSelected(idx: number) {
        this.selectedIndices.delete(idx);
        this.notifyHighlightChanged();
    }

    switchSelected(idx: number) {
        if (this.selectedIndices.has(idx)) {
            this.selectedIndices.delete(idx);
        } else {
            this.selectedIndices.add(idx);
        }
        this.notifyHighlightChanged();
    }

    clearSelected() {
        this.selectedIndices.clear();
        this.notifyHighlightChanged();
    }

    checkSelected(idx: number) {
        return this.selectedIndices.has(idx);
    }

    addHighlightChangedListener(listener: () => void) {
        this.highlightChangedListeners.push(listener);
    }

    removeHighlightChangedListener(listener: () => void) {
        this.highlightChangedListeners = this.highlightChangedListeners.filter((l) => l !== listener);
    }

    private notifyHighlightChanged() {
        this.highlightChangedListeners.forEach((listener) => listener());
    }
}