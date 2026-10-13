import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SITE, TIMEZONE } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const rows: [string, string][] = [
    ["Signed in as", admin.email],
    ["Name", admin.fullName || "Not set"],
    ["Role", "Admin"],
    ["Dealership timezone", `${TIMEZONE} (all appointment times and dashboard ranges)`],
    ["Public phone", SITE.phoneDisplay],
    ["Public email", SITE.email],
    ["Showroom address", `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.state} ${SITE.address.zip}`],
  ];
  return (
    <>
      <AdminPageHeader title="Settings" description="Your account and dealership details." />
      <div className="overflow-hidden rounded-2xl border bg-card">
        <dl className="divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-6 py-4 sm:grid-cols-[14rem_1fr]">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Admin access is granted in the database by setting <code className="font-mono">profiles.role</code> to{" "}
        <code className="font-mono">admin</code>. Public contact details are defined in{" "}
        <code className="font-mono">src/lib/constants.ts</code>.
      </p>
    </>
  );
}
