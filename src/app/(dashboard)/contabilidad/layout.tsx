"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/contabilidad", label: "Resumen" },
  { href: "/contabilidad/ingresos", label: "Ingresos" },
  { href: "/contabilidad/gastos", label: "Gastos" },
  { href: "/contabilidad/gastos-fijos", label: "Gastos fijos" },
  { href: "/contabilidad/deudas", label: "Deudas" },
  { href: "/contabilidad/ia", label: "Asistente IA" },
];

export default function ContabilidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background p-1 shadow-sm">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
