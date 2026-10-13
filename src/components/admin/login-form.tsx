"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldA11y, FormField } from "@/components/site/form-field";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [formError, setFormError] = useState<string | null>(notice ?? null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // On success the action redirects, so a return value always means failure.
    const result = await signIn(values, next);
    if (result && !result.ok) {
      setFormError(result.message);
      toast.error(result.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={isSubmitting}>
      <FormField id="login-email" label="Email" error={errors.email?.message}>
        <Input
          {...register("email")}
          {...fieldA11y("login-email", errors.email?.message)}
          type="email"
          autoComplete="username"
          className="h-10"
        />
      </FormField>
      <FormField id="login-password" label="Password" error={errors.password?.message}>
        <Input
          {...register("password")}
          {...fieldA11y("login-password", errors.password?.message)}
          type="password"
          autoComplete="current-password"
          className="h-10"
        />
      </FormField>
      {formError ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="h-11 w-full text-base">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" /> Signing in
          </>
        ) : (
          <>
            <LogIn aria-hidden="true" /> Sign in
          </>
        )}
      </Button>
    </form>
  );
}
