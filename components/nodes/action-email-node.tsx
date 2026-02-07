import { NodeCard } from "@/components/node-card";
import { actionEmailDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { ErrorNode } from "./error-node";

export const ActionEmailNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const parsedData = useMemo(() => actionEmailDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Email Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  return (
    <NodeCard title="Send Email" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <Select value={d.service ?? "SendGrid"} onValueChange={(v) => handleChange({ service: v })}>
          <SelectTrigger className="nodrag">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SendGrid">SendGrid</SelectItem>
            <SelectItem value="Gmail">Gmail</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="To (email)"
          value={d.to ?? ""}
          onChange={(e) => handleChange({ to: e.target.value })}
          className="nodrag"
        />
        <Input
          placeholder="Subject"
          value={d.subject ?? ""}
          onChange={(e) => handleChange({ subject: e.target.value })}
          className="nodrag"
        />
        <Textarea
          placeholder="Body"
          value={d.body ?? ""}
          onChange={(e) => handleChange({ body: e.target.value })}
          className="nodrag min-h-[60px]"
        />
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
