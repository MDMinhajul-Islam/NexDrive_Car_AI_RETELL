"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import {
  addVehicleImage,
  removeVehicleImage,
  setPrimaryVehicleImage,
  type VehicleImage,
} from "@/app/actions/admin/cars";
import { Button } from "@/components/ui/button";
import { VEHICLE_IMAGE_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/validations/vehicle";

const EXT_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

/**
 * Photo manager for one vehicle. Files go straight from the browser to Supabase Storage
 * under vehicles/<vehicle_id>/, using the signed-in admin's session (storage policies
 * allow admins only). A Server Action then records the path in vehicle_images.
 */
export function VehiclePhotos({
  vehicleId,
  images,
  onChange,
}: {
  vehicleId: string;
  images: VehicleImage[];
  onChange: (images: VehicleImage[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [pending, startTransition] = useTransition();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const supabase = createClient();
    let latest = images;
    setUploading(files.length);
    for (const file of Array.from(files)) {
      const ext = EXT_BY_MIME[file.type];
      if (!ext || !(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: use a WebP, JPEG, PNG or AVIF image.`);
      } else if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name}: photos must be 5 MB or smaller.`);
      } else {
        // Random name: no user-supplied characters ever reach the storage path.
        const path = `vehicles/${vehicleId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(VEHICLE_IMAGE_BUCKET)
          .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        if (error) {
          toast.error(`${file.name}: upload failed.`);
        } else {
          const result = await addVehicleImage(vehicleId, path);
          if (result.ok && result.data) {
            latest = result.data;
            onChange(latest);
          } else {
            toast.error(result.message);
          }
        }
      }
      setUploading((n) => n - 1);
    }
    setUploading(0);
    if (input.current) input.current.value = "";
    if (latest !== images) toast.success("Photos updated.");
  };

  const run = (action: () => Promise<{ ok: boolean; message: string; data?: VehicleImage[] }>) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok && result.data) {
        onChange(result.data);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  };

  const busy = uploading > 0 || pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          WebP, JPEG, PNG or AVIF, up to 5 MB each. The cover photo is shown first on the website.
        </p>
        <input
          ref={input}
          type="file"
          accept={IMAGE_MIME_TYPES.join(",")}
          multiple
          className="sr-only"
          id={`photos-${vehicleId}`}
          onChange={(e) => upload(e.target.files)}
          disabled={busy}
        />
        <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => input.current?.click()}>
          {uploading > 0 ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
          {uploading > 0 ? `Uploading ${uploading}` : "Upload photos"}
        </Button>
      </div>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No photos yet. Until you add one, the website shows the stock photo for this make and model.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, i) => (
            <li key={image.id} className="overflow-hidden rounded-lg border">
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={image.url} alt={`Photo ${i + 1}`} fill sizes="240px" className="object-cover" />
                {image.isPrimary ? (
                  <span className="absolute left-2 top-2 rounded-full bg-neutral-950/85 px-2 py-0.5 text-xs font-medium text-white">
                    Cover
                  </span>
                ) : null}
              </div>
              <div className="flex justify-between gap-1 p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || image.isPrimary}
                  onClick={() => run(() => setPrimaryVehicleImage(vehicleId, image.id))}
                >
                  <Star aria-hidden="true" /> Cover
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove photo ${i + 1}`}
                  disabled={busy}
                  onClick={() => run(() => removeVehicleImage(vehicleId, image.id))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
