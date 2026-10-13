"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createVehicle,
  getVehicleExtras,
  updateVehicle,
  type VehicleImage,
} from "@/app/actions/admin/cars";
import { VehiclePhotos } from "@/components/admin/cars/vehicle-photos";
import { SelectField, SwitchField } from "@/components/admin/form-controls";
import { FormField } from "@/components/site/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BODY_TYPES,
  DRIVETRAINS,
  FUEL_TYPES,
  TRANSMISSIONS,
  VEHICLE_CONDITIONS,
  VEHICLE_STATUSES,
} from "@/lib/constants";
import type { CarRow, FeatureOption } from "@/lib/data/admin/cars";
import { vehicleSchema, type VehicleInput } from "@/lib/validations/vehicle";

const BLANK: VehicleInput = {
  vin: "",
  year: new Date().getFullYear(),
  make: "",
  model: "",
  trim: "",
  body_type: "SUV",
  condition: "Used",
  fuel_type: "Gasoline",
  transmission: "Automatic",
  drivetrain: "FWD",
  vehicle_status: "Arriving Soon",
  mileage: 0,
  seating_capacity: 5,
  msrp: 0,
  sale_price: 0,
  exterior_color: "",
  interior_color: "",
  warranty: "",
  certification: "None",
  dealership_location: "Plano Flagship",
  test_drive_available: false,
  is_featured: false,
  feature_ids: [],
};

function toForm(car: CarRow | null): VehicleInput {
  if (!car) return BLANK;
  return {
    vin: car.vin,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    body_type: car.body_type as VehicleInput["body_type"],
    condition: car.condition as VehicleInput["condition"],
    fuel_type: car.fuel_type as VehicleInput["fuel_type"],
    transmission: car.transmission as VehicleInput["transmission"],
    drivetrain: car.drivetrain as VehicleInput["drivetrain"],
    vehicle_status: car.vehicle_status as VehicleInput["vehicle_status"],
    mileage: car.mileage,
    seating_capacity: car.seating_capacity,
    msrp: Number(car.msrp),
    sale_price: Number(car.sale_price),
    exterior_color: car.exterior_color,
    interior_color: car.interior_color,
    warranty: car.warranty,
    certification: car.certification,
    dealership_location: car.dealership_location,
    test_drive_available: car.test_drive_available,
    is_featured: Boolean(car.is_featured),
    feature_ids: [],
  };
}

/**
 * Create or edit a vehicle. `car` is the row being edited, or null for a new vehicle.
 * After a create, `onCreated` receives the new ID so the parent can reopen in edit mode
 * (photos need a vehicle ID for their storage path).
 */
