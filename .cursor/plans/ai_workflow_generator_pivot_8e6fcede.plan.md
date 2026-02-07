---
name: AI Workflow Generator Pivot
overview: "Transform the existing All for One node-based AI workflow builder into an AI-Powered Business Workflow Generator by adding: (1) a conversational NL requirement intake with clarification and process decomposition, (2) API discovery and executable API/action nodes, (3) AI-generated workflow from conversation that populates the canvas, and (4) human-in-the-loop preview, NL modifications, and approval before deployment. The current React Flow canvas, node execution engine, and AI integration are retained and extended."
todos: []
isProject: false
---

# Pivot: All for One → AI-Powered Business Workflow Generator

## Current state vs challenge


| Challenge pillar                          | Current project                                              | Gap                                                                          |
| ----------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Conversational requirement collection** | None; users create workflows manually via sidebar + add-node | Need: NL input, clarification Q&A, process decomposition                     |
| **API discovery & mapping**               | No external APIs; only LLM calls (prompt → AI → markdown)    | Need: Semantic API search, multi-system integration, auth/data mapping       |
| **Automated workflow generation**         | Manual node/edge creation only                               | Need: Generate nodes + edges from conversation (into existing canvas format) |
| **Human-in-the-loop**                     | No approval or “preview before deploy”                       | Need: Visual preview (you have it), NL modification, approval gate           |
| **Executable output**                     | Runs only in-browser (LLM steps)                             | Need: Workflows that execute real actions (API calls) or export to a runner  |


The existing codebase is a strong base: React Flow canvas, [lib/workflow-store.ts](lib/workflow-store.ts) (nodes/edges, `addNode`, `importFromJson`), [lib/compute.ts](lib/compute.ts) (node execution by type), [lib/ai.ts](lib/ai.ts) (multi-provider LLMs). The pivot is to add a **conversation-first path** that produces workflows that can run **real actions** (not just LLM steps), while keeping the current manual builder as an advanced mode.

---

## 1. Conversational requirement collection

**Goal:** Non-technical users describe what they need in plain English; AI clarifies and decomposes into steps.

- **New entry point:** Add a “Create with AI” or “Describe your workflow” flow (e.g. from sidebar or a prominent CTA) that opens a **chat-style interface** (new component, e.g. `components/requirement-chat.tsx` or a dedicated route).
- **NL input:** Single textarea or multi-turn chat where the user types requirements (e.g. “When a new employee is hired, send welcome email, create accounts, add to Slack, schedule training”).
- **Clarification:** Use the existing LLM stack to:
  - Detect ambiguity and ask 1–3 targeted questions (e.g. “Which email system?” “Which systems for accounts?”).
  - Return structured “requirement + clarification answers” for the next phase.
- **Process decomposition:** Same or second LLM call to turn the refined requirement into a **list of logical steps** (e.g. “1. Send welcome email, 2. Create account in HR system, 3. Add to Slack, 4. Schedule training”). Output a simple schema (e.g. `{ steps: { id, description, suggestedService? }[] }`) so the rest of the pipeline is deterministic.
- **Copy and UX:** Keep language non-technical (no “API”, “endpoint” in the chat unless the user says it). Explain “I’ll suggest services and steps; you can review and approve before we build the workflow.”

**Files to add/change:** New chat UI component(s), new store or context for “current requirement + clarification + steps”, optional route like `app/describe/page.tsx` or integrated panel in main page; reuse [lib/ai.ts](lib/ai.ts) and existing API key handling.

---

## 2. Intelligent API discovery and mapping

**Goal:** From high-level intent (“send welcome email”, “add to Slack”), find concrete operations and map data between steps.

- **API catalog (MVP):** For a live demo, avoid building a full semantic search over the entire internet. Use a **curated catalog** of 2–4 systems (e.g. Gmail/SendGrid, Slack, one HR/training placeholder, plus “Custom HTTP”). Each entry has: display name, intent keywords, auth type, and a small set of “operations” (e.g. “Send email”, “Create channel”, “Invite user”) with method + path template + required/optional params. Store as JSON/TS in e.g. `lib/api-catalog.ts`.
- **Semantic matching:** Use LLM (or embeddings if you add a vector step) to map each **decomposed step** to a catalog operation: “Send welcome email” → Gmail “Send email” with placeholder body/template. Output a list of “step → operation + param mapping” so the generator can create nodes.
- **Auth handling:** For the hackathon, “identifies required credentials and guides configuration” can be: when an operation is chosen, show a short message (“This step needs a Gmail/Slack token”) and link to your existing [components/api-keys.tsx](components/api-keys.tsx) or a dedicated “Connections” panel where users add API keys (stored like current keys). No need to implement OAuth; API key / token is enough for demo.
- **Data mapping:** For “output of step A as input to step B”, use a simple convention: each step produces a JSON object (e.g. `{ emailSent: true, messageId }`); the generator wires “messageId” into the next step’s params when the LLM says “use the email id from previous step”. Implement as **node output → next node input** in your existing execution model (see below).

