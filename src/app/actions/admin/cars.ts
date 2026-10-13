"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { VEHICLE_IMAGE_BUCKET, VEHICLE_STATUSES } from "@/lib/constants";
import { storageImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { VEHICLE_ID_REGEX } from "@/lib/validations/common";
import { storagePathPattern, vehicleSchema, type VehicleInput } from "@/lib/validations/vehicle";
import type { ActionResult } from "@/app/actions/admin/bookings";
import { z } from "zod";

export type VehicleImage = { id: number; path: string; url: string; isPrimary: boolean; sortOrder: number };
export type VehicleExtras = { featureIds: string[]; images: VehicleImage[] };

const idsSchema = z.array(z.string().regex(VEHICLE_ID_REGEX)).min(1).max(200);
const statusSchema = z.enum(VEHICLE_STATUSES);

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function dbErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return /vin/i.test(error.message)
      ? "Another vehicle already uses this VIN."
      : "This vehicle clashes with an existing record.";
  }
  if (error.code === "23514") return "One of the values breaks an inventory rule. Check status, mileage and prices.";
  if (error.code === "42501") return "You do not have permission to change inventory.";
  return "The vehicle could not be saved.";
}

function revalidate(vehicleId?: string) {
  revalidatePath("/admin/cars");
  revalidatePath("/admin/dashboard");
  revalidatePath("/cars");
  revalidatePath("/");
  if (vehicleId) revalidatePath(`/cars/${vehicleId}`);
}

/** Replaces a vehicle's feature links with the given set (adds and removes only the difference). */
async function syncFeatures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  featureIds: string[],
) {
  const { data: current, error } = await supabase
    .from("vehicle_features")
    .select("feature_id")
    .eq("vehicle_id", vehicleId);
  if (error) return error;
  const have = new Set((current ?? []).map((r) => r.feature_id));
  const want = new Set(featureIds);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toRemove.length) {
    const res = await supabase.from("vehicle_features").delete().eq("vehicle_id", vehicleId).in("feature_id", toRemove);
    if (res.error) return res.error;
  }
  if (toAdd.length) {
    const res = await supabase
      .from("vehicle_features")
      .insert(toAdd.map((feature_id) => ({ vehicle_id: vehicleId, feature_id })));
    if (res.error) return res.error;
  }
  return null;
}

export async function createVehicle(input: VehicleInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const { feature_ids, ...vehicle } = parsed.data;
  const supabase = await createClient();
  // admin_create_vehicle mints VEH-000000 / NX-000000 and inserts in one transaction.
  const { data, error } = await supabase.rpc("admin_create_vehicle", { p_vehicle: vehicle });
  if (error || !data) {
    console.error("[admin] admin_create_vehicle failed:", error?.message);
    return { ok: false, message: error ? dbErrorMessage(error) : "The vehicle could not be created." };
  }
  const id = data.vehicle_id;
  const featureError = await syncFeatures(supabase, id, feature_ids);
  revalidate(id);
  if (featureError) {
    console.error("[admin] feature sync failed:", featureError.message);
    return { ok: true, message: `Vehicle ${id} created, but its features could not be saved. Edit it to retry.`, data: { id } };
  }
  return { ok: true, message: `Vehicle ${id} created. You can now add photos.`, data: { id } };
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<ActionResult> {
  await requireAdmin();
  if (!VEHICLE_ID_REGEX.test(id)) return { ok: false, message: "Unknown vehicle." };
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const { feature_ids, ...vehicle } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ ...vehicle, updated_at: new Date().toISOString() })
    .eq("vehicle_id", id)
    .select("vehicle_id");
  if (error) {
    console.error("[admin] vehicle update failed:", error.message);
    return { ok: false, message: dbErrorMessage(error) };
  }
  if (!data?.length) return { ok: false, message: "That vehicle no longer exists." };
  const featureError = await syncFeatures(supabase, id, feature_ids);
  revalidate(id);
  if (featureError) {
    console.error("[admin] feature sync failed:", featureError.message);
    return { ok: false, message: "Vehicle saved, but its features could not be updated." };
  }
  return { ok: true, message: `Vehicle ${id} updated.` };
}

/**
 * Quick and bulk status change. "Mark as sold" is a status change: vehicles are never
 * deleted. Test drives are switched off for any status that does not allow them.
 */
