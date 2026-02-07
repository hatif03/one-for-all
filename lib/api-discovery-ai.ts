import { generateText } from "ai";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import type { CatalogOperation } from "./api-catalog";

const SYSTEM_PROMPT = `You are picking the best API operation for a workflow step. You will be given:
1. A step description (what the user wants to do).
2. A list of available operations (id, name, description, method, path).

Respond with ONLY a valid JSON object, no markdown or extra text. Use exactly one of these shapes:
- If one operation clearly fits the step: {"operationId": "<id from the list>", "paramMapping": {"paramKey": "value or {{placeholder}}"}}
- If no good match: {"operationId": null}

Rules:
- operationId MUST be exactly one of the ids from the list, or null.
- paramMapping is optional; use it to suggest values or placeholders for the operation's parameters.
- Pick the single best matching operation; prefer by semantic fit (e.g. "place an order" -> "Place order" or "POST /store/order").`;

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

/** Compact representation for the prompt to save tokens */
function formatOperation(op: CatalogOperation): string {
  return `id=${op.id} name="${op.name}" method=${op.method} path=${op.urlTemplate} description=${(op.description ?? "").slice(0, 80)}`;
}

export interface SelectOperationResult {
  operationId: string;
  paramMapping?: Record<string, string>;
}

/**
 * Use the LLM to pick the best API operation for a workflow step from a list of candidates.
 * Returns null if no model, no match, or invalid response.
 */
export async function selectOperationByAI(
  stepDescription: string,
  candidateOperations: CatalogOperation[]
): Promise<SelectOperationResult | null> {
  if (candidateOperations.length === 0) return null;

  const model = getModel();
  if (!model) return null;

  const opsList = candidateOperations.map(formatOperation).join("\n");
  const userPrompt = `Step: "${stepDescription}"\n\nAvailable operations:\n${opsList}`;

  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    const trimmed = text.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { operationId?: string | null; paramMapping?: Record<string, string> };
    if (parsed.operationId == null || parsed.operationId === "null") return null;

    const operationId = String(parsed.operationId);
    const valid = candidateOperations.some((op) => op.id === operationId);
    if (!valid) return null;

    return {
      operationId,
      paramMapping: typeof parsed.paramMapping === "object" && parsed.paramMapping ? parsed.paramMapping : undefined,
    };
  } catch {
    return null;
  }
}
