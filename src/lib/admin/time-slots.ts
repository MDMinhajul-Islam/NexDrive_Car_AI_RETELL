import { formatTime } from "@/lib/format";

/** Half-hour slots staff can pick, 7:00 AM to 9:00 PM dealership time. */
export const TIME_SLOTS = Array.from({ length: (21 - 7) * 2 + 1 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
  return { value, label: formatTime(value) };
});
