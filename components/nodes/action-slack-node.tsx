import { NodeCard } from "@/components/node-card";
import { actionSlackDataSchema } from "@/lib/node-types";
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

export const ActionSlackNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const parsedData = useMemo(() => actionSlackDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Slack Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  return (
    <NodeCard title="Slack" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <Select
          value={d.operation ?? "post_message"}
          onValueChange={(v) => handleChange({ operation: v })}
        >
          <SelectTrigger className="nodrag">
            <SelectValue placeholder="Operation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="post_message">Post message</SelectItem>
            <SelectItem value="invite_user">Invite user</SelectItem>
            <SelectItem value="create_channel">Create channel</SelectItem>
          </SelectContent>
        </Select>
        {(d.operation === "post_message" || !d.operation) && (
          <>
            <Input
              placeholder="Channel (#general)"
              value={d.channel ?? ""}
              onChange={(e) => handleChange({ channel: e.target.value })}
              className="nodrag"
            />
            <Textarea
              placeholder="Message"
              value={d.message ?? ""}
              onChange={(e) => handleChange({ message: e.target.value })}
              className="nodrag min-h-[60px]"
            />
          </>
        )}
        {d.operation === "invite_user" && (
          <Input
            placeholder="User email"
            value={d.userId ?? ""}
            onChange={(e) => handleChange({ userId: e.target.value })}
            className="nodrag"
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
