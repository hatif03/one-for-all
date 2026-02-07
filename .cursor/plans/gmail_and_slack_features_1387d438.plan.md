---
name: Gmail and Slack features
overview: Add more Gmail and Slack operations to the catalog, wire discovery and node data to them, fix missing Gmail send in compute, implement Slack invite_user and create_channel in compute, and optionally add Gmail list/get and Slack invite-to-channel with matching UI and requirement-ai hints.
todos: []
isProject: false
---

# More Gmail and Slack features

## Current state

- **Catalog** ([lib/api-catalog.ts](lib/api-catalog.ts)): Gmail has only `gmail-send`; Slack has `slack-post` (chat.postMessage) and `slack-invite` (users.admin.invite).
- **Compute** ([lib/compute-actions.ts](lib/compute-actions.ts)): Email node only implements **SendGrid** in the send loop; **Gmail send is never called**. Slack node only implements `post_message`; returns "Only post_message is supported" for `invite_user` and `create_channel`.
- **Node UI**: [components/nodes/action-slack-node.tsx](components/nodes/action-slack-node.tsx) already has operation dropdown (post_message, invite_user, create_channel) and fields for invite_user (`userId` – should be email for Slack API) and create_channel (no fields yet). [components/nodes/action-email-node.tsx](components/nodes/action-email-node.tsx) is send-only (no operation selector).
- **Workflow generator** ([lib/workflow-generator.ts](lib/workflow-generator.ts)): `stepToNodeData` for action-slack hardcodes `operation: "post_message"`; it does not set operation from the discovered step (e.g. slack-invite → invite_user). Action-email always gets the same send payload.

## 1. Fix Gmail send in compute

In [lib/compute-actions.ts](lib/compute-actions.ts), `sendOne` only contains the SendGrid branch. Add a Gmail branch:

- For Gmail, build an RFC 2822 message (From, To, Subject, body), then base64url-encode and call `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with body `{ raw: "<base64url>" }`, header `Authorization: Bearer ${token}`.
- Keep existing recipient loop and error handling; ensure both SendGrid and Gmail paths run when their service is selected.

## 2. Catalog: more Gmail and Slack operations

In [lib/api-catalog.ts](lib/api-catalog.ts):

**Gmail** – add operations (same service `id: "gmail"`, `connectionKey: "Gmail"`):

- **List messages** (e.g. `gmail-list`): GET `.../users/me/messages?q={query}&maxResults={maxResults}`; params: `query` (optional), `maxResults` (optional); intentKeywords: "list emails", "get emails", "check inbox", "unread", "search emails".
- **Get message** (e.g. `gmail-get`): GET `.../users/me/messages/{id}`; params: `id`; intentKeywords: "get email", "read email", "fetch message".
- Optionally **Add label / modify** (e.g. `gmail-modify`): POST `.../users/me/messages/{id}/modify` with body `{ addLabelIds, removeLabelIds }`; intentKeywords: "mark read", "add label", "archive".

**Slack** – add operations (same service `id: "slack"`):

- **Create channel** (`slack-create-channel`): POST `https://slack.com/api/conversations.create`; params: `name`, `is_private` (optional); intentKeywords: "create channel", "create slack channel", "new channel".
- **Invite to channel** (`slack-invite-to-channel`): POST `https://slack.com/api/conversations.invite`; params: `channel`, `users` (comma-separated IDs); intentKeywords: "invite to channel", "add user to channel", "add to channel".
- **Read channel history** (`slack-channel-history`): GET `https://slack.com/api/conversations.history`; params: `channel`, `limit` (optional); intentKeywords: "read slack messages", "get channel history", "recent messages", "messages from channel", "slack context".
- Optionally **List channels** (`slack-list-channels`): GET `https://slack.com/api/conversations.list`; params: optional `limit`; intentKeywords: "list channels", "list slack channels".
- Optionally **Add reaction** (`slack-reaction`): POST `https://slack.com/api/reactions.add`; params: `channel`, `timestamp`, `name` (emoji); intentKeywords: "add reaction", "react to message", "emoji".

Keep existing `slack-post` and `slack-invite`; ensure `slack-invite` param is `email` (already is in catalog). Node schema for invite should use `email` (see below).

## 3. Wire discovery and node data to operations

