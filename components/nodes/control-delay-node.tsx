import { NodeCard } from "@/components/node-card";
import { controlDelayDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import { ErrorNode } from "./error-node";

export const ControlDelayNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const parsedData = useMemo(() => controlDelayDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Delay Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  return (
    <NodeCard title="Delay" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            placeholder="Minutes"
            value={d.delayMinutes ?? ""}
            onChange={(e) => handleChange({ delayMinutes: e.target.value ? Number(e.target.value) : 0 })}
            className="nodrag w-24"
          />
          <span className="text-muted-foreground">min</span>
          <Input
            type="number"
            min={0}
            placeholder="Hours"
            value={d.delayHours ?? ""}
            onChange={(e) => handleChange({ delayHours: e.target.value ? Number(e.target.value) : 0 })}
            className="nodrag w-24"
          />
          <span className="text-muted-foreground">hr</span>
        </div>
        <p className="text-xs text-muted-foreground">Max 10s in browser for demo.</p>
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
