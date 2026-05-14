import { ChatPanel } from "@/components/assistant/chat-panel";
import { RelocationMap } from "@/components/map/relocation-map";
import { Nav } from "@/components/nav";
import styles from "./page.module.css";

export default function AssistantPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <section>
          <h1 className={styles.title}>Conversational relocation assistant</h1>
          <p className={styles.copy}>
            Ask about office proximity, late-night commute, locality tradeoffs, negotiated rents, and internet reliability.
          </p>
          <div className={styles.panelWrap}>
            <ChatPanel />
          </div>
        </section>
        <RelocationMap />
      </main>
    </>
  );
}