**Files to add/change:** `lib/api-catalog.ts` (or similar), `lib/api-discovery.ts` (or prompt + function in ai.ts) that takes steps and returns operation + param mapping; optional small “Connections” UI for per-service keys if you go beyond a single global key.

---

## 3. Automated workflow generation (into your canvas)

**Goal:** Turn “requirement + steps + mapped operations” into a workflow that your app can display and run.

- **Output format:** Generate workflow as the same structure your app already uses: **nodes** (with `type`, `position`, `data`) and **edges** (`source`, `target`). That way you can use `addNode` / `importFromJson` or a single “load generated workflow” action.
- **Node types to support:** See **Section 3a** below for the full extended node palette. Existing `prompt`, `ai`, `markdown`, `annotation` are kept; new executable and control-flow nodes are added so generated workflows can cover HR onboarding, approvals, document processing, and compliance use cases.
- **Generator flow:** Single LLM call (or a small pipeline) that receives: decomposed steps + mapped operations + catalog snippets. It returns a **JSON blob**: `{ nodes: [...], edges: [...] }` conforming to your existing node/edge schema. You then:
  - Create a new workflow (e.g. `createWorkflow("Onboarding (generated)")`) and replace its nodes/edges with the generated set, or
  - Use a dedicated “generated workflow” slot and call something like `replaceCurrentWorkflowNodesAndEdges(nodes, edges)` (you may add this to [lib/workflow-store.ts](lib/workflow-store.ts) if you don’t want to go through `importFromJson`).
- **Error handling and retries:** For “production-ready” feel, add to the **API node** (or to the generator’s instructions): “include retry (e.g. 2 retries with backoff) and on failure trigger a notification node”. You can implement retry in [lib/compute.ts](lib/compute.ts) for `type === "api"` and add a simple “notification” step (e.g. markdown node showing “Step X failed”) so the workflow has a fallback path.

**Files to add/change:** New node type components per Section 3a; extend [lib/compute.ts](lib/compute.ts) for each executable type; add generator in `lib/workflow-generator.ts`; wire “Generate workflow” in requirement-chat.

---

### 3a. Extended node palette for business use cases

To support the challenge’s use cases (HR onboarding, expense approvals, data entry, document processing, compliance workflows), extend the canvas with the following node types. Each should have a React Flow component, a schema in `data`, and a `compute*` in [lib/compute.ts](lib/compute.ts) where applicable.


| Category         | Node type               | Purpose                                                                       | Use case                                       |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| **Triggers**     | `trigger-manual`        | Start workflow on button click (demo/run)                                     | All                                            |
|                  | `trigger-webhook`       | Start on HTTP POST (e.g. “when form submitted”)                               | Data entry, form-to-workflow                   |
|                  | `trigger-schedule`      | Start on cron-like schedule (e.g. daily)                                      | Compliance checks, recurring reports           |
| **Actions**      | `action-email`          | Send email (Gmail/SendGrid/etc. via catalog)                                  | Onboarding welcome email                       |
|                  | `action-slack`          | Post message, invite user, create channel (catalog)                           | Onboarding, notifications                      |
|                  | `action-http`           | Generic HTTP request (method, url, headers, body + mapping)                   | Custom systems, “API we don’t have in catalog” |
|                  | `action-document`       | Parse/extract from document (e.g. PDF/HTML → structured data)                 | Document processing                            |
| **Control flow** | `control-delay`         | Wait for X minutes/hours before next step                                     | “Send that email later”                        |
|                  | `control-condition`     | Branch by condition (if/else)                                                 | Approvals, compliance branches                 |
|                  | `control-approval`      | Pause for human approval; resume on approve/reject                            | Expense approvals, compliance gates            |
| **Data**         | `data-prompt`           | User input / form-like input (existing prompt node can double)                | Data entry, test payloads                      |
|                  | `data-transform`        | Map outputs of previous nodes to next step inputs (or inline in action nodes) | Multi-system data mapping                      |
| **AI / display** | `ai` (existing)         | LLM step for content or decisions                                             | Summaries, routing decisions                   |
|                  | `markdown` (existing)   | Display output                                                                | Notifications, reports                         |
|                  | `annotation` (existing) | Documentation                                                                 | Inline docs                                    |


