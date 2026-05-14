"use client";

import { FormEvent, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import styles from "./chat-panel.module.css";

type Message = { role: "user" | "assistant"; content: string };

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Tell me your office location, budget, commute preference, and what kind of life you want nearby." }
  ]);
  const [input, setInput] = useState("Need PG near office with metro connectivity and safe late-night commute.");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = input.trim();
    if (!next) return;
    setMessages((current) => [...current, { role: "user", content: next }]);
    setInput("");
    setIsLoading(true);
    try {
      const response = await api.chat(next);
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.messages}>
        {messages.map((message, index) => (
          <div key={index} className={`${styles.messageRow} ${message.role === "user" ? styles.fromUser : styles.fromAssistant}`}>
            <div className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && <div className={styles.loading}>Thinking through tradeoffs...</div>}
      </div>
      <form onSubmit={onSubmit} className={styles.form}>
        <Input value={input} onChange={(event) => setInput(event.target.value)} aria-label="Assistant message" />
        <Button type="submit" size="icon" aria-label="Send">
          <SendHorizonal size={18} />
        </Button>
      </form>
    </Card>
  );
}
