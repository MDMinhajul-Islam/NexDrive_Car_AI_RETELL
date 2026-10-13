"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createBooking,
  searchCustomers,
  searchVehicles,
  updateBooking,
  type PickerOption,
} from "@/app/actions/admin/bookings";
import { AsyncPicker } from "@/components/admin/async-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { TIME_SLOTS } from "@/lib/admin/time-slots";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@/lib/constants";
import type { BookingRow, SalespersonOption } from "@/lib/data/admin/bookings";
import { formatTime } from "@/lib/format";
import { createBookingSchema, type CreateBookingInput } from "@/lib/validations/admin-booking";

function toForm(booking: BookingRow | null, today: string): CreateBookingInput {
  if (!booking) {
    return {
      customerId: "",
      vehicleId: "",
      salespersonId: "",
      date: today,
      time: "",
      type: "Test Drive",
      status: "Confirmed",
      createdBy: "Customer Service",
      notes: "",
    };
  }
  return {
    // Customer and vehicle are fixed once a booking exists; kept so one schema validates both modes.
    customerId: booking.customer_id,
    vehicleId: booking.vehicle_id,
    salespersonId: booking.salesperson_id,
    date: booking.appointment_date,
    time: booking.appointment_time.length === 5 ? `${booking.appointment_time}:00` : booking.appointment_time,
    type: booking.appointment_type as CreateBookingInput["type"],
    status: booking.status as CreateBookingInput["status"],
    createdBy: "Customer Service",
    notes: booking.notes,
  };
}

/** Create (booking = null) or edit an appointment. */
export function BookingFormDialog({
  open,
  onOpenChange,
  booking,
  salespeople,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRow | null;
  salespeople: SalespersonOption[];
  today: string;
}) {
  const isEdit = booking !== null;
  const [customer, setCustomer] = useState<PickerOption | null>(null);
  const [vehicle, setVehicle] = useState<PickerOption | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting: pending },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: toForm(booking, today),
  });

  // Reset whenever the dialog opens for a different booking.
  useEffect(() => {
    if (open) {
      reset(toForm(booking, today));
      setCustomer(null);
      setVehicle(null);
    }
  }, [open, booking, today, reset]);

  const time = watch("time");
  const salespersonId = watch("salespersonId");

  // Keep an existing off-grid time selectable when editing older records.
  const timeOptions =
    TIME_SLOTS.some((s) => s.value === time) || !time
      ? TIME_SLOTS
      : [{ value: time, label: formatTime(time) }, ...TIME_SLOTS];

  const submit = handleSubmit(async (values) => {
    const { customerId, vehicleId, createdBy, ...shared } = values;
    const result = isEdit
      ? await updateBooking(booking.appointment_id, shared)
      : await createBooking({ ...shared, customerId, vehicleId, createdBy });
    if (result.ok) {
      toast.success(result.message);
      onOpenChange(false);
      return;
    }
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof CreateBookingInput, { message });
    }
    toast.error(result.message);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="dialog-mobile-sheet max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit booking ${booking.appointment_id}` : "New booking"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change the schedule, salesperson, status or notes. All times are US Central."
              : "Create an appointment for an existing customer. All times are US Central."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-5">
          {isEdit ? (
            <dl className="grid gap-3 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Customer</dt>
                <dd className="font-medium">
                  {booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : booking.customer_id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Vehicle</dt>
                <dd className="font-medium">{booking.vehicle?.name ?? booking.vehicle_id}</dd>
              </div>
            </dl>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="bf-customer" label="Customer" required error={errors.customerId?.message}>
                <AsyncPicker
                  id="bf-customer"
                  value={customer}
                  onChange={(o) => {
                    setCustomer(o);
                    setValue("customerId", o?.id ?? "", { shouldValidate: Boolean(o) });
                  }}
                  search={searchCustomers}
                  placeholder="Name, phone or email"
                  emptyText="No customers match."
                  invalid={Boolean(errors.customerId)}
                />
              </FormField>
              <FormField id="bf-vehicle" label="Vehicle" required error={errors.vehicleId?.message}>
                <AsyncPicker
                  id="bf-vehicle"
                  value={vehicle}
                  onChange={(o) => {
                    setVehicle(o);
                    setValue("vehicleId", o?.id ?? "", { shouldValidate: Boolean(o) });
                  }}
                  search={searchVehicles}
                  placeholder="Make, model or stock number"
                  emptyText="No vehicles match."
                  invalid={Boolean(errors.vehicleId)}
                />
              </FormField>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="bf-date" label="Date" required error={errors.date?.message}>
              <Input id="bf-date" type="date" className="h-9" aria-invalid={Boolean(errors.date) || undefined} {...register("date")} />
            </FormField>
            <FormField id="bf-time" label="Time" required error={errors.time?.message}>
              <SelectField control={control} name="time" id="bf-time" options={timeOptions} placeholder="Choose a time" invalid={Boolean(errors.time)} />
            </FormField>
            <FormField id="bf-salesperson" label="Salesperson" required error={errors.salespersonId?.message}>
              <SelectField
                control={control}
                name="salespersonId"
                id="bf-salesperson"
                placeholder="Choose a salesperson"
                invalid={Boolean(errors.salespersonId)}
                options={salespeople
                  .filter((s) => s.active || s.id === salespersonId)
                  .map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (inactive)` }))}
              />
            </FormField>
            <FormField id="bf-type" label="Type" required error={errors.type?.message}>
              <SelectField control={control} name="type" id="bf-type" options={APPOINTMENT_TYPES} />
            </FormField>
            <FormField id="bf-status" label="Status" required error={errors.status?.message}>
              <SelectField control={control} name="status" id="bf-status" options={APPOINTMENT_STATUSES} />
            </FormField>
            {!isEdit ? (
              <FormField id="bf-created-by" label="Booked by" required error={errors.createdBy?.message}>
                <SelectField control={control} name="createdBy" id="bf-created-by" options={["Customer Service", "Salesperson"]} />
              </FormField>
            ) : null}
          </div>

          <FormField id="bf-notes" label="Notes" error={errors.notes?.message}>
            <Textarea id="bf-notes" rows={3} maxLength={4000} {...register("notes")} />
          </FormField>

          <DialogFooter className="max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:border-t max-sm:bg-popover max-sm:px-4 max-sm:py-3">
            <Button type="button" variant="outline" className="h-9" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-9" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isEdit ? "Save changes" : "Create booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
