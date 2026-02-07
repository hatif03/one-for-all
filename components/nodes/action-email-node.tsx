import { NodeCard } from "@/components/node-card";
import { actionEmailDataSchema, type ActionEmailItem } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { RiFileTextLine, RiMailLine, RiAddLine, RiDeleteBin2Line } from "@remixicon/react";
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
  const op = d.operation ?? "send";
  const isList = d.toSource === "list";
  const items = Array.isArray(d.items) ? (d.items as ActionEmailItem[]) : [];
  const useItemsUi = op === "send" && items.length > 0;

  const updateItem = useCallback(
    (index: number, updates: Partial<ActionEmailItem>) => {
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
      items: [...items, { label: "", to: "{{to}}", subject: "", body: "" }],
    });
  }, [items, handleChange]);

  return (
    <NodeCard title={op === "send" ? "Email" : "Gmail"} node={props}>
      <div className="p-3 space-y-2 text-sm">
        <Select value={op} onValueChange={(v) => handleChange({ operation: v as "send" | "list" | "get" })}>
          <SelectTrigger className="nodrag">
            <SelectValue placeholder="Operation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send">Send email</SelectItem>
            <SelectItem value="list">List messages (Gmail)</SelectItem>
            <SelectItem value="get">Get message (Gmail)</SelectItem>
          </SelectContent>
        </Select>
        {op === "send" && useItemsUi && (
          <>
            <Select value={d.service ?? "SendGrid"} onValueChange={(v) => handleChange({ service: v })}>
              <SelectTrigger className="nodrag">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SendGrid">SendGrid</SelectItem>
                <SelectItem value="Gmail">Gmail</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-md border p-2 space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Label (e.g. Welcome email)"
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
                      title="Remove email"
                    >
                      <RiDeleteBin2Line className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      placeholder="To"
                      value={item.to ?? ""}
                      onChange={(e) => updateItem(idx, { to: e.target.value })}
                      className="nodrag flex-1"
                    />
                  </div>
                  <Input
                    placeholder="Subject"
                    value={item.subject ?? ""}
                    onChange={(e) => updateItem(idx, { subject: e.target.value })}
                    className="nodrag"
                  />
                  <Textarea
                    placeholder="Body"
                    value={item.body ?? ""}
                    onChange={(e) => updateItem(idx, { body: e.target.value })}
                    className="nodrag min-h-[50px]"
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
                <RiAddLine className="size-4 mr-1" />
                Add email
              </Button>
            </div>
          </>
        )}
        {op === "send" && !useItemsUi && (
          <>
            <Select value={d.service ?? "SendGrid"} onValueChange={(v) => handleChange({ service: v })}>
              <SelectTrigger className="nodrag">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SendGrid">SendGrid</SelectItem>
                <SelectItem value="Gmail">Gmail</SelectItem>
              </SelectContent>
            </Select>
            <Select value={d.toSource ?? "single"} onValueChange={(v) => handleChange({ toSource: v as "single" | "list" })}>
              <SelectTrigger className="nodrag">
                <SelectValue placeholder="Send to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">One recipient</SelectItem>
                <SelectItem value="list">Many (from list/CSV above)</SelectItem>
              </SelectContent>
            </Select>
            {isList ? (
              <div className="flex items-center gap-2">
                <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Column for email (e.g. email)"
                  value={d.toListField ?? "email"}
                  onChange={(e) => handleChange({ toListField: e.target.value })}
                  className="nodrag flex-1"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="To (email)"
                  value={d.to ?? ""}
                  onChange={(e) => handleChange({ to: e.target.value })}
                  className="nodrag flex-1"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <RiFileTextLine className="size-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Subject"
                value={d.subject ?? ""}
                onChange={(e) => handleChange({ subject: e.target.value })}
                className="nodrag flex-1"
              />
            </div>
            <Textarea
              placeholder="Body"
              value={d.body ?? ""}
              onChange={(e) => handleChange({ body: e.target.value })}
              className="nodrag min-h-[60px]"
            />
          </>
        )}
        {op === "list" && (
          <>
            <Input
              placeholder="Query (e.g. is:unread)"
              value={d.query ?? ""}
              onChange={(e) => handleChange({ query: e.target.value })}
              className="nodrag"
            />
            <Input
              type="number"
              placeholder="Max results"
              value={d.maxResults ?? ""}
              onChange={(e) => handleChange({ maxResults: e.target.value ? Number(e.target.value) : undefined })}
              className="nodrag"
            />
          </>
        )}
        {op === "get" && (
          <Input
            placeholder="Message ID"
            value={d.messageId ?? ""}
            onChange={(e) => handleChange({ messageId: e.target.value })}
            className="nodrag"
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
