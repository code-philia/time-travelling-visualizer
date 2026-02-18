import { Collapse } from "antd";
import { HolderOutlined } from "@ant-design/icons";

type FunctionalBlockProps = {
    label?: string;
    children?: React.ReactNode;
    defaultCollapsed?: boolean;
    dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
};

export function FunctionalBlock({ label, children, defaultCollapsed, dragHandleProps }: FunctionalBlockProps) {
    if (!label) return <div className="functional-block" style={{ overflow: "visible" }}>{children}</div>;

    const header = (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            {dragHandleProps && (
                <span
                    {...dragHandleProps}
                    style={{ cursor: "grab", color: "#aaa", fontSize: 12, lineHeight: 1 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <HolderOutlined />
                </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{label}</span>
        </div>
    );

    return (
        <div className="functional-block" style={{ overflow: "visible" }}>
            <Collapse
                size="small"
                defaultActiveKey={defaultCollapsed ? [] : ["block"]}
                items={[{ key: "block", label: header, children }]}
            />
        </div>
    );
}

export function ComponentBlock({ label, children }: { label?: string; children?: React.ReactNode }) {
    return (
        <div className="component-block">
            {label && <div className="label">{label}</div>}
            {children}
        </div>
    );
}
