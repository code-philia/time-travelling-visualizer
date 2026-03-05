import { Collapse } from "antd";
import { HolderOutlined } from "@ant-design/icons";

// TODO put these blocks to a universal file
// TODO add resize/drag/dock-to mouse interaction

type FunctionalBlockProps = {
    label?: string;
    children?: React.ReactNode;
    defaultCollapsed?: boolean;
    dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
};

export function FunctionalBlock(props: FunctionalBlockProps) {
    if (!props.label) return <div className="functional-block" style={{ overflow: "visible" }}>{props.children}</div>;

    const header = (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            {props.dragHandleProps && (
                <span
                    {...props.dragHandleProps}
                    style={{ cursor: "grab", color: "#aaa", fontSize: 12, lineHeight: 1 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <HolderOutlined />
                </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{props.label}</span>
        </div>
    );

    return (
        <div className="functional-block" style={{ overflow: "visible" }}>
            <Collapse
                size="small"
                defaultActiveKey={props.defaultCollapsed ? [] : ["block"]}
                items={[{ key: "block", label: header, children: props.children }]}
            />
        </div>
    );
}

export function ComponentBlock(props: { label?: string; children?: React.ReactNode }) {
    return (
        <div className="component-block">
            {props.label && <div className="label">{props.label}</div>}
            {props.children}
        </div>
    );
}
