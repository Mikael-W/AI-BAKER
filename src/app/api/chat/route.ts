import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, stepCountIs, UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/lib/theo/prompt";
import { theoTools } from "@/lib/theo/tools";

export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const aujourdhui = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const result = streamText({
    model: anthropic(MODEL),
    system: `${SYSTEM_PROMPT}\n\n# Date du jour\nNous sommes le ${aujourdhui}. Utilise cette date pour interpréter "demain", "ce week-end" ou un jour précis. Rappel : pour analyser les VENTES passées, appuie-toi sur la période réellement présente dans les données, pas sur cette date.`,
    messages: await convertToModelMessages(messages),
    tools: theoTools,
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
