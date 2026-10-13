"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateCustomer } from "@/app/actions/admin/customers";
import { SelectField } from "@/components/admin/form-controls";
import { FormField } from "@/components/site/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BUYER_PROFILES, CUSTOMER_VEHICLE_TYPES, PURCHASE_TIMELINES } from "@/lib/constants";
import type { CustomerRow } from "@/lib/data/admin/customers";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";

const YES_NO = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
] as const;

function toForm(c: CustomerRow): CustomerInput {
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    synthetic_email: c.synthetic_email,
    synthetic_phone: c.synthetic_phone,
    city: c.city,
    state: "TX",
    budget_min: c.budget_min,
    budget_max: c.budget_max,
    estimated_down_payment: Number(c.estimated_down_payment ?? 0),
    financing_needed: c.financing_needed,
    trade_in: c.trade_in,
    family_size: c.family_size,
    preferred_brand: c.preferred_brand,
    preferred_vehicle_type: (c.preferred_vehicle_type as CustomerInput["preferred_vehicle_type"]) ?? null,
    purchase_timeline: (c.purchase_timeline as CustomerInput["purchase_timeline"]) ?? null,
    buyer_profile: (c.buyer_profile as CustomerInput["buyer_profile"]) ?? null,
    notes: c.notes ?? "",
  };
}

/** Empty number inputs become null (optional columns) instead of NaN. */
const optionalNumber = { setValueAs: (v: unknown) => (v === "" || v == null ? null : Number(v)) };
/** Empty text inputs become null for nullable text columns. */
const optionalText = { setValueAs: (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v) };

export function CustomerFormDialog({
  customer,
  onOpenChange,
}: {
  customer: CustomerRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer ? toForm(customer) : undefined,
  });

  useEffect(() => {
    if (customer) reset(toForm(customer));
  }, [customer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!customer) return;
    const result = await updateCustomer(customer.customer_id, values);
    if (result.ok) {
      toast.success(result.message);
      onOpenChange(false);
      return;
    }
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof CustomerInput, { message });
    }
    toast.error(result.message);
  });

  const err = (name: keyof CustomerInput) => errors[name]?.message as string | undefined;
  const invalid = (name: keyof CustomerInput) => (errors[name] ? true : undefined);

  return (
    <Dialog open={customer !== null} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit {customer?.first_name} {customer?.last_name}
          </DialogTitle>
          <DialogDescription className="font-mono">{customer?.customer_id}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="cf-first" label="First name" required error={err("first_name")}>
              <Input id="cf-first" className="h-9" aria-invalid={invalid("first_name")} {...register("first_name")} />
            </FormField>
            <FormField id="cf-last" label="Last name" required error={err("last_name")}>
              <Input id="cf-last" className="h-9" aria-invalid={invalid("last_name")} {...register("last_name")} />
            </FormField>
            <FormField id="cf-phone" label="Phone" required error={err("synthetic_phone")} hint="Saved as +1-XXX-XXX-XXXX">
              <Input id="cf-phone" type="tel" className="h-9" aria-invalid={invalid("synthetic_phone")} {...register("synthetic_phone")} />
            </FormField>
            <FormField id="cf-email" label="Email" error={err("synthetic_email")}>
              <Input id="cf-email" type="email" className="h-9" aria-invalid={invalid("synthetic_email")} {...register("synthetic_email", optionalText)} />
            </FormField>
            <FormField id="cf-city" label="City" error={err("city")}>
              <Input id="cf-city" className="h-9" aria-invalid={invalid("city")} {...register("city", optionalText)} />
            </FormField>
            <FormField id="cf-state" label="State" error={err("state")} hint="NexDrive serves Texas customers only">
              <Input id="cf-state" className="h-9" readOnly aria-readonly="true" {...register("state")} />
            </FormField>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Buying profile</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="cf-bmin" label="Budget min (USD)" error={err("budget_min")} hint="3,000 or more">
                <Input id="cf-bmin" type="number" inputMode="numeric" className="h-9" aria-invalid={invalid("budget_min")} {...register("budget_min", optionalNumber)} />
              </FormField>
              <FormField id="cf-bmax" label="Budget max (USD)" error={err("budget_max")} hint="Up to 100,000">
                <Input id="cf-bmax" type="number" inputMode="numeric" className="h-9" aria-invalid={invalid("budget_max")} {...register("budget_max", optionalNumber)} />
              </FormField>
              <FormField id="cf-down" label="Down payment (USD)" error={err("estimated_down_payment")} hint="Needs financing set to Yes">
                <Input
                  id="cf-down"
                  type="number"
                  inputMode="numeric"
                  className="h-9"
                  aria-invalid={invalid("estimated_down_payment")}
                  {...register("estimated_down_payment", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
                />
              </FormField>
              <FormField id="cf-fin" label="Financing needed" error={err("financing_needed")}>
                <BooleanSelect id="cf-fin" value={watch("financing_needed")} onChange={(v) => setValue("financing_needed", v, { shouldValidate: true })} />
              </FormField>
              <FormField id="cf-trade" label="Has a trade-in" error={err("trade_in")}>
                <BooleanSelect id="cf-trade" value={watch("trade_in")} onChange={(v) => setValue("trade_in", v, { shouldValidate: true })} />
              </FormField>
              <FormField id="cf-family" label="Family size" error={err("family_size")} hint="1 to 8">
                <Input id="cf-family" type="number" inputMode="numeric" className="h-9" aria-invalid={invalid("family_size")} {...register("family_size", optionalNumber)} />
              </FormField>
              <FormField id="cf-brand" label="Preferred brand" error={err("preferred_brand")}>
                <Input id="cf-brand" className="h-9" aria-invalid={invalid("preferred_brand")} {...register("preferred_brand", optionalText)} />
              </FormField>
              <FormField id="cf-type" label="Preferred vehicle type" error={err("preferred_vehicle_type")}>
                <SelectField control={control} name="preferred_vehicle_type" id="cf-type" options={CUSTOMER_VEHICLE_TYPES} nullable />
              </FormField>
              <FormField id="cf-timeline" label="Purchase timeline" error={err("purchase_timeline")}>
                <SelectField control={control} name="purchase_timeline" id="cf-timeline" options={PURCHASE_TIMELINES} nullable />
              </FormField>
              <FormField id="cf-profile" label="Buyer profile" error={err("buyer_profile")}>
                <SelectField control={control} name="buyer_profile" id="cf-profile" options={BUYER_PROFILES} nullable />
              </FormField>
            </div>
          </fieldset>

          <FormField id="cf-notes" label="Notes" error={err("notes")}>
            <Textarea id="cf-notes" rows={3} maxLength={4000} {...register("notes")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-9" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function BooleanSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <Select
      value={value == null ? "unset" : String(value)}
      onValueChange={(v) => onChange(v === "unset" ? null : v === "true")}
    >
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unset">Not set</SelectItem>
        {YES_NO.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
