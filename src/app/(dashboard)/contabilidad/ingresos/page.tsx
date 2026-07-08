"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getFinanceRecords,
  createFinanceRecord,
  deleteFinanceRecord,
  type FinanceRecordData,
} from "@/lib/actions/finance";

type Record = {
  id: string;
  type: string;
  amount: number;
  description: string;
  category: string | null;
  date: string;
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function IngresosPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [form, setForm] = useState({
    amount: "",
    description: "",
    category: "",
    date: "",
  });

  const fetchRecords = useCallback(async () => {
    const data = await getFinanceRecords("income");
    setRecords(data as unknown as Record[]);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || !form.description.trim()) return;

    const data: FinanceRecordData = {
      type: "income",
      amount,
      description: form.description.trim(),
      category: form.category.trim() || undefined,
      date: form.date ? new Date(form.date) : undefined,
    };

    await createFinanceRecord(data);
    setForm({ amount: "", description: "", category: "", date: "" });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    await deleteFinanceRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Ingresos</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Cantidad</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Descripción</label>
          <input
            type="text"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej: Salario"
            className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Categoría</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Ej: Nómina"
            className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Fecha</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Añadir
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/70 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3.5">Fecha</th>
              <th className="px-5 py-3.5">Descripción</th>
              <th className="px-5 py-3.5">Categoría</th>
              <th className="px-5 py-3.5">Importe</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-16 text-center text-sm text-muted-foreground"
                >
                  No hay ingresos registrados
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b last:border-0 transition-colors hover:bg-emerald-50/40"
                >
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {formatDate(record.date)}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    {record.description}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {record.category ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-emerald-600">
                    {formatCurrency(record.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
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