**Implementation note:** Start with a minimal set for the demo (e.g. `trigger-manual`, `action-email`, `action-slack`, `action-http`, `control-delay`, `control-approval`), then add `trigger-webhook`, `trigger-schedule`, `control-condition`, `action-document` in follow-up commits. All action nodes use the same **credentials/connections** concept (link to API keys or per-service connections).

---

## 4. Human-in-the-loop refinement

**Goal:** User sees what was built, can ask for changes in NL, and approves before “deployment”.

- **Visual workflow preview:** You already have it—once the generator fills the canvas, the user sees the React Flow diagram. Optionally add a “Preview” mode that opens the workflow in read-only or with a clear “Generated – review below” banner.
- **Modification in natural language:** Add a follow-up in the same chat: “Want to change anything? Say e.g. ‘Add a delay before the reminder’ or ‘Send that email later’.” One more LLM call that takes the **current workflow JSON + the user’s edit request** and returns an **updated** `{ nodes, edges }` (or a diff). Apply the same “replace workflow” logic so the canvas updates. This directly addresses “Natural modifications: … → workflow updated instantly”.
- **Approval gate:** Before the workflow is considered “deployed” or “running in production”, add an explicit step: after the user is happy, they click **“Approve & deploy”** (or “Save as production workflow”). For the hackathon “deployment” can mean: “mark this workflow as approved and runnable” (e.g. a flag on the workflow) and optionally “allow running this workflow from a simple ‘Run’ button”. No need to integrate with external schedulers; “human approved and executable in-app” satisfies the constraint.
- **Continuous improvement:** “Learns from feedback” can be a stretch for a short timeline; a minimal version: store “requirement text + final workflow” in local state and, when generating a new workflow, optionally include one past example in the prompt as few-shot. No need for a full learning pipeline.

**Files to add/change:** Requirement chat UI: add “Edit with natural language” input and “Apply changes” that calls the same generator with “modify” prompt; add “Approve & deploy” button that sets an `approved: true` (or similar) on the current workflow in the store; optional `workflow.metadata.source: "ai-generated"` for analytics.

---

## 5. Executable output and testing

**Goal:** Generated workflows must actually run, not just look right (Craft 20%, “Do generated workflows actually execute?”).

- **Run in-app:** With the new API node and existing `runNode`/execution order (topological run), the workflow can **execute** inside your app: trigger “Run” on the first node(s), then downstream API nodes call real endpoints (with user’s API keys), and results flow to the next nodes. Ensure execution order respects edges (you likely already do this in [lib/workflow-store.ts](lib/workflow-store.ts) `runNode`/downstream propagation).
- **Testing framework (lightweight):** “Automatically generates test cases” can be: for each API node, the generator adds a **test payload** (e.g. mock input) or you run once in “dry run” (log requests without sending). Simpler: “Run workflow” with a single “test” trigger (e.g. one prompt node with sample data) and show success/failure per node. If a node fails, capture the error message and pass it to the **self-debugging** step below.
- **Self-debugging (high impact):** When a run fails, show an “AI fix” option: send the **error log + failing node + workflow snippet** to the LLM and ask for an updated node config or updated workflow JSON (e.g. fix parameter name or add a header). Apply the fix and re-run. This addresses “Workflow fails during test → AI reads error logs → fixes the workflow → re-tests automatically”.

**Files to add/change:** [lib/compute.ts](lib/compute.ts) and API node for real execution; optional `lib/workflow-runner.ts` for “run full workflow from trigger”; error state in node data and a “Debug with AI” button that calls LLM and patches the workflow.

---

## 6. UX and demo flow (non-technical, live demo)

- **Landing / first screen:** Offer two paths: “Describe your workflow in plain English” (conversation) and “Build from scratch” (current canvas). Make “Describe your workflow” the primary CTA for the hackathon.
- **Single story for judges:** “I need to automate employee onboarding” → user types that → AI asks 1–2 questions (e.g. “Which tools do you use for email and Slack?”) → user answers → AI shows “I’ll create: 1. Send welcome email, 2. Create account, 3. Add to Slack, 4. Schedule training” → user clicks “Generate workflow” → canvas fills with nodes → user clicks “Run” with test data → (if something breaks) “Fix with AI” → user clicks “Approve & deploy”. End-to-end in one flow.
- **Copy:** Avoid jargon in the chat and in buttons; use “Connect your tools” instead of “Configure OAuth” where possible.

