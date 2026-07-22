"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getFinanceRecords,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  getCategories,
  exportFinanceToCSV,
  type FinanceRecordData,
  type CategoryInfo,
} from "@/lib/actions/finance";

type Record = {
  id: string;
  type: string;
  amount: number;
  description: string;
  category: string | null;
  date: Date;
};

type RecordForm = {
  amount: string;
  description: string;
  category: string;
  date: string;
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

const toInputDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const emptyForm = (): RecordForm => ({ amount: "", description: "", category: "", date: "" });

export default function GastosPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [form, setForm] = useState<RecordForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const fetchRecords = useCallback(async () => {
    const data = await getFinanceRecords("expense");
    setRecords(data as unknown as Record[]);
  }, []);

  useEffect(() => {
    fetchRecords();
    getCategories().then(setCategories);
  }, [fetchRecords]);

  const filteredRecords = records.filter((r) => {
    if (dateFrom && new Date(r.date) < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo) {
      const end = new Date(dateTo + "T23:59:59");
      if (new Date(r.date) > end) return false;
    }
    if (catFilter && (r.category ?? "Sin categoría") !== catFilter) return false;
    return true;
  });

  const totalFiltered = filteredRecords.reduce((s, r) => s + r.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || !form.description.trim()) return;

    const data: FinanceRecordData = {
      type: "expense",
      amount,
      description: form.description.trim(),
      category: form.category.trim() || undefined,
      date: form.date ? new Date(form.date + "T00:00:00") : undefined,
    };

    if (editingId) {
      await updateFinanceRecord(editingId, data as any);
      setEditingId(null);
    } else {
      await createFinanceRecord(data);
    }
    setForm(emptyForm());
    fetchRecords();
  };

  const handleEdit = (r: Record) => {
    setEditingId(r.id);
    setForm({
      amount: r.amount.toString(),
      description: r.description,
      category: r.category ?? "",
      date: toInputDate(new Date(r.date)),
    });
  };

  const handleDelete = async (id: string) => {
    await deleteFinanceRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleExport = async () => {
    const csv = await exportFinanceToCSV("expense");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">
          {editingId ? "Editar gasto" : "Gastos"}
        </h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar CSV
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4 shadow-sm"
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
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Descripción</label>
          <input
            type="text"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej: Compra supermercado"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Categoría</label>
          <div className="flex gap-1">
            <input
              type="text"
              list="cat-list-expense"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Ej: Alimentación"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="cat-list-expense">
              {categories.filter((c) => c.name !== "Sin categoría").map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Fecha</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          {editingId ? "Guardar" : "Añadir"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="rounded-lg border border-input px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        )}
      </form>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-medium text-muted-foreground">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-medium text-muted-foreground">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-medium text-muted-foreground">Categoría</label>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        {(dateFrom || dateTo || catFilter) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setCatFilter(""); }}
            className="self-end rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
        <div className="ml-auto self-end text-xs text-muted-foreground">
          {filteredRecords.length} registros · total {formatCurrency(totalFiltered)}
        </div>
      </div>

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
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  No hay gastos registrados
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className="border-b last:border-0 transition-colors hover:bg-red-50/40"
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
                  <td className="px-5 py-3.5 font-semibold text-red-500">
                    {formatCurrency(record.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(record)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
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
