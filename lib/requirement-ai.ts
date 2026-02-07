import { generateText } from "ai";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import { useConnectionsStore } from "./connections-store";
import { useExamplesStore } from "./examples-store";
import { useOpenApiStore } from "./openapi-store";
import type { RequirementStep } from "./requirement-store";

const SLACK_CONTEXT_MAX_CHARS = 500;

/** Fetch Slack channel list when connected; return short summary for system prompt or empty on error. */
async function getSlackContext(): Promise<string> {
  const token = useConnectionsStore.getState().getConnection("Slack");
  if (!token) return "";
  try {
    const res = await fetch("https://slack.com/api/conversations.list", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 30 }),
    });
    const json = (await res.json()) as { ok?: boolean; channels?: { name?: string }[] };
    if (!json.ok || !Array.isArray(json.channels)) return "";
    const names = json.channels.map((c) => (c.name ? `#${c.name}` : "")).filter(Boolean);
    const str = names.slice(0, 15).join(", ");
    if (!str) return "";
    const line = `\n\nSlack channels available: ${str}. You can reference these in step descriptions when suggesting Slack steps.`;
    return line.slice(0, SLACK_CONTEXT_MAX_CHARS);
  } catch {
    return "";
  }
}

const SYSTEM_BASE = `You are a workflow assistant for an AI-powered business workflow builder. The user describes a business process they want to automate. Your job is to decompose it into a rich, multi-step workflow that showcases real automation.

Rules:
1. If the requirement is clear enough to break into steps, reply with ONLY a valid JSON object (no markdown, no extra text): {"steps":[{"id":"1","description":"...","suggestedService":"..."}, ...]}.
2. Use short step descriptions (e.g. "Send welcome email", "Add user to Slack", "Wait 24 hours", "If amount > 1000 require approval").
3. suggestedService must be one of: "email", "slack", "http", "approval", "delay", "document", "webhook", "schedule", "condition", "transform" when it fits. Use them to produce capable workflows:
   - email: sending emails (welcome, notifications, receipts); optionally list or get emails (Gmail).
   - slack: posting to channels; inviting users to workspace; creating channels; inviting users to a channel; reading channel history (recent messages) for context; listing channels; adding reactions to messages.
   - http: calling APIs (CRM, HR systems, databases), webhooks.
   - approval: human approval gates (expense approval, compliance review, manager sign-off).
   - delay: wait before next step (e.g. "Wait 1 day then send reminder", "Schedule training in 1 week").
   - document: extract or process documents (PDF, forms).
   - webhook: trigger when an external system calls in (e.g. form submission, CRM event).
   - schedule: run on a schedule (daily report, weekly digest).
   - condition: branch logic (if/else: "If approved then send receipt else notify reject").
   - transform: map or reshape data between steps (e.g. "Map form fields to API payload").
4. Prefer 5–10 steps when the process allows. Include at least one of: approval, delay, condition, or transform to show control flow and data handling. For onboarding or multi-system flows, include email + slack + http where relevant.
5. If you need clarification (e.g. which email provider, which systems), ask 1-2 brief questions in plain text. Do not output JSON in that case.
6. Keep all responses concise.`;

function getSystemPrompt(): string {
  let base = SYSTEM_BASE;
  const openApiServices = useOpenApiStore.getState().getServices();
  if (openApiServices.length > 0) {
    const apiList = openApiServices
      .map((s) => `${s.name}: ${s.operations.map((o) => o.name).join(", ")}`)
      .join("; ");
    base += `\n\nAvailable custom APIs: ${apiList}. Prefer suggestedService "http" and step descriptions that match these operations (e.g. "place order" -> Place order).`;
  }
  const examples = useExamplesStore.getState().getExamples();
  if (examples.length === 0) return base;
  const ex = examples[0];
  return `${base}

Example of a good decomposition:
User: "${ex.requirement.slice(0, 200)}..."
Steps (JSON): ${JSON.stringify(ex.steps)}`;
}

export interface RequirementAIResult {
  steps?: RequirementStep[];
  message: string;
}

function getModel() {
  const providerNames = Object.keys(providers);
  for (const name of providerNames) {
    const key = useApiKeysStore.getState().getApiKey(name);
    if (key) {
      const provider = providers[name];
      const modelId = provider.models.includes("gemini-2.5-flash")
        ? "gemini-2.5-flash"
        : provider.models[0];
      return provider.createModel(key, modelId, false);
    }
  }
  return null;
}

export async function requirementToSteps(
  messages: { role: string; content: string }[],
  newUserMessage: string
): Promise<RequirementAIResult> {
  const model = getModel();
  if (!model) {
    return {
      message: "Add an API key (e.g. Google) in the sidebar to use the assistant.",
    };
  }

  const fullMessages = [
    ...messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    { role: "user" as const, content: newUserMessage },
  ];
  const userContent = fullMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

  let systemPrompt = getSystemPrompt();
  const slackContext = await getSlackContext();
  if (slackContext) systemPrompt += slackContext;

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userContent,
  });

  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const steps: RequirementStep[] = parsed.steps.map(
          (s: { id?: string; description?: string; suggestedService?: string }, i: number) => ({
            id: String(s.id ?? i + 1),
            description: String(s.description ?? ""),
            suggestedService: s.suggestedService,
          })
        );
        return { steps, message: trimmed };
      }
    } catch {
      // fall through to return as message
    }
  }
  return { message: trimmed };
}
