import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar sessionUser={session} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
