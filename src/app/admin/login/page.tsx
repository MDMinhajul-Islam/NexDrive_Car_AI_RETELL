import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function AdminLoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-white">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-2xl sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">For NexDrive staff only.</p>
          <LoginForm
            next={typeof next === "string" ? next : undefined}
            notice={
              error === "not_admin"
                ? "You are signed in, but this account does not have admin access. Sign in with an admin account."
                : undefined
            }
          />
        </div>
        <Link
          href="/"
          className="mt-4 flex min-h-11 items-center justify-center gap-2 text-sm text-neutral-300 hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the website
        </Link>
      </div>
    </main>
  );
}
