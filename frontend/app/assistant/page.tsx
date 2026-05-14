import { ChatPanel } from "@/components/assistant/chat-panel";
import { RelocationMap } from "@/components/map/relocation-map";
import { Nav } from "@/components/nav";

export default function AssistantPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[430px_1fr]">
        <section>
          <h1 className="text-2xl font-semibold">Conversational relocation assistant</h1>
          <p className="mt-2 text-sm leading-6 text-foreground/65">
            Ask about office proximity, late-night commute, locality tradeoffs, negotiated rents, and internet reliability.
          </p>
          <div className="mt-4">
            <ChatPanel />
          </div>
        </section>
        <RelocationMap />
      </main>
    </>
  );
}
