import { isMockMode } from "@/lib/qloo/client";
import { GEMINI_MODEL } from "@/lib/agent/runner";

export async function GET() {
  return Response.json({
    qloo: isMockMode() ? "mock" : "live",
    llm: process.env.GEMINI_API_KEY ? GEMINI_MODEL : null,
  });
}
