import { useState } from "react";


interface Option {
    label: string;
    value: string;
    disabled?: boolean;
}
export function useCheckOptions<T extends string | number | Option>(options: T[] = []) {
    const [checked, setChecked] = useState<string[]>([]);
    return [options, checked, setChecked] as const;
}
