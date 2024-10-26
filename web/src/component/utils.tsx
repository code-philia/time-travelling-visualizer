function setColorPickerOpacity(target:any, labelNumber:string, value:any) {
    const colorPickerItem = target.querySelector('#color-picker-item-' + labelNumber);
    if (value) {
        colorPickerItem.style.opacity='1';
        colorPickerItem.style.pointerEvents='auto';
    } else {
        colorPickerItem.style.opacity='0';
        colorPickerItem.style.pointerEvents='none';
    }
}

function translateCssColor(rgbArray:Array<number>):string {
    return '#' + rgbArray.map(c => c.toString(16).padStart(2, '0')).join('');
}

function changeLabelColor(labelNumber:Number, newColor: [number, number, number]):void {
    // const color_list = this.color_list;
    // for (let i = 0; i < color_list.length; ++i) {
    //     if (i === labelNumber) {
    //         this.$set(color_list, i, newColor);
    //     }
    // }
    // this.plotCanvas?.updateColor();
}

function hexToRgbArray(hex:string): [number, number, number]  {
    hex = hex.replace(/^#/, '');
    let bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return [r, g, b];
}
export { setColorPickerOpacity, translateCssColor, changeLabelColor, hexToRgbArray };