---

## 7. Questions Worth Considering – design decisions


| Question                                              | Approach                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ambiguous requirements without too many questions** | Cap clarification at 1–2 rounds. Use **smart defaults** (e.g. “Gmail” for email, “Slack” for team chat) and **assume common tools**; if the user says “we use Outlook,” the NL-edit flow can swap the step. Prefer “generate first, then refine in one NL edit” over many clarifying questions.                                                     |
| **Balance AI autonomy vs user control**               | **Always show a visual preview** before any execution. **No auto-deploy:** user must click “Approve & deploy.” Allow **edit in natural language** so the user stays in control of changes. Optional: “Suggest only” mode where AI proposes steps and user confirms each.                                                                            |
| **Discover APIs when users don’t know system names**  | **Intent-first catalog:** operations described by what they do (“Send email,” “Add user to channel”). User describes intent in plain language; **semantic match** (LLM or embeddings) maps to catalog operations. If no name is given, show “I’ll use Gmail for email and Slack for team messaging—change anytime in the workflow.”                 |
| **Workflows that work across different platforms**    | Keep one **internal workflow format** (nodes + edges). Add **export adapters** (e.g. n8n, Make) that translate that format to the target platform’s JSON. Same conversation → same graph → “Export for n8n” or “Run here” (multi-platform support).                                                                                                 |
| **Authentication/credentials securely**               | Store keys in **client-side only** (e.g. existing API key store); never send keys to your backend. For demo, API keys/tokens only; document that production could use a **secure proxy** or OAuth with tokens stored server-side. Never log or expose keys in error messages.                                                                       |
| **Required API doesn’t exist – suggest alternatives** | If the catalog has no match, **AI suggests**: (1) closest catalog alternative (“I don’t have X, but I can use Y for something similar”), (2) **Custom HTTP** node with instructions (“Use this node and add your API details”), (3) “Add to catalog later” placeholder. Return structured suggestion so the generator can insert the chosen option. |


---

## 8. What Would Blow Our Minds – coverage


| “Blow our minds” item                                                                   | How it’s covered                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **End-to-end: “automate employee onboarding” → short conversation → deployed workflow** | Primary demo path: requirement chat (1–2 exchanges) → generate → preview → run test → approve & deploy. All in one flow with the extended node set (email, Slack, delay, approval, etc.).                                                                                         |
| **Intelligent API discovery: plain language → correct endpoint across many APIs**       | Intent-based catalog + LLM semantic matching (Section 2). Catalog includes multiple systems (email, Slack, HR, HTTP); discovery returns operation + params from natural step descriptions.                                                                                        |
| **Self-debugging: fail → AI reads logs → fixes → re-tests**                             | “Debug with AI” flow (Section 5): on run failure, send error log + failing node + workflow snippet to LLM; LLM returns patched node(s) or workflow diff; apply and re-run automatically (or one-click re-run).                                                                    |
| **Multi-platform: same conversation, different platform output**                        | Internal canonical format; export adapters for n8n (and optionally Make). User preference: “Run here” vs “Export for n8n” (Section 7, cross-platform row).                                                                                                                        |
| **Learning from examples: analyse existing workflows to improve future generations**    | Store “requirement text + final workflow JSON” per approved workflow. When generating, optionally include 1–2 past examples as few-shot in the generator prompt so similar requests produce similar structure. Can add “Save as template” to save current workflow as an example. |
| **Natural modifications: “send that email later” → workflow updated instantly**         | NL-edit flow (Section 4): user types the change in chat; LLM receives current workflow JSON + edit request; returns updated `{ nodes, edges }`; apply to canvas immediately without full rebuild.                                                                                 |


---

## 9. Incremental development and GitHub commit strategy

Structure work so each logical milestone is **commit-ready** and can be pushed to GitHub regularly. Suggested commit-sized phases:


