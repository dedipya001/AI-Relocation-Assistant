import { config } from "../core/config.js";
import { getOpenAIClient } from "./client.js";

export class LocalityRAG {
  async summarize(localityName: string, evidence: string[]): Promise<string> {
    const client = getOpenAIClient();
    if (!client) {
      return this.fallbackSummary(localityName, evidence);
    }

    try {
      const response = await client.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Create concise relocation intelligence summaries with safety, commute, internet, food, and tradeoffs.",
          },
          {
            role: "user",
            content: `Locality: ${localityName}\nEvidence:\n${evidence.slice(0, 20).join("\n")}`,
          },
        ],
        temperature: 0.2,
      });

      return response.choices[0]?.message?.content || this.fallbackSummary(localityName, evidence);
    } catch {
      return this.fallbackSummary(localityName, evidence);
    }
  }

  private fallbackSummary(localityName: string, evidence: string[]): string {
    if (evidence && evidence.length > 0) {
      return `${localityName} looks promising for office proximity, with mixed signals that need verification from recent reviews.`;
    }
    return `${localityName} has limited evidence so far; rankings should lean more on commute, rent, and crowdsourced feedback.`;
  }
}
