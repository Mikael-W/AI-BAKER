import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, stepCountIs, UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/lib/theo/prompt";
import { theoTools } from "@/lib/theo/tools";

export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: theoTools,
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
