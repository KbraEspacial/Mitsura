"use client";

/**
 * Seccion de conciliacion de Mitsura AI.
 *
 * Reune las dos formas de cuadrar las cuentas:
 *   1. El agente revisa los registros y explica que ve mal.
 *   2. El estado de cuenta del banco se contrasta renglon por renglon.
 *
 * Ninguna de las dos escribe nada sin que el usuario lo confirme.
 */

import { useState } from "react";
import {
  runReconcileAgent,
  type ReconcileReport,
} from "@/lib/actions/reconcile-agent";
import {
  previewStatement,
  applyStatement,
  type PreviewConciliacion,
} from "@/lib/actions/auto-reconcile";
import {
  getFinanceProposals,
  applyFinanceProposal,
  type Proposal,
} from "@/lib/actions/finance-proposals";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const EJEMPLO = `26/09/2026  -14.550  D1 Snacks
26/09/2026  -40.000  Pinchos
26/09/2026  +150.000  Prestamo Mami`;

const SEVERIDAD: Record<string, string> = {
  alta: "border-red-400/40 bg-red-500/5",
  media: "border-amber-400/40 bg-amber-500/5",
  baja: "border-border bg-muted/30",
};

export default function MitsuraConciliacion({
  saldoReal,
  onListo,
}: {
  saldoReal: number;
  onListo: () => void;
}) {
  const [pestana, setPestana] = useState<"agente" | "banco" | "propuestas">("banco");

  // --- Propuestas de mejora ---
  const [propuestas, setPropuestas] = useState<Proposal[]>([]);
  const [cargandoPropuestas, setCargandoPropuestas] = useState(false);
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const [errorPropuesta, setErrorPropuesta] = useState<string | null>(null);

  const propuestasAccionables = propuestas.filter((p) => p.actionable).length;

  // --- Agente ---
  const [reporte, setReporte] = useState<ReconcileReport | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [errorAgente, setErrorAgente] = useState<string | null>(null);

  // --- Estado de cuenta ---
  const [texto, setTexto] = useState("");
  const [saldo, setSaldo] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [preview, setPreview] = useState<PreviewConciliacion | null>(null);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [fijarSaldo, setFijarSaldo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function correrAgente() {
    setCorriendo(true);
    setErrorAgente(null);
    try {
      setReporte(await runReconcileAgent());
    } catch (e) {
      setErrorAgente(e instanceof Error ? e.message : "No pude correr el analisis.");
    } finally {
      setCorriendo(false);
    }
  }

  async function analizar() {
    setError(null);
    const monto = Number(saldo);
    if (!Number.isFinite(monto)) {
      setError("Escribe el saldo que te muestra el banco.");
      return;
    }
    setAnalizando(true);
    try {
      const r = await previewStatement(texto, monto);
      if (!r.ok) {
        setError(r.error ?? "No pude leer el estado de cuenta.");
        setPreview(null);
        return;
      }
      setPreview(r);
      setElegidos(new Set(r.movimientos.map((m) => m.indice)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setAnalizando(false);
    }
  }

  async function aplicar() {
    if (!preview) return;
    setAplicando(true);
    setError(null);
    try {
      const r = await applyStatement({
        statement: texto,
        saldoBanco: Number(saldo),
        indices: [...elegidos],
        fijarSaldo,
      });
      setPreview(null);
      setTexto("");
      setSaldo("");
      setElegidos(new Set());
      onListo();
      window.alert(
        `Listo: cree ${r.creados} movimiento(s)` +
          (r.anclaCreada ? ` y fije el saldo en ${fmt(r.saldoBanco)}.` : "."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setAplicando(false);
    }
  }

  const alternar = (i: number) =>
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const cargarPropuestas = async () => {
    setCargandoPropuestas(true);
    setErrorPropuesta(null);
    try {
      setPropuestas(await getFinanceProposals());
    } catch (e) {
      setErrorPropuesta(e instanceof Error ? e.message : "No se pudieron cargar");
    } finally {
      setCargandoPropuestas(false);
    }
  };

  const aplicarPropuesta = async (id: string) => {
    setAplicandoId(id);
    setErrorPropuesta(null);
    try {
      const r = await applyFinanceProposal(id);
      if (!r.ok) {
        setErrorPropuesta(r.message);
        return;
      }
      // la propuesta ya no aplica: recargamos la lista
      setPropuestas(await getFinanceProposals());
      onListo();
    } catch (e) {
      setErrorPropuesta(e instanceof Error ? e.message : "No se pudo aplicar");
    } finally {
      setAplicandoId(null);
    }
  };

  const tab = (
    id: "agente" | "banco" | "propuestas",
    texto: string,
  ) => (
    <button
      onClick={() => setPestana(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        pestana === id
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {texto}
      {id === "propuestas" && propuestasAccionables > 0 && (
        <span className="ml-1.5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] text-white">
          {propuestasAccionables}
        </span>
      )}
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-indigo-50 to-blue-50 p-5 shadow-sm dark:from-indigo-950 dark:to-blue-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Conciliar mis cuentas</p>
          <p className="text-xs text-muted-foreground">
            Saldo real ahora: <strong className="text-foreground">{fmt(saldoReal)}</strong>
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-background/60 p-1">
          {tab("banco", "Con el banco")}
          {tab("agente", "Revisar registros")}
          {tab("propuestas", "Mejoras")}
        </div>
      </div>

      {pestana === "propuestas" ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cambios concretos que mecejoran tus presupuestos. Cada uno es un cambio real en tus datos, asi
            que solo se aplica cuando lo apruebas tu.
          </p>

          {errorPropuesta && (
            <p className="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-400">
              {errorPropuesta}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={cargarPropuestas}
              disabled={cargandoPropuestas}
              className="rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background disabled:opacity-50"
            >
              {cargandoPropuestas ? "Analizando..." : "Buscar mejoras"}
            </button>
            {propuestas.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {propuestas.filter((p) => p.actionable).length} se pueden aplicar, {propuestas.length - propuestas.filter((p) => p.actionable).length} son solo consejo
              </span>
            )}
          </div>

          {propuestas.length > 0 && (
            <div className="space-y-2">
              {propuestas.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-background/70 p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{p.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{p.detail}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">{p.impact}</p>
                    </div>
                    {p.actionable ? (
                      <button
                        onClick={() => aplicarPropuesta(p.id)}
                        disabled={aplicandoId === p.id}
                        className="shrink-0 rounded-lg border border-indigo-300 bg-background px-3 py-1.5 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                      >
                        {aplicandoId === p.id ? "Aplicando..." : "Aplicar"}
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                        Consejo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : pestana === "banco" ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Copia los movimientos desde la app de tu banco y pega aqui el saldo que te reporta. Yo los
            emparejo con lo que ya tienes, te digo que falta y que sobra, y solo creo lo que marques.
          </p>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-foreground">Saldo del banco</span>
              <input
                type="number"
                inputMode="numeric"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="140100"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-foreground">
                Movimientos (uno por linea)
              </span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={5}
                placeholder={EJEMPLO}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground"
              />
            </label>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Acepta <code className="text-foreground">26/09/2026 -40.000 Pinchos</code>, separadores{" "}
            <code className="text-foreground">|</code> o <code className="text-foreground">;</code> y formatos{" "}
            <code className="text-foreground">1,300,000.00</code>. Sin signo, todo se toma como gasto.
          </p>

          <button
            onClick={analizar}
            disabled={analizando || !texto.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {analizando ? "Analizando..." : "Analizar"}
          </button>

          {preview && (
            <div className="space-y-3 rounded-lg border border-border bg-background/70 p-3.5">
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  ["Leidos", preview.parseadas, ""],
                  ["Ya estaban", preview.conciliadas, "text-emerald-600"],
                  ["Faltan", preview.faltantes, "text-amber-600"],
                  ["Sobran", preview.sobrantes, "text-sky-600"],
                  ["Duplicados", preview.duplicados, "text-red-600"],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="rounded-md bg-muted/60 px-1 py-2">
                    <div className={`text-base font-bold ${color}`}>{value as number}</div>
                    <div className="text-[9px] leading-tight text-muted-foreground">{label as string}</div>
                  </div>
                ))}
              </div>

              {preview.lineasConError.length > 0 && (
                <details className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    {preview.lineasConError.length} linea(s) no se pudieron leer
                  </summary>
                  <ul className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    {preview.lineasConError.map((e, i) => (
                      <li key={i}>
                        <code>{e.line}</code> — {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {preview.movimientos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-foreground">
                    Crearia {elegidos.size} de {preview.movimientos.length} movimientos
                  </p>
                  <ul className="max-h-52 space-y-1 overflow-y-auto pr-1">
                    {preview.movimientos.map((m) => (
                      <li key={m.indice}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-1.5 hover:bg-accent">
                          <input
                            type="checkbox"
                            checked={elegidos.has(m.indice)}
                            onChange={() => alternar(m.indice)}
                            className="accent-foreground"
                          />
                          <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{m.date}</span>
                          <span
                            className={`w-20 shrink-0 text-[11px] font-semibold ${
                              m.direction === "in" ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {m.direction === "in" ? "+" : "−"}
                            {fmt(m.amount).replace(/[^0-9]/g, "")}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                            {m.description}
                          </span>
                          <span className="shrink-0 text-[9px] text-muted-foreground">
                            {m.category ?? "sin categoría"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.detalleConciliadas.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    Ver los {preview.detalleConciliadas.length} ya emparejados
                  </summary>
                  <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-[10px]">
                    {preview.detalleConciliadas.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <span className="w-16 shrink-0">{c.fechaBanco}</span>
                        <span className="w-20 shrink-0">{fmt(c.monto)}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {c.banco} = {c.app}
                        </span>
                        <span className={c.confianza === "alta" ? "text-emerald-600" : "text-amber-600"}>
                          {c.confianza}
                          {c.dias > 0 ? ` ${c.dias}d` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {preview.detalleSobrantes.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-[11px] font-medium text-sky-600">
                    {preview.sobrantes} en la app que no aparecen en este extracto
                  </summary>
                  <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-[10px] text-muted-foreground">
                    {preview.detalleSobrantes.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-16 shrink-0">{new Date(s.date).toISOString().slice(0, 10)}</span>
                        <span className="w-20 shrink-0">{fmt(s.amount)}</span>
                        <span className="min-w-0 flex-1 truncate">{s.description}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    No los borro: pueden ser de otra fecha o de otra cuenta.
                  </p>
                </details>
              )}

              <label className="flex items-center gap-2.5 rounded-md bg-muted/60 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={fijarSaldo}
                  onChange={(e) => setFijarSaldo(e.target.checked)}
                  className="accent-foreground"
                />
                <span className="text-[11px] text-foreground">
                  Fijar el saldo real en <strong>{fmt(preview.saldoBanco)}</strong> (el del banco).
                </span>
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-muted-foreground">
                  Se crearan <strong>{elegidos.size}</strong> movimiento(s).
                </p>
                <button
                  onClick={aplicar}
                  disabled={aplicando || (elegidos.size === 0 && !fijarSaldo)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aplicando ? "Aplicando..." : "Aplicar"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Reviso tus registros con reglas deterministicas y le pido al agente que me explique lo que ve.
            No modifica nada: solo propone.
          </p>

          {errorAgente && (
            <p className="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-400">
              {errorAgente}
            </p>
          )}

          <button
            onClick={correrAgente}
            disabled={corriendo}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {corriendo ? "Analizando..." : "Revisar mis registros"}
          </button>

          {reporte && (
            <div className="space-y-3 rounded-lg border border-border bg-background/70 p-3.5">
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  ["Saldo real", reporte.saldoReal, ""],
                  ["Ancla", reporte.base, ""],
                  ["Desde el ancla", reporte.movements, ""],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-md bg-muted/60 px-1 py-2">
                    <div className="text-[11px] font-bold text-foreground">
                      {fmt(value as number)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">{label as string}</div>
                  </div>
                ))}
              </div>

              {reporte.findings.length === 0 ? (
                <p className="rounded-md bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                  No detecte anomalias. Los registros se ven consistentes.
                </p>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-foreground">
                    {reporte.findings.length} hallazgo(s)
                  </p>
                  <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {reporte.findings.map((f, i) => (
                      <li
                        key={i}
                        className={`rounded-md border px-2.5 py-2 ${SEVERIDAD[f.severity] ?? SEVERIDAD.baja}`}
                      >
                        <p className="text-[11px] font-medium text-foreground">{f.title}</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{f.detail}</p>
                        {f.impact !== 0 && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                            Impacto: {fmt(f.impact)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {reporte.agentComment && (
                <div className="rounded-md bg-background p-3 text-[11px] leading-relaxed text-foreground">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Lectura del agente
                  </p>
                  {reporte.agentComment}
                </div>
              )}

              {!reporte.agentAvailable && (
                <p className="text-[10px] text-muted-foreground">
                  El agente no respondio (falta NVIDIA_API_KEY o GEMINI_API_KEY en el servidor). Los hallazgos
                  de arriba se calculan sin IA.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
