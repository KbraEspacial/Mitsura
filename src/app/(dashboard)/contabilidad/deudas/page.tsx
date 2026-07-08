"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDebts,
  createDebt,
  deleteDebt,
  addDebtPayment,
  type DebtData,
} from "@/lib/actions/finance";

type DebtItem = {
  id: string;
  name: string;
  totalAmount: number;
  paidAmount: number;
  interestRate: number | null;
  dueDate: string | null;
  notes: string | null;
  isActive: boolean;
  _count: { payments: number };
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

const formatDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function DeudasPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [form, setForm] = useState({
    name: "",
    totalAmount: "",
    interestRate: "",
    dueDate: "",
    notes: "",
  });
  const [paymentInput, setPaymentInput] = useState<Record<string, string>>({});

  const fetchDebts = useCallback(async () => {
    const data = await getDebts();
    setDebts(data as unknown as DebtItem[]);
  }, []);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = parseFloat(form.totalAmount);
    if (!totalAmount || !form.name.trim()) return;

    const data: DebtData = {
      name: form.name.trim(),
      totalAmount,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
      dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
      notes: form.notes.trim() || undefined,
    };

    await createDebt(data);
    setForm({ name: "", totalAmount: "", interestRate: "", dueDate: "", notes: "" });
    fetchDebts();
  };

  const handleAddPayment = async (debtId: string) => {
    const amount = parseFloat(paymentInput[debtId] || "");
    if (!amount || amount <= 0) return;
    await addDebtPayment(debtId, amount);
    setPaymentInput((prev) => ({ ...prev, [debtId]: "" }));
    fetchDebts();
  };

  const handleDelete = async (id: string) => {
    await deleteDebt(id);
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Deudas</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Nombre</label>
          <input type="text" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Préstamo coche" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Total</label>
          <input type="number" step="0.01" min="0" required value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            placeholder="0.00" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Interés %</label>
          <input type="number" step="0.1" min="0" value={form.interestRate}
            onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
            placeholder="5.0" className="w-20 rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Vencimiento</label>
          <input type="date" value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Notas</label>
          <input type="text" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Opcional" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
          Añadir
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {debts.length === 0 ? (
          <div className="rounded-xl border border-border bg-white py-16 text-center text-sm text-muted-foreground">
            No hay deudas registradas
          </div>
        ) : (
          debts.map((debt) => {
            const remaining = debt.totalAmount - debt.paidAmount;
            const pct = debt.totalAmount > 0 ? (debt.paidAmount / debt.totalAmount) * 100 : 0;
            return (
              <div key={debt.id} className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{debt.name}</h3>
                      {!debt.isActive && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-muted-foreground">Pagada</span>
                      )}
                    </div>
                    {debt.notes && <p className="mt-0.5 text-xs text-muted-foreground">{debt.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium text-foreground text-right">{formatCurrency(debt.totalAmount)}</span>
                  <span className="text-muted-foreground">Pagado:</span>
                  <span className="font-medium text-emerald-600 text-right">{formatCurrency(debt.paidAmount)}</span>
                  <span className="text-muted-foreground">Restante:</span>
                  <span className={`font-semibold text-right ${remaining > 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {formatCurrency(remaining)}
                  </span>
                  {debt.interestRate != null && (
                    <>
                      <span className="text-muted-foreground">Interés:</span>
                      <span className="font-medium text-foreground text-right">{debt.interestRate}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Vence:</span>
                  <span className="font-medium text-foreground text-right">{formatDate(debt.dueDate)}</span>
                </div>

                <div className="mt-3">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{Math.round(pct)}% pagado</p>
                </div>

                {debt.isActive && (
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentInput[debt.id] ?? ""}
                      onChange={(e) => setPaymentInput((prev) => ({ ...prev, [debt.id]: e.target.value }))}
                      placeholder="Importe del pago..."
                      className="flex-1 rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleAddPayment(debt.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                      + Pago
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
