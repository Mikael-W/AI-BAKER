"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  consulterStock: "📦 consulte le stock",
  consulterCatalogue: "🥖 consulte le catalogue",
  consulterVentes: "📊 analyse les ventes",
  envoyerCommandeFournisseur: "📧 envoie la commande",
  planAntiGaspi: "♻️ plan anti-gaspillage",
};

const SUGGESTIONS = [
  "Il me reste combien de beurre ? Faut que je commande ?",
  "Combien de croissants j'ai vendu la semaine dernière ?",
  "C'est quoi ma marge sur les éclairs au chocolat ?",
];

export default function Home() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <main className="chat">
      <header className="chat__header">
        <span className="chat__avatar">🥐</span>
        <div>
          <h1>Théo</h1>
          <p>l'assistant de Chez Madeleine</p>
        </div>
      </header>

      <section className="chat__messages">
        {messages.length === 0 && (
          <div className="chat__welcome">
            <p>
              Bonjour Madeleine ! C'est Théo. Demande-moi ce que tu veux sur tes
              stocks, tes ventes ou tes produits.
            </p>
            <div className="chat__suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`bubble bubble--${message.role}`}>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return <span key={index}>{part.text}</span>;
              }
              if (part.type.startsWith("tool-")) {
                const name = part.type.slice("tool-".length);
                const label = TOOL_LABELS[name] ?? `🔧 ${name}`;
                const done = "output" in part && part.output !== undefined;
                return (
                  <span key={index} className="tool-chip">
                    {label} {done ? "✓" : "…"}
                  </span>
                );
              }
              return null;
            })}
          </div>
        ))}

        {busy && <div className="bubble bubble--assistant">Théo réfléchit…</div>}
      </section>

      <form
        className="chat__input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écris à Théo…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Envoyer
        </button>
      </form>
    </main>
  );
}