| #   | Commit scope                         | Deliverable                                                                                                                                                    |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Node foundation**                  | Extended node type registry; base schemas and empty compute stubs for new types; UI placeholders (e.g. one generic “action” node that accepts type from data). |
| 2   | **Triggers + one action**            | `trigger-manual`, `action-http` (or `action-email`) implemented end-to-end (component + compute); one workflow runnable from “Run” with HTTP.                  |
| 3   | **Action nodes for onboarding**      | `action-email`, `action-slack`, `control-delay`; API catalog and discovery stub; credentials UX linked from nodes.                                             |
| 4   | **Approval and control**             | `control-approval`, `control-condition`; branching and approval state in compute.                                                                              |
| 5   | **Requirement chat + decomposition** | Chat UI; clarification + decomposition LLM calls; store for requirement and steps; no generation yet.                                                          |
| 6   | **Workflow generator**               | Generator that produces nodes/edges from steps + catalog; “Generate workflow” loads canvas; end-to-end from chat to visible workflow.                          |
| 7   | **Human-in-the-loop**                | “Edit in NL” and “Approve & deploy”; workflow metadata (source, approved).                                                                                     |
| 8   | **Self-debugging**                   | “Debug with AI” on failure; LLM patch + re-run.                                                                                                                |
| 9   | **Multi-platform export**            | Export adapter(s) (e.g. n8n); “Export for n8n” from same workflow.                                                                                             |
| 10  | **Learning from examples**           | Save approved workflow as example; few-shot in generator prompt.                                                                                               |
| 11  | **Polish**                           | Copy, demo path, optional nodes (webhook, schedule, document), error handling and retries.                                                                     |


Commit after each phase (or after 1–2 phases if they are small). Message style: e.g. `feat: add trigger and HTTP action nodes`, `feat: requirement chat and workflow generation from conversation`.

---

## 10. Suggested implementation order

Follow the commit strategy in Section 9 so each phase is shippable:

1. **Node foundation** (Commit 1) – Extended node registry, schemas, compute stubs, UI placeholders.
2. **Triggers + HTTP action** (Commit 2) – `trigger-manual`, `action-http`; one runnable workflow.
3. **Onboarding actions + catalog** (Commit 3) – `action-email`, `action-slack`, `control-delay`; catalog and discovery; credentials UX.
4. **Approval and branching** (Commit 4) – `control-approval`, `control-condition`.
5. **Conversation + decomposition** (Commit 5) – Chat UI, clarification and steps; store.
6. **Workflow generator** (Commit 6) – Steps + catalog → nodes/edges; “Generate workflow” loads canvas.
7. **Human-in-the-loop** (Commit 7) – “Edit in NL”, “Approve & deploy”, metadata.
8. **Self-debugging** (Commit 8) – “Debug with AI”, patch and re-run.
9. **Multi-platform + learning** (Commits 9–10) – Export adapters; few-shot from saved workflows.
10. **Polish** (Commit 11) – Copy, demo path, optional nodes, retries.

---

## 11. Summary: what to add vs modify


| Area                  | Add                                                                                                                             | Modify                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Conversation**      | Requirement chat component; store for requirement + steps; LLM prompts for clarification and decomposition                      | Sidebar or home: add “Create with AI” entry                                                                                            |
| **API layer**         | `lib/api-catalog.ts`, `lib/api-discovery.ts`; action/trigger/control node components and compute functions; Connections UI      | [lib/compute.ts](lib/compute.ts): register all new node types; [components/workflow.tsx](components/workflow.tsx): register node types |
| **Generation**        | `lib/workflow-generator.ts` (or equivalent) that outputs nodes/edges; “Generate workflow” and “Apply NL edit” in chat           | [lib/workflow-store.ts](lib/workflow-store.ts): optional `replaceGeneratedWorkflow(nodes, edges)` or use existing import               |
| **Human-in-the-loop** | “Edit with NL” input, “Approve & deploy” button, optional workflow metadata                                                     | Chat UI and workflow toolbar                                                                                                           |
| **Execution**         | Retry + failure path in action nodes; “Debug with AI” (Section 8); run order and approval state                                 | [lib/compute.ts](lib/compute.ts), node data for error state                                                                            |
| **Node palette**      | Triggers (manual, webhook, schedule), actions (email, Slack, HTTP, document), control (delay, condition, approval) (Section 3a) | [components/nodes/*.tsx](components/nodes/), [lib/compute.ts](lib/compute.ts)                                                          |
| **Design & “wow”**    | Section 7 (Questions Worth Considering); Section 8 (What Would Blow Our Minds); Section 9 (incremental GitHub commits)          | Export adapters; few-shot and NL-edit; commit after each phase                                                                         |


This plan keeps your existing architecture (React Flow, workflow store, compute, AI providers) and extends it with a conversation-first path, executable API steps, and human approval—aligning with the challenge’s constraints (live demo, AI at core, non-technical, executable, human oversight) and evaluation (Insight, Usefulness, Craft, Ambition, Demo).