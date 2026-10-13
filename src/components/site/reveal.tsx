"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Subtle fade and slide when a block scrolls into view.
 * Always renders the same element: for visitors who prefer reduced motion the slide is
 * removed by <MotionProvider>, so there is no server/client markup difference.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
