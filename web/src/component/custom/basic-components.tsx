// TODO put these blocks to a universal file
// TODO add resize/drag/dock-to mouse interaction
export function FunctionalBlock(props: { label?: string; children?: null | React.ReactNode | React.ReactNode[]; }) {
    return (
        <div className="functional-block" style={{ overflow: 'visible' }}>
            {props.label && <div className="functional-block-title">{props.label}</div>}
            {props.children}
        </div>
    );
}
export function ComponentBlock(props: { label?: string; children?: null | React.ReactNode | React.ReactNode[]; }) {
    return (
        <div className="component-block">
            {props.label && <div className="label">{props.label}</div>}
            {props.children}
        </div>
    );
}
