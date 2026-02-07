---
name: Workflow node clarity and consolidation
overview: "Make every generated node show its purpose and all relevant details (HTTP: method, URL, params; email/Slack: labels). Prefer one node with a list of items for multiple emails/Slack messages instead of many identical nodes, with generator merging consecutive same-type steps and UI for editing the list."
todos: []
isProject: false
---

# Workflow node clarity and consolidation

## Problem summary

1. **HTTP node** – When the action is "Custom HTTP - HTTP request", the node shows only that label. Method, URL, parameters, and body are not visible because the UI uses the catalog layout (which for the custom op has no params and no URL field).
2. **Multiple identical nodes** – The AI generates many separate email (or Slack) nodes with no way to tell them apart; there are no annotations or comments.
3. **Multi-send UX** – Multiple emails/messages should be configurable in one place (e.g. one node with a list of items) instead of one node per send.

---

## 1. HTTP node: always show method, URL, and params

**Cause:** In [components/nodes/action-http-node.tsx](components/nodes/action-http-node.tsx), content is chosen by `catalogEntry ? (catalog params) : (custom method+url+body)`. The built-in "Custom HTTP" operation has `id: "http-request"`, `urlTemplate: ""`, `params: []`, so it has a catalog entry and the UI renders the catalog branch with no fields.

**Change:**

- In the HTTP node component, treat the **custom HTTP** catalog op as "custom" for display: when `catalogEntry?.operation.id === "http-request"` (or when the operation has no params and no `urlTemplate`), render the same block as when there is no catalog entry: method dropdown, URL input, and body (when method is not GET). Keep using `d.method`, `d.url`, `d.body` from node data (generator already sets these in [lib/workflow-generator.ts](lib/workflow-generator.ts) `stepToNodeData` for action-http; for custom op, `url` can be empty so the placeholder will show).
- Optionally add a one-line summary in the card (e.g. under the title): show method + URL when both are set (e.g. `GET https://api.example.com/...`) so the user always sees the key details at a glance without expanding.

**Files:** [components/nodes/action-http-node.tsx](components/nodes/action-http-node.tsx), and [lib/api-catalog.ts](lib/api-catalog.ts) (reference: custom op id is `"http-request"`).

---

## 2. Labels/comments on every generated node

**Goal:** Every generated node has a visible purpose (e.g. "Welcome email", "Call CRM API") so multiple similar nodes are distinguishable.

**Changes:**

- **Generator:** In [lib/workflow-generator.ts](lib/workflow-generator.ts), when building node `data` for each step, set `label` from the step description. `baseNodeDataSchema` in [lib/base-node.ts](lib/base-node.ts) already has `label: z.string().optional()`, so no schema change. Use a short version of `step.description` (e.g. truncate to ~50 chars) so the card stays readable.
- **NodeCard / nodes:** In [components/node-card.tsx](components/node-card.tsx), when `node.data?.label` is present, show it as a subtitle or a small comment line under the title (e.g. muted text: "Welcome email to new signups"). So every action node that has a label will show it without changing each node component.

**Files:** [lib/workflow-generator.ts](lib/workflow-generator.ts) (set `label` in `data` for each created node), [components/node-card.tsx](components/node-card.tsx) (render `node.data?.label` when present).

---

## 3. Consolidate multiple emails (and Slack) into one node with a list

**Goal:** Instead of N separate "Email" nodes, generate one Email node that supports multiple "items" (each with optional label, to, subject, body). Same idea for Slack (multiple messages or recipients in one node). User edits the list in one place.

**Design:**

- **Schema:** Extend email (and similarly Slack) node data with an optional list of items, e.g. `items?: Array<{ label?: string; to?: string; subject?: string; body?: string }>`. When `items` is non-empty, the node represents "send these N emails". Execution: loop over `items` and send each (existing send logic per item). Backward compatibility: if `items` is missing or empty, treat current `to/subject/body` as a single send (one implicit item).
- **Generator:** In [lib/workflow-generator.ts](lib/workflow-generator.ts), after mapping steps to discovered operations, **merge consecutive same-type steps** into one node:
  - Consecutive "action-email" (send) steps → one `action-email` node with `items: steps.map(s => ({ label: s.description, to: "{{to}}", subject: "...", body: "..." }))` and clear or omit single `to/subject/body` if using items.
  - Consecutive "action-slack" (post_message) steps → one `action-slack` node with a list of messages (e.g. `items: [{ channel: "#general", message: "..." }]`).
  - Edges: the merged node gets one incoming edge from the node that previously connected to the first of the group, and one outgoing edge from the merged node to the node that followed the last of the group.
- **UI:** In [components/nodes/action-email-node.tsx](components/nodes/action-email-node.tsx) (and [components/nodes/action-slack-node.tsx](components/nodes/action-slack-node.tsx)):
  - When `items` is present and non-empty, show a list of items (each with optional label + to/subject/body), "Add email" / "Add message" button, and remove per item. When there is only one item, you can still show the same list UI (one row) for consistency.
  - When `items` is empty or absent, keep current single-email (or single-message) UI so existing workflows and "single send" generation still work.

**Execution:** In [lib/compute-actions.ts](lib/compute-actions.ts), extend the email (and Slack) runner to: if `data.items` is a non-empty array, run a send for each item (using existing connection/send logic); otherwise keep current single-send behavior.

**Files:** [lib/node-types.ts](lib/node-types.ts) (add `items` to email and Slack schemas), [lib/workflow-generator.ts](lib/workflow-generator.ts) (merge consecutive email/Slack steps, output one node with `items`), [components/nodes/action-email-node.tsx](components/nodes/action-email-node.tsx) and [components/nodes/action-slack-node.tsx](components/nodes/action-slack-node.tsx) (list UI + add/remove), [lib/compute-actions.ts](lib/compute-actions.ts) (iterate over `items` when present).

---

## 4. Optional: annotation node per logical group

If we still want an explicit "comment" on the canvas (in addition to per-node labels), the generator could add a small annotation node next to a merged email (or Slack) node with text like "3 emails: welcome, reminder, follow-up". This is secondary to the per-node label and the list UI; can be done in a follow-up.

---

## Implementation order

1. **HTTP node** – Fix custom HTTP display so method, URL, and body are always visible when the action is custom (and optionally show method+URL in card summary).
2. **Labels** – Generator sets `label` from step description; NodeCard shows it. No execution changes.
3. **Schema + merge + UI + compute** – Add `items` to email (then Slack), generator merges consecutive steps, node UIs gain list + add/remove, compute runs over `items` when present.

This keeps backward compatibility (existing workflows and single-send behavior unchanged) and makes every detail visible while moving multi-send into a single, intuitive list-based node.