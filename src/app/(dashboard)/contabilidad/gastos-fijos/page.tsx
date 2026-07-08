"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  type FixedExpenseData,
} from "@/lib/actions/finance";

type FixedExp = {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  dayDue: number;
  isActive: boolean;
  notes: string | null;
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

export default function GastosFijosPage() {
  const [expenses, setExpenses] = useState<FixedExp[]>([]);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "",
    dayDue: "",
    notes: "",
  });

  const fetchExpenses = useCallback(async () => {
    const data = await getFixedExpenses();
    setExpenses(data as unknown as FixedExp[]);
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    const dayDue = parseInt(form.dayDue);
    if (!amount || !form.name.trim() || !dayDue) return;

    const data: FixedExpenseData = {
      name: form.name.trim(),
      amount,
      category: form.category.trim() || undefined,
      dayDue,
      notes: form.notes.trim() || undefined,
    };

    await createFixedExpense(data);
    setForm({ name: "", amount: "", category: "", dayDue: "", notes: "" });
    fetchExpenses();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await updateFixedExpense(id, { isActive });
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, isActive } : e)));
  };

  const handleDelete = async (id: string) => {
    await deleteFixedExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const totalActive = expenses.filter((e) => e.isActive).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold tracking-tight">Gastos fijos</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Total mensual activo: <span className="font-semibold text-foreground">{formatCurrency(totalActive)}</span>
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Nombre</label>
          <input type="text" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Netflix" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Importe</label>
          <input type="number" step="0.01" min="0" required value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Categoría</label>
          <input type="text" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Ej: Suscripción" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Día vencimiento</label>
          <input type="number" min="1" max="31" required value={form.dayDue}
            onChange={(e) => setForm({ ...form, dayDue: e.target.value })}
            placeholder="15" className="w-20 rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Notas</label>
          <input type="text" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Opcional" className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          Añadir
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/70 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3.5">Nombre</th>
              <th className="px-5 py-3.5">Categoría</th>
              <th className="px-5 py-3.5">Importe</th>
              <th className="px-5 py-3.5">Vence</th>
              <th className="px-5 py-3.5">Activo</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  No hay gastos fijos registrados
                </td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id} className="border-b last:border-0 transition-colors hover:bg-blue-50/40">
                  <td className="px-5 py-3.5 font-medium text-foreground">{exp.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{exp.category ?? "—"}</td>
                  <td className="px-5 py-3.5 font-semibold text-foreground">{formatCurrency(exp.amount)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">Día {exp.dayDue}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleToggle(exp.id, !exp.isActive)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
                        exp.isActive ? "bg-emerald-500 border-emerald-600" : "bg-gray-200 border-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all ${
                          exp.isActive ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
