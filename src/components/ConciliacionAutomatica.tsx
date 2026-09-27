"use client";

/**
 * Conciliacion automatica contra el estado de cuenta del banco.
 *
 * El flujo es deliberadamente en dos pasos: primero se analiza y se muestra
 * todo, despues se decide que aplicar. Nunca se escribe nada sin que el
 * usuario haya visto que se va a crear.
 */

import { useState } from "react";
import { previewStatement, applyStatement, type PreviewConciliacion } from "@/lib/actions/auto-reconcile";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const EJEMPLO = `26/09/2026  -14.550  D1 Snacks
26/09/2026  -40.000  Pinchos
26/09/2026  +150.000  Prestamo Mami`;

export default function ConciliacionAutomatica({
  saldoRealActual,
  onListo,
}: {
  saldoRealActual: number;
  onListo: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [saldo, setSaldo] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [preview, setPreview] = useState<PreviewConciliacion | null>(null);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [fijarSaldo, setFijarSaldo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setAbierto(false);
    setPreview(null);
    setError(null);
    setElegidos(new Set());
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
      // Por defecto proponemos crear todo lo que falta; el usuario puede quitar.
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
      cerrar();
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

  const alternar = (i: number) => {
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        Conciliar con el banco
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={cerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Conciliacion con el banco</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pega los movimientos de tu app bancaria y el saldo que te reporta. Yo los emparejo con lo que
              tienes aqui.
            </p>
          </div>
          <button
            onClick={cerrar}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Cerrar
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">Saldo que te muestra el banco</span>
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
            <span className="mb-1 block text-xs font-medium text-foreground">
              Movimientos del estado de cuenta (uno por linea)
            </span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              placeholder={EJEMPLO}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
          </label>

          <p className="text-[11px] text-muted-foreground">
            Acepta <code className="text-foreground">26/09/2026 -40.000 Pinchos</code>, separadores{" "}
            <code className="text-foreground">|</code> o <code className="text-foreground">;</code>, y formatos{" "}
            <code className="text-foreground">1,300,000.00</code>. Sin signo, todo se toma como gasto.
          </p>

          <button
            onClick={analizar}
            disabled={analizando || !texto.trim()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {analizando ? "Analizando..." : "Analizar"}
          </button>
        </div>

        {preview && (
          <div className="mt-6 space-y-4 border-t border-border pt-5">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
              {[
                ["Leidos", preview.parseadas, ""],
                ["Ya estaban", preview.conciliadas, "text-emerald-600"],
                ["Faltan", preview.faltantes, "text-amber-600"],
                ["Sobran aqui", preview.sobrantes, "text-sky-600"],
                ["Duplicados", preview.duplicados, "text-red-600"],
              ].map(([label, value, color]) => (
                <div key={label as string} className="rounded-lg bg-muted px-2 py-2.5">
                  <div className={`text-lg font-bold ${color}`}>{value as number}</div>
                  <div className="text-[10px] text-muted-foreground">{label as string}</div>
                </div>
              ))}
            </div>

            {preview.lineasConError.length > 0 && (
              <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
                <summary className="cursor-pointer text-xs font-medium text-amber-700 dark:text-amber-400">
                  {preview.lineasConError.length} linea(s) no se pudieron leer
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
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
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  Movimientos que crearia ({elegidos.size} de {preview.movimientos.length} marcados)
                </h4>
                <ul className="space-y-1.5">
                  {preview.movimientos.map((m) => (
                    <li key={m.indice}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={elegidos.has(m.indice)}
                          onChange={() => alternar(m.indice)}
                          className="accent-foreground"
                        />
                        <span className="w-20 shrink-0 text-xs text-muted-foreground">{m.date}</span>
                        <span
                          className={`w-24 shrink-0 text-xs font-semibold ${m.direction === "in" ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {m.direction === "in" ? "+" : "-"}
                          {fmt(m.amount).replace("$", "")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{m.description}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
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
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Ver los {preview.detalleConciliadas.length} ya emparejados
                </summary>
                <ul className="mt-2 space-y-1 text-[11px]">
                  {preview.detalleConciliadas.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-20 shrink-0">{c.fechaBanco}</span>
                      <span className="w-24 shrink-0">{fmt(c.monto)}</span>
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
                <summary className="cursor-pointer text-xs font-medium text-sky-600">
                  {preview.sobrantes} en la app que no aparecen en este estado de cuenta
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {preview.detalleSobrantes.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-20 shrink-0">{new Date(s.date).toISOString().slice(0, 10)}</span>
                      <span className="w-24 shrink-0">{fmt(s.amount)}</span>
                      <span className="min-w-0 flex-1 truncate">{s.description}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  No los borro: pueden ser de otra fecha o de otra cuenta.
                </p>
              </details>
            )}

            <label className="flex items-center gap-2.5 rounded-lg bg-muted px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={fijarSaldo}
                onChange={(e) => setFijarSaldo(e.target.checked)}
                className="accent-foreground"
              />
              <span className="text-xs text-foreground">
                Fijar el saldo real en <strong>{fmt(preview.saldoBanco)}</strong> (el del banco). Hoy la app
                muestra <strong>{fmt(saldoRealActual)}</strong>.
              </span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Se crearan <strong>{elegidos.size}</strong> movimiento(s).
              </p>
              <button
                onClick={aplicar}
                disabled={aplicando || (elegidos.size === 0 && !fijarSaldo)}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {aplicando ? "Aplicando..." : "Aplicar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
