"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getCleanedWorkflow, useWorkflowStore, type WorkflowState } from "@/lib/workflow-store";
import {
  RiAiGenerate2,
  RiArrowUpBoxLine,
  RiChatQuoteLine,
  RiDeleteBin2Line,
  RiMarkdownLine,
  RiStopLine,
  RiTextSnippet,
} from "@remixicon/react";
import { Panel, useReactFlow } from "@xyflow/react";
import { memo, useCallback } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

export const Panels = memo(function Panels() {
  return (
    <>
      <TopLeftPanel />
      <TopRightPanel />
      <BottomCenterPanel />
    </>
  );
});

const TopLeftPanel = memo(function TopLeftPanel() {
  const { updateWorkflowName, currentName, currentWorkflowId } = useWorkflowStore(
    useShallow((state: WorkflowState) => ({
      updateWorkflowName: state.updateWorkflowName,
      currentName: state.getCurrentWorkflow()?.name,
      currentWorkflowId: state.currentWorkflowId,
    }))
  );

  const handleCanvasNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (currentWorkflowId) {
        updateWorkflowName(currentWorkflowId, e.target.value);
      }
    },
    [currentWorkflowId, updateWorkflowName]
  );

  if (currentName === undefined) return null;

  return (
    <Panel position="top-left">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Input
          value={currentName}
          onChange={handleCanvasNameChange}
          placeholder="Canvas name..."
          className="w-fit max-w-64 font-semibold not-focus:bg-transparent not-focus:border-transparent not-focus:ring-0 dark:not-focus:bg-transparent dark:not-focus:border-transparent dark:not-focus:ring-0 not-focus:-translate-x-4 transition-all not-focus:shadow-none"
        />
      </div>
    </Panel>
  );
});

const TopRightPanel = memo(function TopRightPanel() {
  const { deleteWorkflow, getCurrentWorkflow, currentWorkflowId, abortAllOperations, isRunning } = useWorkflowStore(
    useShallow((state: WorkflowState) => ({
      deleteWorkflow: state.deleteWorkflow,
      getCurrentWorkflow: state.getCurrentWorkflow,
      currentWorkflowId: state.currentWorkflowId,
      abortAllOperations: state.abortAllOperations,
      isRunning: state.getNodes().some((node) => node.data.loading),
    }))
  );

  const handleDeleteWorkflow = useCallback(() => {
    if (currentWorkflowId && confirm("Are you sure you want to delete this workflow? This action cannot be undone.")) {
      deleteWorkflow(currentWorkflowId);
    }
  }, [currentWorkflowId, deleteWorkflow]);

  const handleExportToClipboard = useCallback(() => {
    const workflow = getCurrentWorkflow();
    if (workflow) {
      navigator.clipboard.writeText(JSON.stringify(getCleanedWorkflow(workflow), null, 2));
      toast.success("Workflow copied to clipboard");
    }
  }, [getCurrentWorkflow]);

  return (
    <Panel position="top-right">
      <div className="flex items-center gap-2">
        {isRunning && (
          <Button variant="outline" size="sm" onClick={abortAllOperations}>
            <RiStopLine className="size-4" />
            Stop all
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleExportToClipboard}>
          <RiArrowUpBoxLine className="size-4" />
          <span className="hidden sm:block">Export to clipboard</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteWorkflow}
          className="text-destructive hover:text-destructive"
        >
          <RiDeleteBin2Line className="size-4" />
          <span className="hidden sm:block">Delete Workflow</span>
        </Button>
      </div>
    </Panel>
  );
});

const BottomCenterPanel = memo(function BottomCenterPanel() {
  const instance = useReactFlow();
  const addNode = useWorkflowStore((state: WorkflowState) => state.addNode);

  const handleAddNode = useCallback(
    (type: string) => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const position = instance.screenToFlowPosition({ x: screenWidth / 2, y: screenHeight / 2 });
      switch (type) {
        case "prompt":
          addNode({
            data: { prompt: "" },
            position,
            height: 500,
            width: 450,
            type: type,
          });
          break;
        case "ai":
          addNode({
            data: { systemPrompt: "" },
            position,
            height: 500,
            width: 450,
            type: type,
          });
          break;
        case "markdown":
          addNode({
            data: {},
            position,
            height: 500,
            width: 450,
            type: type,
          });
          break;
        case "annotation":
          addNode({
            data: { text: "" },
            position,
            height: 150,
            width: 400,
            type: type,
          });
          break;
      }
    },
    [addNode, instance]
  );

  return (
    <Panel position="bottom-center">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => handleAddNode("prompt")}>
          <RiTextSnippet className="size-5 shrink-0" />
          <span className="hidden sm:block">Prompt</span>
        </Button>
        <Button variant="outline" onClick={() => handleAddNode("ai")}>
          <RiAiGenerate2 className="size-5 shrink-0" />
          <span className="hidden sm:block">AI</span>
        </Button>
        <Button variant="outline" onClick={() => handleAddNode("markdown")}>
          <RiMarkdownLine className="size-5 shrink-0" />
          <span className="hidden sm:block">Markdown</span>
        </Button>
        <Button variant="outline" onClick={() => handleAddNode("annotation")}>
          <RiChatQuoteLine className="size-5 shrink-0" />
          <span className="hidden sm:block">Annotation</span>
        </Button>
      </div>
    </Panel>
  );
});