- **stepToNodeType** ([lib/workflow-generator.ts](lib/workflow-generator.ts)): Already maps Gmail/Slack operations to action-email / action-slack; no change needed.
- **stepToNodeData** ([lib/workflow-generator.ts](lib/workflow-generator.ts)):
  - **action-slack**: Derive `operation` and fields from `step.operation?.id` and `step.paramMapping`: e.g. `slack-invite` → `operation: "invite_user"`, `email: step.paramMapping?.email ?? "{{email}}"`; `slack-create-channel` → `operation: "create_channel"`, `channelName`, `isPrivate`; `slack-invite-to-channel` → `invite_to_channel` and channel/users; `slack-channel-history` → `channel_history` with channel, limit; `slack-list-channels` → `list_channels` (if added). Default remains post_message with channel/message from description.
  - **action-email**: If we add list/get, we need an operation field: e.g. `step.operation?.id === "gmail-list"` → `operation: "list"`, `query`, `maxResults`; `gmail-get` → `operation: "get"`, `messageId`. For send (gmail-send, sendgrid-send), keep current behavior (to, subject, body, service).

## 4. Node schemas and UI

- **Slack** ([lib/node-types.ts](lib/node-types.ts), [components/nodes/action-slack-node.tsx](components/nodes/action-slack-node.tsx)):
  - For **invite_user**: use `email` (not `userId`) to match Slack API and catalog. Add optional `email` to schema if not present; keep backward compatibility (map `userId` to `email` in compute if needed).
  - For **create_channel**: add `channelName`, `isPrivate` (boolean) to schema and UI. Show fields when `operation === "create_channel"`.
  - If we add **invite_to_channel**: add `channel`, `users` (or comma-separated input) and a new SelectItem; show when operation is invite_to_channel.
  - For **channel_history** (read messages): add `channel`, `limit` (number, optional) to schema and UI. Output of this step is JSON of messages for use in later steps.
  - For **list_channels** (if added): optional `limit`; output is list of channels.
- **Email** ([lib/node-types.ts](lib/node-types.ts), [components/nodes/action-email-node.tsx](components/nodes/action-email-node.tsx)): If we add Gmail list/get, add `operation: z.enum(["send", "list", "get"])` and optional `query`, `maxResults`, `messageId`. Show service + to/subject/body for send; for list show query + maxResults; for get show messageId. Only Gmail supports list/get; SendGrid stays send-only.

## 5. Compute: implement all Slack operations and Gmail list/get

- **[lib/compute-actions.ts](lib/compute-actions.ts) – Slack**:
  - **invite_user**: POST `users.admin.invite` with `email` from config (align node field to `email`). Use Slack token.
  - **create_channel**: POST `conversations.create` with `name`, `is_private` (optional). Return channel id/name in output.
  - **invite_to_channel** (if added): POST `conversations.invite` with `channel`, `users` (array of user IDs).
  - **channel_history**: GET `conversations.history` with `channel`, `limit` (default e.g. 10). Return messages array (id, text, user, ts, etc.) as JSON in node output so downstream steps can use it.
  - **list_channels** (if added): GET `conversations.list` with optional limit; return channel list in output.
  - **reactions.add** (if added): POST with `channel`, `timestamp`, `name`.
- **Gmail** (if list/get added): In computeActionEmail, branch on config.operation: "send" → current send flow (with Gmail fix from step 1); "list" → GET `.../users/me/messages?q=...&maxResults=...`, return JSON list; "get" → GET `.../users/me/messages/{id}`, return message. Use Gmail token and same connection check.

## 6. Requirement AI

In [lib/requirement-ai.ts](lib/requirement-ai.ts), extend the system prompt (e.g. in the bullet for email and slack) so the model can suggest steps that map to the new operations, e.g.:

- email: "sending emails (welcome, notifications, receipts); optionally list or get emails (Gmail)."
- slack: "posting to channels; inviting users to workspace; creating channels; inviting users to a channel; reading channel history (recent messages) for context; listing channels; adding reactions to messages."

No schema change; discovery and catalog already map step descriptions to operations via intentKeywords and (for HTTP-like) AI.

## 7. Optional: Requirement AI Slack context

So the **requirement chat AI** can use existing Slack messages for context when the user describes a workflow (e.g. "summarize what we said in #support last week"):

