from app.ai.client import get_openai_client
from app.core.config import settings


class LocalityRAG:
    async def summarize(self, locality_name: str, evidence: list[str]) -> str:
        client = get_openai_client()
        if not client:
            return self._fallback_summary(locality_name, evidence)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Create concise relocation intelligence summaries with safety, commute, internet, food, and tradeoffs.",
                },
                {
                    "role": "user",
                    "content": f"Locality: {locality_name}\nEvidence:\n" + "\n".join(evidence[:20]),
                },
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content or self._fallback_summary(locality_name, evidence)

    def _fallback_summary(self, locality_name: str, evidence: list[str]) -> str:
        if evidence:
            return f"{locality_name} looks promising for office proximity, with mixed signals that need verification from recent reviews."
        return f"{locality_name} has limited evidence so far; rankings should lean more on commute, rent, and crowdsourced feedback."
