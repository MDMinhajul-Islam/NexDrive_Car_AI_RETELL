"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { motion } from "framer-motion";
import { AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

// The call panel (and through it the Retell SDK) is only downloaded after the first
// click, so the home page pays nothing for this feature until someone uses it.
const VoiceCallPanel = dynamic(() => import("./voice-call-panel").then((m) => m.VoiceCallPanel), {
  ssr: false,
});

/** Compact round call button (56px mobile, 64px from sm up) with its label on the left and a soft pulsing ring. */
export function VoiceCallButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // Keep the panel mounted after first use so its exit animation can play.
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("flex items-center gap-3 sm:gap-4", className)}>
      {/* Label sits to the left of the circle, right-aligned. The button carries the accessible name. */}
      <span aria-hidden="true" className="text-right drop-shadow-[0_1px_8px_rgb(0_0_0/0.8)]">
        <span className="block text-sm font-semibold leading-tight text-white sm:text-base">
          Talk to our AI assistant
        </span>
        <span className="hidden text-xs leading-tight text-neutral-300 sm:mt-1 sm:block">Ask about any car, live</span>
      </span>
      <span className="relative grid size-14 shrink-0 place-items-center sm:size-16">
        {/* Decorative rings. Hidden with CSS for reduced motion so the markup never differs. */}
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-brand/60 motion-reduce:hidden"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.5, 0], scale: [1, 1.25, 1.4] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: i * 1.4, ease: "easeOut" }}
          />
        ))}
        <motion.button
          type="button"
          aria-label="Talk to our AI assistant"
          aria-haspopup="dialog"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="relative grid size-14 place-items-center rounded-full bg-brand text-ink shadow-[0_0_32px_-8px] shadow-brand/70 outline-none ring-white/80 ring-offset-2 ring-offset-neutral-950 focus-visible:ring-2 sm:size-16"
        >
          <AudioLines className="size-6 sm:size-7" aria-hidden="true" />
        </motion.button>
      </span>

      {loaded ? <VoiceCallPanel open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}
