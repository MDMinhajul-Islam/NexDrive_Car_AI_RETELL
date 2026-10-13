"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Honours the visitor's "reduce motion" setting for every animation below it: movement
 * is dropped and only gentle opacity changes remain. Doing this here, instead of
 * rendering different markup per component, keeps server and client HTML identical.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
