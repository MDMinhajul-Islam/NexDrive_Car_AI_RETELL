"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Loader2, Search, X } from "lucide-react";
import {
  bookTestDrive,
  getAvailableSlots,
  searchBookableVehicles,
  type BookingResult,
  type Slot,
  type VehicleOption,
} from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldA11y, FormField } from "@/components/site/form-field";
import { SITE } from "@/lib/constants";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { bookingSchema, type BookingInput } from "@/lib/validations/booking";
import { cn } from "@/lib/utils";

type Confirmation = Extract<BookingResult, { ok: true }>["confirmation"];

type SlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; slots: Slot[] }
  | { status: "error"; message: string };

export function BookingForm({
  initialVehicle,
  minDate,
  maxDate,
  compact = false,
}: {
  /** Preselected when the visitor arrives from a vehicle page. */
  initialVehicle?: VehicleOption | null;
  /** Today and the last bookable day at the dealership (America/Chicago), YYYY-MM-DD. */
  minDate: string;
  maxDate: string;
  compact?: boolean;
}) {
  const [vehicle, setVehicle] = useState<VehicleOption | null>(initialVehicle ?? null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<VehicleOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [slotState, setSlotState] = useState<SlotState>({ status: "idle" });
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      vehicleId: initialVehicle?.id ?? "",
      date: "",
      time: "",
      salespersonId: "",
      message: "",
      company: "",
    },
  });

  const date = watch("date");
  const time = watch("time");
  const vehicleId = vehicle?.id ?? "";

  // Vehicle typeahead (server-side search, debounced).
  useEffect(() => {
    if (vehicle) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchBookableVehicles(term);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, vehicle]);

  // Load open times whenever the vehicle or date changes.
  useEffect(() => {
    setValue("time", "");
    setValue("salespersonId", "");
    if (!vehicleId || !date) {
      setSlotState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setSlotState({ status: "loading" });
    getAvailableSlots(vehicleId, date).then((res) => {
      if (cancelled) return;
      setSlotState(res.ok ? { status: "ready", slots: res.slots } : { status: "error", message: res.message });
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, date, slotRefresh, setValue]);

  const chooseVehicle = (option: VehicleOption | null) => {
    setVehicle(option);
    setValue("vehicleId", option?.id ?? "", { shouldValidate: Boolean(option) });
    setTerm("");
  };

  const onSubmit = handleSubmit(async (values) => {
    // Guard against double clicks and Enter-key repeats.
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      const result = await bookTestDrive(values);
      if (result.ok) {
        setConfirmation(result.confirmation);
        toast.success("Test drive requested");
        return;
      }
      setFormError(result.message);
      toast.error(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (message) setError(field as keyof BookingInput, { message });
      }
      // The chosen time may have just been taken: reload what is still open.
      setSlotRefresh((n) => n + 1);
    } catch {
      const message = `Something went wrong. Please try again or call ${SITE.phoneDisplay}.`;
      setFormError(message);
      toast.error(message);
    } finally {
      submitting.current = false;
    }
  });

  if (confirmation) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Your test drive is requested</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          A NexDrive specialist will confirm your appointment shortly. Please bring a valid driver license.
        </p>
        <dl className="mx-auto mt-6 grid max-w-md gap-3 rounded-xl bg-muted p-5 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="text-right font-medium">{confirmation.vehicle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-right font-medium">{formatDate(confirmation.date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Time (Central)</dt>
            <dd className="text-right font-medium">{formatTime(confirmation.time)}</dd>
          </div>
          {confirmation.id ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="text-right font-mono font-medium">{confirmation.id}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11 px-6">
            <Link href="/cars">Keep browsing</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-6">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-busy={isSubmitting}>
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="bk-company">Company</label>
        <input id="bk-company" type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
      </div>

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <FormField id="bk-first" label="First name" required error={errors.firstName?.message}>
          <Input
            {...register("firstName")}
            {...fieldA11y("bk-first", errors.firstName?.message)}
            autoComplete="given-name"
            className="h-10"
          />
        </FormField>
        <FormField id="bk-last" label="Last name" required error={errors.lastName?.message}>
          <Input
            {...register("lastName")}
            {...fieldA11y("bk-last", errors.lastName?.message)}
            autoComplete="family-name"
            className="h-10"
          />
        </FormField>
        <FormField id="bk-email" label="Email" required error={errors.email?.message}>
          <Input
            {...register("email")}
            {...fieldA11y("bk-email", errors.email?.message)}
            type="email"
            inputMode="email"
            autoComplete="email"
            className="h-10"
          />
        </FormField>
        <FormField
          id="bk-phone"
          label="Phone"
          required
          error={errors.phone?.message}
          hint="10-digit US number"
        >
          <Input
            {...register("phone")}
            {...fieldA11y("bk-phone", errors.phone?.message, "10-digit US number")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(214) 555-0142"
            className="h-10"
          />
        </FormField>
      </div>

      {/* Vehicle */}
      <input type="hidden" {...register("vehicleId")} />
      {vehicle ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Vehicle</p>
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/50 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{vehicle.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(vehicle.price)} &middot; {vehicle.location}
              </p>
            </div>
            {!compact ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => chooseVehicle(null)}>
                <X aria-hidden="true" />
                Change
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <FormField
          id="bk-vehicle-search"
          label="Vehicle"
          required
          error={errors.vehicleId?.message}
          hint="Search by make, model or stock number"
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              {...fieldA11y("bk-vehicle-search", errors.vehicleId?.message, "Search by make, model or stock number")}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Try Toyota RAV4"
              maxLength={60}
              className="h-10 pl-9"
              aria-controls="bk-vehicle-results"
            />
          </div>
          <div id="bk-vehicle-results" aria-live="polite" className="rounded-xl border">
            {searching && !results ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Searching inventory
              </p>
            ) : results && results.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No vehicles available for a test drive match that search.
              </p>
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto">
                {(results ?? []).map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => chooseVehicle(option)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted"
                    >
                      <span className="min-w-0 truncate font-medium">{option.name}</span>
                      <span className="shrink-0 text-muted-foreground">{formatCurrency(option.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormField>
      )}

      {/* Date */}
      <FormField
        id="bk-date"
        label="Preferred date"
        required
        error={errors.date?.message}
        hint="Dealership time is US Central (Plano, TX)"
      >
        <Input
          {...register("date")}
          {...fieldA11y("bk-date", errors.date?.message, "Dealership time is US Central (Plano, TX)")}
          type="date"
          min={minDate}
          max={maxDate}
          className="h-10"
        />
      </FormField>

      {/* Time */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Preferred time
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </legend>
        <input type="hidden" {...register("time")} />
        <input type="hidden" {...register("salespersonId")} />
        <div aria-live="polite">
          {slotState.status === "idle" ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Choose a vehicle and a date to see open times.
            </p>
          ) : slotState.status === "loading" ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking availability
            </p>
          ) : slotState.status === "error" ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {slotState.message}
            </p>
          ) : slotState.slots.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No open times on this date. Please try another day.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slotState.slots.map((slot) => {
                const selected = slot.time === time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setValue("time", slot.time, { shouldValidate: true });
                      setValue("salespersonId", slot.salespersonId, { shouldValidate: true });
                    }}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-medium transition-colors",
                      selected ? "border-neutral-950 bg-neutral-950 text-white" : "hover:border-neutral-400 hover:bg-muted",
                    )}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {errors.time?.message ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.time.message}
          </p>
        ) : null}
      </fieldset>

      <FormField id="bk-message" label="Message (optional)" error={errors.message?.message}>
        <Textarea
          {...register("message")}
          {...fieldA11y("bk-message", errors.message?.message)}
          rows={compact ? 3 : 4}
          maxLength={1000}
          placeholder="Anything we should know before your visit?"
        />
      </FormField>

      {formError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full text-base">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" /> Sending request
          </>
        ) : (
          <>
            <CalendarCheck aria-hidden="true" /> Request test drive
          </>
        )}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        By requesting a test drive you agree to be contacted about this appointment. No purchase required.
      </p>
    </form>
  );
}
