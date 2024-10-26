import { useState } from 'react';

export function indexSelect() {
    const [selectedIndex, setSelectedIndex] = useState<number[]>([]);
    const [showModal, setShowModal] = useState(false);

    function deleteItemfromSel(item: any) {
        setSelectedIndex(prevSelectedIndex => {
            const index = prevSelectedIndex.indexOf(item);
            if (index !== -1) {
                // 创建一个新的数组，删除指定的元素
                const newSelectedIndex = [...prevSelectedIndex];
                newSelectedIndex.splice(index, 1);
                return newSelectedIndex;
            }
            return prevSelectedIndex;
        });
    }
    function saveChanges() {
        console.log('保存更改:', selectedIndex);
        setShowModal(true);
    }
    function openModal() {
        setShowModal(true);
    }

    function setShowModalFalse() {
        setShowModal(true);
    }
    return (
        <div>
            <h1>indexSelect</h1>
        </div>
    )
}