- **When**: Only when Slack is connected (token in connections store) and optionally when the user message mentions Slack/channels (or always when connected, with a short summary to limit tokens).
- **What to fetch**: Either (a) channel list only (conversations.list, truncated), or (b) channel list + recent history from one default channel (e.g. #general) with a small limit (e.g. 5–10 messages). Prefer (a) first to avoid token bloat.
- **Where**: Append to the **system prompt** or to a **context block** in the user message, e.g. "Slack channels available: #general, #support, …" or "Recent messages in #general (last 5): …". Keep total length bounded (e.g. 500 chars) so the main prompt is not dominated by Slack data.
- **Scopes**: Slack connection must have `channels:read` (for list); if we include history, `channels:history` (public) or `groups:history` (private) as needed. Document required scopes in Connections or .env.example if applicable.
- **Implementation**: In [lib/requirement-ai.ts](lib/requirement-ai.ts), before calling the model: if Slack token exists, call `conversations.list` (and optionally `conversations.history` for one channel), format a short string, and append to `getSystemPrompt()` or pass as extra user context. Handle errors (e.g. token expired, missing scope) by skipping context and proceeding without Slack data.

Deliverable: Requirement AI can optionally include Slack channel names (and optionally recent message snippets) so it can suggest steps that reference real channels or use prior discussion as context.

## Implementation order

1. Fix Gmail send in compute (unblock real Gmail usage).
2. Add new operations to api-catalog (Gmail list/get; Slack create channel, invite to channel, **channel history**, optionally list channels and reaction).
3. Extend node schemas (Slack: email, channelName, isPrivate, **channel + limit for channel_history**; Email: operation + list/get fields if we add those).
4. Update Slack node UI (invite_user → email; create_channel fields; **channel_history** with channel + limit; optional invite_to_channel, list_channels).
5. Update Email node UI (optional operation + list/get fields).
6. Implement Slack invite_user, create_channel, **channel_history** (and optional invite_to_channel, list_channels, reaction) in computeActionSlack.
7. Implement Gmail list/get in computeActionEmail (branch on operation).
8. Update stepToNodeData so discovered step sets operation and paramMapping for Slack and Email (e.g. slack-invite → invite_user + email; gmail-list → list + query/maxResults).
9. Extend requirement-ai system prompt with new capabilities.
10. **(Optional)** Requirement AI Slack context: when Slack is connected, fetch channel list (and optionally recent history for one channel), append short summary to system or user prompt so the model can reference real channels/messages.

## Files to touch


| Area           | File                                                                             | Change                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute        | [lib/compute-actions.ts](lib/compute-actions.ts)                                 | Gmail send in sendOne; Slack invite_user, create_channel, **channel_history** (and optional invite_to_channel, list_channels, reaction); Gmail list/get branch in computeActionEmail if added        |
| Catalog        | [lib/api-catalog.ts](lib/api-catalog.ts)                                         | New Gmail ops (gmail-list, gmail-get, optional gmail-modify); new Slack ops (slack-create-channel, slack-invite-to-channel, **slack-channel-history**, optional slack-list-channels, slack-reaction) |
| Schemas        | [lib/node-types.ts](lib/node-types.ts)                                           | Slack: email, channelName, isPrivate; optional invite_to_channel fields. Email: operation, query, maxResults, messageId if list/get added                                                            |
| Nodes          | [components/nodes/action-slack-node.tsx](components/nodes/action-slack-node.tsx) | invite_user use email; create_channel fields; optional invite_to_channel UI                                                                                                                          |
| Nodes          | [components/nodes/action-email-node.tsx](components/nodes/action-email-node.tsx) | Optional operation selector and list/get fields (Gmail only)                                                                                                                                         |
| Generator      | [lib/workflow-generator.ts](lib/workflow-generator.ts)                           | stepToNodeData: action-slack from step.operation.id + paramMapping; action-email from step.operation.id when list/get exist                                                                          |
| Requirement AI | [lib/requirement-ai.ts](lib/requirement-ai.ts)                                   | Broader email/slack bullet describing new operations                                                                                                                                                 |


## Scope choice

- **Minimum**: Fix Gmail send; add Slack invite_user and create_channel (catalog + compute + UI + stepToNodeData); align Slack invite field to email.
- **Full**: Above plus Gmail list/get (catalog + email node operation + compute branch); Slack invite_to_channel, **channel history (read messages)**, and optionally list_channels and reaction; requirement-ai prompt update; **optional Requirement AI Slack context** (fetch channels / recent messages for context when user describes a workflow).

Recommend implementing the minimum first, then adding Gmail list/get, Slack read operations (channel_history, list_channels), invite_to_channel, and reaction; finally optional Requirement AI Slack context if desired.