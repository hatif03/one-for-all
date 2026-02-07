"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CONNECTION_KEYS, useConnectionsStore } from "@/lib/connections-store";
import { RiKey2Line } from "@remixicon/react";
import { useEffect, useState } from "react";

export default function ConnectionsDialog({ children }: { children: React.ReactNode }) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const { connections, setConnection, removeConnection, open, setOpen } = useConnectionsStore();

  const handleSave = (key: string) => {
    const value = inputValues[key];
    if (value?.trim()) {
      setConnection(key, value.trim());
    } else {
      removeConnection(key);
    }
  };

  useEffect(() => {
    const next: Record<string, string> = {};
    CONNECTION_KEYS.forEach((k) => {
      next[k] = connections[k] ?? "";
    });
    setInputValues((prev) => ({ ...prev, ...next }));
  }, [connections, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect your tools</DialogTitle>
          <DialogDescription>
            Add API keys or tokens for email and Slack. Stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {CONNECTION_KEYS.map((key) => (
            <div key={key} className="bg-card p-3 rounded-lg flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiKey2Line className="size-5" />
                  <span className="text-sm font-medium">{key}</span>
                  {connections[key] && (
                    <span className="text-xs text-green-600 bg-green-200 dark:bg-green-500/20 dark:text-green-400 px-2 py-1 rounded">
                      Connected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  type="password"
                  placeholder={`${key} API key or token`}
                  value={inputValues[key] ?? ""}
                  onChange={(e) => setInputValues((p) => ({ ...p, [key]: e.target.value }))}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" onClick={() => handleSave(key)}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