export async function setVehicleStatus(ids: string[], status: string): Promise<ActionResult> {
  await requireAdmin();
  const parsedIds = idsSchema.safeParse(ids);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedIds.success || !parsedStatus.success) return { ok: false, message: "Invalid request." };

  const allowsTestDrive = parsedStatus.data === "Available" || parsedStatus.data === "Demo Vehicle";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({
      vehicle_status: parsedStatus.data,
      ...(allowsTestDrive ? {} : { test_drive_available: false }),
      ...(parsedStatus.data === "Sold" ? { is_featured: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .in("vehicle_id", parsedIds.data)
    .select("vehicle_id");
  if (error) {
    console.error("[admin] vehicle status update failed:", error.message);
    return { ok: false, message: dbErrorMessage(error) };
  }
  const count = data?.length ?? 0;
  if (count === 0) return { ok: false, message: "No vehicles were changed." };
  revalidate();
  parsedIds.data.forEach((id) => revalidatePath(`/cars/${id}`));
  return {
    ok: true,
    message: count === 1 ? `Vehicle marked ${parsedStatus.data}.` : `${count} vehicles marked ${parsedStatus.data}.`,
  };
}

export async function setVehicleFeatured(ids: string[], featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsedIds = idsSchema.safeParse(ids);
  if (!parsedIds.success || typeof featured !== "boolean") return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ is_featured: featured, updated_at: new Date().toISOString() })
    .in("vehicle_id", parsedIds.data)
    .select("vehicle_id");
  if (error) {
    console.error("[admin] featured update failed:", error.message);
    return { ok: false, message: dbErrorMessage(error) };
  }
  const count = data?.length ?? 0;
  if (count === 0) return { ok: false, message: "No vehicles were changed." };
  revalidate();
  return {
    ok: true,
    message: `${count} vehicle${count === 1 ? "" : "s"} ${featured ? "added to" : "removed from"} featured.`,
  };
}

async function loadImages(supabase: Awaited<ReturnType<typeof createClient>>, vehicleId: string) {
  const { data } = await supabase
    .from("vehicle_images")
    .select("id, storage_path, is_primary, sort_order")
    .eq("vehicle_id", vehicleId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    path: r.storage_path,
    url: storageImageUrl(r.storage_path),
    isPrimary: r.is_primary,
    sortOrder: r.sort_order,
  }));
}

/** Feature links and photos for the edit form. */
export async function getVehicleExtras(vehicleId: string): Promise<VehicleExtras> {
  await requireAdmin();
  if (!VEHICLE_ID_REGEX.test(vehicleId)) return { featureIds: [], images: [] };
  const supabase = await createClient();
  const [features, images] = await Promise.all([
    supabase.from("vehicle_features").select("feature_id").eq("vehicle_id", vehicleId),
    loadImages(supabase, vehicleId),
  ]);
  return { featureIds: (features.data ?? []).map((f) => f.feature_id), images };
}

/**
 * Records a photo after the browser has uploaded the file to Supabase Storage
 * (bucket vehicle-images, path vehicles/<vehicle_id>/<file>). The path is re-validated
 * here and again by the table's check constraint.
 */
export async function addVehicleImage(vehicleId: string, storagePath: string): Promise<ActionResult<VehicleImage[]>> {
  await requireAdmin();
  if (!VEHICLE_ID_REGEX.test(vehicleId) || !storagePathPattern(vehicleId).test(storagePath) || storagePath.includes("..")) {
    return { ok: false, message: "Invalid photo path." };
  }
  const supabase = await createClient();
  const existing = await loadImages(supabase, vehicleId);
  const { error } = await supabase.from("vehicle_images").insert({
    vehicle_id: vehicleId,
    storage_path: storagePath,
    is_primary: existing.length === 0,
    sort_order: existing.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1,
  });
  if (error) {
    console.error("[admin] vehicle image insert failed:", error.message);
    // Do not leave an orphaned file behind.
    await supabase.storage.from(VEHICLE_IMAGE_BUCKET).remove([storagePath]);
    return { ok: false, message: "The photo was uploaded but could not be saved." };
  }
  revalidate(vehicleId);
  return { ok: true, message: "Photo added.", data: await loadImages(supabase, vehicleId) };
}

export async function setPrimaryVehicleImage(vehicleId: string, imageId: number): Promise<ActionResult<VehicleImage[]>> {
  await requireAdmin();
  if (!VEHICLE_ID_REGEX.test(vehicleId) || !Number.isInteger(imageId)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const clear = await supabase.from("vehicle_images").update({ is_primary: false }).eq("vehicle_id", vehicleId);
  const set = clear.error
    ? clear
    : await supabase.from("vehicle_images").update({ is_primary: true }).eq("vehicle_id", vehicleId).eq("id", imageId);
  if (set.error) {
    console.error("[admin] set primary image failed:", set.error.message);
    return { ok: false, message: "The cover photo could not be changed." };
  }
  revalidate(vehicleId);
  return { ok: true, message: "Cover photo updated.", data: await loadImages(supabase, vehicleId) };
}

export async function removeVehicleImage(vehicleId: string, imageId: number): Promise<ActionResult<VehicleImage[]>> {
  await requireAdmin();
  if (!VEHICLE_ID_REGEX.test(vehicleId) || !Number.isInteger(imageId)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("vehicle_images")
    .delete()
    .eq("vehicle_id", vehicleId)
    .eq("id", imageId)
    .select("storage_path, is_primary")
    .maybeSingle();
  if (error || !row) {
    if (error) console.error("[admin] vehicle image delete failed:", error.message);
    return { ok: false, message: "The photo could not be removed." };
  }
  const storage = await supabase.storage.from(VEHICLE_IMAGE_BUCKET).remove([row.storage_path]);
  if (storage.error) console.error("[admin] storage remove failed:", storage.error.message);

  let images = await loadImages(supabase, vehicleId);
  if (row.is_primary && images.length > 0) {
    await supabase.from("vehicle_images").update({ is_primary: true }).eq("id", images[0].id);
    images = await loadImages(supabase, vehicleId);
  }
  revalidate(vehicleId);
  return { ok: true, message: "Photo removed.", data: images };
}
