import { NodeCard } from "@/components/node-card";
import { actionSlackDataSchema, type ActionSlackPostItem } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { RiAddLine, RiDeleteBin2Line } from "@remixicon/react";
import { useCallback, useMemo } from "react";
import { Button } from "../ui/button";
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
  const items = Array.isArray(d.items) ? (d.items as ActionSlackPostItem[]) : [];
  const isPostMessage = d.operation === "post_message" || !d.operation;
  const useItemsUi = isPostMessage && items.length > 0;

  const updateItem = useCallback(
    (index: number, updates: Partial<ActionSlackPostItem>) => {
      const next = items.map((item, i) => (i === index ? { ...item, ...updates } : item));
      handleChange({ items: next });
    },
    [items, handleChange]
  );
  const removeItem = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      handleChange({ items: next.length > 0 ? next : undefined });
    },
    [items, handleChange]
  );
  const addItem = useCallback(() => {
    handleChange({
      items: [...items, { label: "", channel: "#general", message: "" }],
    });
  }, [items, handleChange]);

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
            <SelectItem value="invite_to_channel">Invite to channel</SelectItem>
            <SelectItem value="channel_history">Read channel history</SelectItem>
            <SelectItem value="list_channels">List channels</SelectItem>
            <SelectItem value="reaction">Add reaction</SelectItem>
          </SelectContent>
        </Select>
        {isPostMessage && useItemsUi && (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-md border p-2 space-y-1.5">
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Label (e.g. Launch notification)"
                    value={item.label ?? ""}
                    onChange={(e) => updateItem(idx, { label: e.target.value })}
                    className="nodrag flex-1 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => removeItem(idx)}
                    title="Remove message"
                  >
                    <RiDeleteBin2Line className="size-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Channel (#general)"
                  value={item.channel ?? ""}
                  onChange={(e) => updateItem(idx, { channel: e.target.value })}
                  className="nodrag"
                />
                <Textarea
                  placeholder="Message"
                  value={item.message ?? ""}
                  onChange={(e) => updateItem(idx, { message: e.target.value })}
                  className="nodrag min-h-[50px]"
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
              <RiAddLine className="size-4 mr-1" />
              Add message
            </Button>
          </div>
        )}
        {isPostMessage && !useItemsUi && (
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
            value={d.email ?? d.userId ?? ""}
            onChange={(e) => handleChange({ email: e.target.value })}
            className="nodrag"
          />
        )}
        {d.operation === "create_channel" && (
          <>
            <Input
              placeholder="Channel name"
              value={d.channelName ?? ""}
              onChange={(e) => handleChange({ channelName: e.target.value })}
              className="nodrag"
            />
            <label className="flex items-center gap-2 nodrag">
              <input
                type="checkbox"
                checked={d.isPrivate ?? false}
                onChange={(e) => handleChange({ isPrivate: e.target.checked })}
              />
              Private channel
            </label>
          </>
        )}
        {d.operation === "invite_to_channel" && (
          <>
            <Input
              placeholder="Channel ID"
              value={d.channel ?? ""}
              onChange={(e) => handleChange({ channel: e.target.value })}
              className="nodrag"
            />
            <Input
              placeholder="User IDs (comma-separated)"
              value={d.users ?? ""}
              onChange={(e) => handleChange({ users: e.target.value })}
              className="nodrag"
            />
          </>
        )}
        {d.operation === "channel_history" && (
          <>
            <Input
              placeholder="Channel ID"
              value={d.channel ?? ""}
              onChange={(e) => handleChange({ channel: e.target.value })}
              className="nodrag"
            />
            <Input
              type="number"
              placeholder="Limit (default 10)"
              value={d.limit ?? ""}
              onChange={(e) => handleChange({ limit: e.target.value ? Number(e.target.value) : undefined })}
              className="nodrag"
            />
          </>
        )}
        {d.operation === "list_channels" && (
          <Input
            type="number"
            placeholder="Limit (optional)"
            value={d.limit ?? ""}
            onChange={(e) => handleChange({ limit: e.target.value ? Number(e.target.value) : undefined })}
            className="nodrag"
          />
        )}
        {d.operation === "reaction" && (
          <>
            <Input
              placeholder="Channel ID"
              value={d.channel ?? ""}
              onChange={(e) => handleChange({ channel: e.target.value })}
              className="nodrag"
            />
            <Input
              placeholder="Message timestamp"
              value={d.timestamp ?? ""}
              onChange={(e) => handleChange({ timestamp: e.target.value })}
              className="nodrag"
            />
            <Input
              placeholder="Emoji (e.g. thumbsup)"
              value={d.reactionName ?? ""}
              onChange={(e) => handleChange({ reactionName: e.target.value })}
              className="nodrag"
            />
          </>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
