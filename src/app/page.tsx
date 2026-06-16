"use client";

import { useChat } from "@ai-sdk/react";
import {
  isToolUIPart,
  getToolName,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useEffect, useRef, useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  consulterStock: "📦 consulte le stock",
  consulterCatalogue: "🥖 consulte le catalogue",
  consulterVentes: "📊 analyse les ventes",
  envoyerCommandeFournisseur: "📧 envoie la commande",
  planAntiGaspi: "♻️ plan anti-gaspillage",
  prevoirProduction: "🥖 prévoit la production",
};

const SUGGESTIONS = [
  "Combien je prépare demain matin ?",
  "Il me reste combien de beurre ? Faut que je commande ?",
  "Quels produits partent le mieux en ce moment ?",
  "C'est quoi ma marge sur les éclairs au chocolat ?",
  "Il me reste 30 croissants ce soir, aide-moi à les écouler !",
  "Commande 50 kg de farine T65 chez Minoterie Dupont",
];

export default function Home() {
  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, busy]);

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

      <section className="chat__messages" ref={messagesRef}>
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
              if (isToolUIPart(part)) {
                const name = getToolName(part);
                const label = TOOL_LABELS[name] ?? `🔧 ${name}`;

                if (part.state === "approval-requested") {
                  const commande = part.input as {
                    ingredient?: string;
                    quantite?: number;
                    objet?: string;
                  };
                  return (
                    <span key={index} className="approval">
                      <span className="approval__title">
                        📧 Envoyer la commande
                        {commande.quantite
                          ? ` (${commande.quantite} ${commande.ingredient ?? ""})`
                          : ""}{" "}
                        à ton fournisseur ?
                      </span>
                      {commande.objet && (
                        <span className="approval__obj">Objet : {commande.objet}</span>
                      )}
                      <span className="approval__actions">
                        <button
                          onClick={() =>
                            addToolApprovalResponse({
                              id: part.approval.id,
                              approved: true,
                            })
                          }
                        >
                          Confirmer l'envoi
                        </button>
                        <button
                          className="approval__cancel"
                          onClick={() =>
                            addToolApprovalResponse({
                              id: part.approval.id,
                              approved: false,
                            })
                          }
                        >
                          Annuler
                        </button>
                      </span>
                    </span>
                  );
                }

                const done = part.state === "output-available";
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
