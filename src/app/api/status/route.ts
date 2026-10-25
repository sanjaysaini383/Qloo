import { isMockMode } from "@/lib/qloo/client";
import { llmProvider } from "@/lib/agent/runner";

export async function GET() {
  return Response.json({
    qloo: isMockMode() ? "mock" : "live",
    llm: llmProvider()?.model ?? null,
  });
}
