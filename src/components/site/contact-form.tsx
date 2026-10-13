"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { sendContactMessage } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldA11y, FormField } from "@/components/site/form-field";
import { contactSchema, type ContactInput } from "@/lib/validations/contact";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", subject: "", message: "", company: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      const result = await sendContactMessage(values);
      if (result.ok) {
        setSent(true);
        reset();
        toast.success("Message sent");
        return;
      }
      setFormError(result.message);
      toast.error(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (message) setError(field as keyof ContactInput, { message });
      }
    } catch {
      const message = "Something went wrong. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      submitting.current = false;
    }
  });

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Thanks, your message is on its way</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          We reply to every message within one business day.
        </p>
        <Button variant="outline" className="mt-6 h-10 px-5" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-busy={isSubmitting}>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="ct-company">Company</label>
        <input id="ct-company" type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ct-name" label="Full name" required error={errors.name?.message}>
          <Input {...register("name")} {...fieldA11y("ct-name", errors.name?.message)} autoComplete="name" className="h-10" />
        </FormField>
        <FormField id="ct-email" label="Email" required error={errors.email?.message}>
          <Input
            {...register("email")}
            {...fieldA11y("ct-email", errors.email?.message)}
            type="email"
            autoComplete="email"
            className="h-10"
          />
        </FormField>
        <FormField id="ct-phone" label="Phone (optional)" error={errors.phone?.message}>
          <Input
            {...register("phone")}
            {...fieldA11y("ct-phone", errors.phone?.message)}
            type="tel"
            autoComplete="tel-national"
            className="h-10"
          />
        </FormField>
        <FormField id="ct-subject" label="Subject (optional)" error={errors.subject?.message}>
          <Input {...register("subject")} {...fieldA11y("ct-subject", errors.subject?.message)} className="h-10" />
        </FormField>
      </div>
      <FormField id="ct-message" label="How can we help?" required error={errors.message?.message}>
        <Textarea {...register("message")} {...fieldA11y("ct-message", errors.message?.message)} rows={6} maxLength={4000} />
      </FormField>

      {formError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="h-11 px-6 text-base">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" /> Sending
          </>
        ) : (
          <>
            <Send aria-hidden="true" /> Send message
          </>
        )}
      </Button>
    </form>
  );
}
