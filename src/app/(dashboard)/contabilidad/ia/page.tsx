"use client";

import { useEffect, useState } from "react";
import {
  getFinanceSummary,
  getFinanceAdvice,
  type FinanceSummary,
} from "@/lib/actions/finance";
import {
  askFinanceAI,
  getAiModeAction,
} from "@/lib/actions/ai";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

type Advice = {
  resumen: string;
  recomendaciones: string[];
  alertas: string[];
};

type ChatTurn = { role: "user" | "model"; content: string };

const SUGGESTIONS = [
  "¿Cómo voy este mes?",
  "¿Qué deuda debería pagar primero?",
  "¿Dónde puedo recortar gastos?",
  "¿Me alcanza para ahorrar?",
];

const WELCOME: ChatTurn = {
  role: "model",
  content:
    "¡Hola! Soy Mitsura AI, tu asistente financiero. Puedo analizar tus ingresos, gastos, deudas y darte recomendaciones. ¿Qué quieres saber?",
};

export default function IaPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(true);
  const [mode, setMode] = useState<"gemini" | "rules">("rules");
  const [messages, setMessages] = useState<ChatTurn[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getAiModeAction().then(setMode);
    getFinanceSummary().then((s) => {
      setSummary(s);
      getFinanceAdvice(s).then(setAdvice);
      setBusy(false);
    });
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    const userTurn: ChatTurn = { role: "user", content: q };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userTurn]);
    setInput("");
    setSending(true);
    try {
      const res = await askFinanceAI(q, history);
      setMessages((prev) => [...prev, { role: "model", content: res.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "Lo siento, hubo un error al procesar tu pregunta. Intenta de nuevo." },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (busy) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Analizando tus finanzas...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Asistente financiero IA</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            mode === "gemini"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-gray-100 text-muted-foreground dark:bg-gray-800 dark:text-gray-300"
          }`}
          title={
            mode === "gemini"
              ? "Usando Google Gemini"
              : "Sin GEMINI_API_KEY. Agrega la key en .env para activar Gemini."
          }
        >
          {mode === "gemini" ? "✦ Gemini activo" : "Modo análisis"}
        </span>
      </div>

      {/* Chat */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex max-h-[420px] min-h-[280px] flex-col gap-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-line rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-bl-sm border border-border bg-muted/40 text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-xl rounded-bl-sm border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0.3s]" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={sending}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntame sobre tus finanzas..."
              className="flex-1 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>

      {/* Análisis */}
      <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm dark:from-blue-950 dark:to-indigo-950">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg dark:bg-indigo-900">
            🤖
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Mitsura AI</p>
            <p className="text-xs text-muted-foreground">
              Analizado sobre {formatCurrency(summary!.totalIncome)} en ingresos y{" "}
              {summary!.activeDebtsCount} deuda(s) activa(s)
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-background/80 p-4 text-sm leading-relaxed text-foreground shadow-sm">
          {advice?.resumen}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recomendaciones
        </h3>
        <div className="flex flex-col gap-2">
          {advice?.recomendaciones.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {i + 1}
              </span>
              <p className="text-sm text-foreground leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas
        </h3>
        <div className="flex flex-col gap-2">
          {advice?.alertas.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm dark:bg-amber-900">
                ⚠️
              </span>
              <p className="text-sm text-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
