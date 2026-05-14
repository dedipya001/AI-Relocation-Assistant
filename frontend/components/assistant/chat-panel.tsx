"use client";

import { FormEvent, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

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
    <Card className="flex min-h-[620px] flex-col p-4">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 ${message.role === "user" ? "bg-primary text-white" : "bg-muted"}`}>
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && <div className="rounded-lg bg-muted px-3 py-2 text-sm">Thinking through tradeoffs...</div>}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <Input value={input} onChange={(event) => setInput(event.target.value)} aria-label="Assistant message" />
        <Button type="submit" size="icon" aria-label="Send">
          <SendHorizonal size={18} />
        </Button>
      </form>
    </Card>
  );
}