export function VehicleFormDialog({
  open,
  onOpenChange,
  car,
  features,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  car: CarRow | null;
  features: FeatureOption[];
  onCreated: (vehicleId: string) => void;
}) {
  const isEdit = car !== null;
  const [tab, setTab] = useState("details");
  const [images, setImages] = useState<VehicleImage[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VehicleInput>({ resolver: zodResolver(vehicleSchema), defaultValues: toForm(car) });

  // Reset when the dialog opens, then load feature links and photos for an existing vehicle.
  useEffect(() => {
    if (!open) return;
    reset(toForm(car));
    setTab("details");
    setImages([]);
    if (!car) return;
    let cancelled = false;
    setLoadingExtras(true);
    getVehicleExtras(car.vehicle_id)
      .then((extras) => {
        if (cancelled) return;
        setValue("feature_ids", extras.featureIds);
        setImages(extras.images);
      })
      .finally(() => !cancelled && setLoadingExtras(false));
    return () => {
      cancelled = true;
    };
  }, [open, car, reset, setValue]);

  const status = watch("vehicle_status");
  const testDriveAllowed = status === "Available" || status === "Demo Vehicle";
  useEffect(() => {
    if (!testDriveAllowed) setValue("test_drive_available", false);
  }, [testDriveAllowed, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const result = isEdit ? await updateVehicle(car.vehicle_id, values) : await createVehicle(values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof VehicleInput, { message });
      }
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    if (!isEdit && "data" in result && result.data?.id) onCreated(result.data.id);
    else onOpenChange(false);
  }, () => {
    // Validation failed: the fields with errors live on the Details tab.
    setTab("details");
    toast.error("Please check the highlighted fields.");
  });

  const detailErrors = Object.keys(errors).filter((k) => k !== "feature_ids").length;
  const grouped = features.reduce<Record<string, FeatureOption[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});
  const num = (name: keyof VehicleInput) => register(name, { valueAsNumber: true });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="dialog-mobile-sheet max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${car.year} ${car.make} ${car.model}` : "Add a vehicle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${car.vehicle_id} · Stock ${car.stock_number}`
              : "The vehicle ID and stock number are assigned automatically. Photos can be added after saving."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="details">
                Details{detailErrors > 0 ? ` (${detailErrors})` : ""}
              </TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="photos" disabled={!isEdit}>
                Photos{isEdit ? ` (${images.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 pt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="vf-year" label="Year" required error={errors.year?.message}>
                  <Input id="vf-year" type="number" inputMode="numeric" className="h-9" aria-invalid={Boolean(errors.year) || undefined} {...num("year")} />
                </FormField>
                <FormField id="vf-make" label="Make" required error={errors.make?.message}>
                  <Input id="vf-make" className="h-9" aria-invalid={Boolean(errors.make) || undefined} {...register("make")} />
                </FormField>
                <FormField id="vf-model" label="Model" required error={errors.model?.message}>
                  <Input id="vf-model" className="h-9" aria-invalid={Boolean(errors.model) || undefined} {...register("model")} />
                </FormField>
                <FormField id="vf-trim" label="Trim" required error={errors.trim?.message}>
                  <Input id="vf-trim" className="h-9" aria-invalid={Boolean(errors.trim) || undefined} {...register("trim")} />
                </FormField>
                <FormField id="vf-vin" label="VIN" required error={errors.vin?.message} className="sm:col-span-2">
                  <Input
                    id="vf-vin"
                    maxLength={17}
                    autoCapitalize="characters"
                    className="h-9 font-mono uppercase"
                    aria-invalid={Boolean(errors.vin) || undefined}
                    {...register("vin")}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="vf-condition" label="Condition" required error={errors.condition?.message}>
                  <SelectField control={control} name="condition" id="vf-condition" options={VEHICLE_CONDITIONS} invalid={Boolean(errors.condition)} />
                </FormField>
                <FormField id="vf-body" label="Body type" required error={errors.body_type?.message}>
                  <SelectField control={control} name="body_type" id="vf-body" options={BODY_TYPES} invalid={Boolean(errors.body_type)} />
                </FormField>
                <FormField id="vf-fuel" label="Fuel type" required error={errors.fuel_type?.message}>
                  <SelectField control={control} name="fuel_type" id="vf-fuel" options={FUEL_TYPES} invalid={Boolean(errors.fuel_type)} />
                </FormField>
                <FormField id="vf-transmission" label="Transmission" required error={errors.transmission?.message}>
                  <SelectField control={control} name="transmission" id="vf-transmission" options={TRANSMISSIONS} invalid={Boolean(errors.transmission)} />
                </FormField>
                <FormField id="vf-drivetrain" label="Drivetrain" required error={errors.drivetrain?.message}>
                  <SelectField control={control} name="drivetrain" id="vf-drivetrain" options={DRIVETRAINS} invalid={Boolean(errors.drivetrain)} />
                </FormField>
                <FormField id="vf-seats" label="Seating" required error={errors.seating_capacity?.message}>
                  <Input id="vf-seats" type="number" inputMode="numeric" className="h-9" aria-invalid={Boolean(errors.seating_capacity) || undefined} {...num("seating_capacity")} />
                </FormField>
                <FormField id="vf-mileage" label="Mileage" required error={errors.mileage?.message}>
                  <Input id="vf-mileage" type="number" inputMode="numeric" className="h-9" aria-invalid={Boolean(errors.mileage) || undefined} {...num("mileage")} />
                </FormField>
                <FormField id="vf-msrp" label="MSRP (USD)" required error={errors.msrp?.message}>
                  <Input id="vf-msrp" type="number" inputMode="decimal" step="0.01" className="h-9" aria-invalid={Boolean(errors.msrp) || undefined} {...num("msrp")} />
                </FormField>
                <FormField id="vf-price" label="Sale price (USD)" required error={errors.sale_price?.message} hint="Cannot exceed MSRP">
                  <Input id="vf-price" type="number" inputMode="decimal" step="0.01" className="h-9" aria-invalid={Boolean(errors.sale_price) || undefined} {...num("sale_price")} />
                </FormField>
                <FormField id="vf-ext" label="Exterior color" required error={errors.exterior_color?.message}>
                  <Input id="vf-ext" className="h-9" aria-invalid={Boolean(errors.exterior_color) || undefined} {...register("exterior_color")} />
                </FormField>
                <FormField id="vf-int" label="Interior color" required error={errors.interior_color?.message}>
                  <Input id="vf-int" className="h-9" aria-invalid={Boolean(errors.interior_color) || undefined} {...register("interior_color")} />
                </FormField>
                <FormField id="vf-location" label="Location" required error={errors.dealership_location?.message}>
                  <Input id="vf-location" className="h-9" aria-invalid={Boolean(errors.dealership_location) || undefined} {...register("dealership_location")} />
                </FormField>
                <FormField id="vf-warranty" label="Warranty" required error={errors.warranty?.message} className="sm:col-span-2">
                  <Input id="vf-warranty" className="h-9" placeholder="90-Day Dealer Limited Warranty" aria-invalid={Boolean(errors.warranty) || undefined} {...register("warranty")} />
                </FormField>
                <FormField id="vf-cert" label="Certification" required error={errors.certification?.message} hint='Use "None" if not certified'>
                  <Input id="vf-cert" className="h-9" aria-invalid={Boolean(errors.certification) || undefined} {...register("certification")} />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="vf-status" label="Status" required error={errors.vehicle_status?.message}>
                  <SelectField control={control} name="vehicle_status" id="vf-status" options={VEHICLE_STATUSES} invalid={Boolean(errors.vehicle_status)} />
                </FormField>
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  <SwitchField
                    control={control}
                    name="test_drive_available"
                    id="vf-test-drive"
                    label="Test drives"
                    description={testDriveAllowed ? "Offer online booking" : "Only for Available or Demo Vehicle"}
                    error={errors.test_drive_available?.message}
                  />
                  <SwitchField
                    control={control}
                    name="is_featured"
                    id="vf-featured"
                    label="Featured"
                    description="Show on the home page"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="features" className="pt-4">
              {loadingExtras ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading features
                </p>
              ) : features.length === 0 ? (
                <p className="text-sm text-muted-foreground">No features are defined yet.</p>
              ) : (
                <Controller
                  control={control}
                  name="feature_ids"
                  render={({ field }) => (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {Object.entries(grouped).map(([category, items]) => (
                        <fieldset key={category}>
                          <legend className="text-sm font-semibold">{category}</legend>
                          <ul className="mt-3 space-y-2">
                            {items.map((f) => {
                              const checked = field.value.includes(f.id);
                              return (
                                <li key={f.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`feat-${f.id}`}
                                    checked={checked}
                                    onCheckedChange={(value) =>
                                      field.onChange(
                                        value ? [...field.value, f.id] : field.value.filter((id) => id !== f.id),
                                      )
                                    }
                                  />
                                  <label htmlFor={`feat-${f.id}`} className="text-sm">
                                    {f.name}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </fieldset>
                      ))}
                    </div>
                  )}
                />
              )}
            </TabsContent>

            <TabsContent value="photos" className="pt-4">
              {isEdit ? (
                loadingExtras ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading photos
                  </p>
                ) : (
                  <VehiclePhotos vehicleId={car.vehicle_id} images={images} onChange={setImages} />
                )
              ) : null}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:border-t max-sm:bg-popover max-sm:px-4 max-sm:py-3">
            <Button type="button" variant="outline" className="h-9" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              {tab === "photos" ? "Done" : "Cancel"}
            </Button>
            {tab !== "photos" ? (
              <Button type="submit" className="h-9" disabled={isSubmitting || loadingExtras}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {isEdit ? "Save changes" : "Create vehicle"}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
