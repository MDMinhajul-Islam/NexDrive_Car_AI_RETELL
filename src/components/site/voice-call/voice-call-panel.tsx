"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ChevronDown, Loader2, Mic, MicOff, PhoneCall, PhoneOff, Sparkles, X } from "lucide-react";
import type { RetellWebClient } from "retell-client-js-sdk";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TurnstileField, type TurnstileHandle } from "@/components/site/turnstile-field";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Phase = "checking" | "unavailable" | "ready" | "mic" | "connecting" | "live" | "ended" | "error";
type Line = { role: "agent" | "user"; content: string };
type CallGrant = {
  accessToken: string;
  callId: string;
  transport?: "gateway" | "livekit";
  iceServers?: RTCIceServer[];
  url?: string;
};

const CONNECT_TIMEOUT_MS = 20_000;
/** Agent audio above this level counts as speech when the call sends no talking events. */
const SPEECH_LEVEL = 0.02;
const SPEECH_HOLD_MS = 450;

const STATUS: Record<Phase, string> = {
  checking: "Getting ready",
  unavailable: "Unavailable",
  ready: "Ready when you are",
  mic: "Waiting for microphone access",
  connecting: "Connecting",
  live: "Listening",
  ended: "Call ended",
  error: "Something went wrong",
};

const formatDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Wording for a failed getUserMedia call. */
function micErrorMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was blocked. Allow the microphone for this site in your browser's address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Connect one and try again.";
  }
  if (name === "NotReadableError") {
    return "Your microphone is in use by another app. Close it and try again.";
  }
  return "We could not access your microphone. Check your browser settings and try again.";
}

/** One equalizer bar whose height follows the agent's audio level. */
function LevelBar({ level, gain, reduce }: { level: MotionValue<number>; gain: number; reduce: boolean }) {
  const scaleY = useTransform(level, (v) => (reduce ? 0.3 : Math.max(0.18, Math.min(1, 0.18 + v * gain))));
  return <motion.span className="h-8 w-1 origin-center rounded-full bg-brand" style={{ scaleY }} />;
}

/**
 * Web call with the Retell voice agent.
 *
 * The Retell SDK is imported only when a call starts. The browser never sees the Retell
 * API key: /api/retell/web-call creates the call on the server and returns a short-lived
 * access token for this one call.
 */
export function VoiceCallPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const reduce = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState("");
  const [needsTurnstile, setNeedsTurnstile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [muted, setMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);

  const client = useRef<RetellWebClient | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  /** Bumped on every start and every teardown; late async results from an old attempt are ignored. */
  const attempt = useRef(0);
  const startedAt = useRef(0);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTalkingEvents = useRef(false);
  const speakingRef = useRef(false);
  const lastLoudAt = useRef(0);

  // Agent audio level, 0 to 1. A motion value, so the orb animates without re-rendering React.
  const level = useMotionValue(0);
  const smooth = useSpring(level, { stiffness: 220, damping: 24, mass: 0.6 });
  const haloScale = useTransform(smooth, [0, 1], reduce ? [1, 1] : [1, 1.55]);
  const haloOpacity = useTransform(smooth, [0, 1], [0.18, 0.55]);
  const coreScale = useTransform(smooth, [0, 1], reduce ? [1, 1] : [1, 1.12]);

  const setSpeaking = useCallback((value: boolean) => {
    if (speakingRef.current !== value) {
      speakingRef.current = value;
      setAgentSpeaking(value);
    }
  }, []);

  /** Stops the call and releases the microphone. Safe to call at any time, any number of times. */
  const teardown = useCallback(() => {
    attempt.current += 1;
    if (connectTimer.current) clearTimeout(connectTimer.current);
    connectTimer.current = null;
    const current = client.current;
    client.current = null;
    if (current) {
      current.removeAllListeners();
      try {
        current.stopCall();
      } catch {
        // Already stopped.
      }
    }
    level.set(0);
    setSpeaking(false);
    setMuted(false);
  }, [level, setSpeaking]);

  // Closing the panel or leaving the page always ends the call.
  useEffect(() => {
    if (!open) teardown();
  }, [open, teardown]);
  useEffect(() => teardown, [teardown]);

  // Each time the panel opens: reset, then ask the server whether calls are available.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("checking");
    setMessage("");
    setSeconds(0);
    setTranscript([]);
    setShowTranscript(false);
    setTurnstileToken("");
    fetch("/api/retell/web-call", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ available?: boolean; turnstile?: boolean }>)
      .then((config) => {
        if (cancelled) return;
        setNeedsTurnstile(Boolean(config.turnstile));
        setPhase(config.available ? "ready" : "unavailable");
      })
      .catch(() => !cancelled && setPhase("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Call timer.
  useEffect(() => {
    if (phase !== "live") return;
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const fail = useCallback(
    (text: string) => {
      teardown();
      setMessage(text);
      setPhase("error");
      // Turnstile tokens are single use.
      turnstile.current?.reset();
      setTurnstileToken("");
    },
    [teardown],
  );

  const start = useCallback(async () => {
    teardown();
    const id = attempt.current;
    const stale = () => attempt.current !== id;
    setMessage("");
    setTranscript([]);
    setSeconds(0);
    hasTalkingEvents.current = false;

    // 1. Microphone. Asked for here, right after the click, so the browser shows its prompt.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail("Voice calls need a secure (HTTPS) page and a browser with microphone support.");
      return;
    }
    setPhase("mic");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission is all we needed: the SDK opens its own stream when the call starts.
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      if (!stale()) fail(micErrorMessage(err));
      return;
    }
    if (stale()) return;

    // 2. Ask our server for a call, and download the SDK at the same time.
    setPhase("connecting");
    connectTimer.current = setTimeout(() => {
      if (!stale()) fail(`The call could not connect. Please try again, or call us at ${SITE.phoneDisplay}.`);
    }, CONNECT_TIMEOUT_MS);

    let grant: CallGrant;
    let sdk: typeof import("retell-client-js-sdk");
    try {
      const [response, loaded] = await Promise.all([
        fetch("/api/retell/web-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnstileToken, page: window.location.pathname }),
          cache: "no-store",
        }),
        import("retell-client-js-sdk"),
      ]);
      if (stale()) return;
      const body = (await response.json().catch(() => ({}))) as Partial<CallGrant> & { message?: string };
      if (!response.ok || !body.accessToken || !body.callId) {
        fail(body.message ?? `The voice assistant is not available right now. Call us at ${SITE.phoneDisplay}.`);
        return;
      }
      grant = body as CallGrant;
      sdk = loaded;
    } catch {
      if (!stale()) fail("We could not reach the voice assistant. Check your connection and try again.");
      return;
    }
    if (stale()) return;

    // 3. Join the call.
    const retell = new sdk.RetellWebClient();
    client.current = retell;

    retell.on("call_started", () => {
      if (stale()) return;
      if (connectTimer.current) clearTimeout(connectTimer.current);
      startedAt.current = Date.now();
      setPhase("live");
    });
    retell.on("call_ended", () => {
      if (stale()) return;
      teardown();
      setPhase("ended");
    });
    // Exact speaking boundaries, when the call provides them.
    retell.on("agent_start_talking", () => {
      hasTalkingEvents.current = true;
      if (!stale()) setSpeaking(true);
    });
    retell.on("agent_stop_talking", () => {
      hasTalkingEvents.current = true;
      if (!stale()) setSpeaking(false);
    });
    // Agent audio snapshots, one per animation frame: drives the orb, and stands in for
    // the talking events on calls that do not send them.
    retell.on("audio", (samples: Float32Array) => {
      if (stale()) return;
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / Math.max(1, samples.length));
      level.set(Math.min(1, rms * 5));
      if (hasTalkingEvents.current) return;
      const now = performance.now();
      if (rms > SPEECH_LEVEL) {
        lastLoudAt.current = now;
        setSpeaking(true);
      } else if (now - lastLoudAt.current > SPEECH_HOLD_MS) {
        setSpeaking(false);
      }
    });
    // Live transcript, when the call provides it. The whole list arrives each time.
    retell.on("update", (update: { transcript?: { role?: string; content?: string }[] }) => {
      if (stale() || !Array.isArray(update?.transcript)) return;
      setTranscript(
        update.transcript
          .filter((u): u is Line => (u.role === "agent" || u.role === "user") && typeof u.content === "string" && u.content.trim() !== "")
          .slice(-40),
      );
    });
    retell.on("error", () => {
      if (!stale()) fail(`The call was interrupted. Please try again, or call us at ${SITE.phoneDisplay}.`);
    });

    await retell.startCall({
      accessToken: grant.accessToken,
      callId: grant.callId,
      transport: grant.transport,
      iceServers: grant.iceServers,
      url: grant.url,
      emitRawAudioSamples: true,
    });
  }, [fail, level, setSpeaking, teardown, turnstileToken]);

  const hangUp = () => {
    teardown();
    setPhase("ended");
    turnstile.current?.reset();
    setTurnstileToken("");
  };

  const toggleMute = () => {
    if (!client.current) return;
    if (muted) client.current.unmute();
    else client.current.mute();
    setMuted(!muted);
  };

  const busy = phase === "mic" || phase === "connecting" || phase === "live";
  const status = phase === "live" ? (agentSpeaking ? "Agent speaking" : muted ? "You are muted" : "Listening") : STATUS[phase];
  const canStart = phase === "ready" || phase === "ended" || phase === "error";
  const waitingForCheck = needsTurnstile && !turnstileToken;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // A stray click outside must not hang up a live call. Escape and the close button still do.
        onInteractOutside={(event) => busy && event.preventDefault()}
        className="dialog-mobile-sheet overflow-hidden border-white/10 bg-neutral-950 text-white ring-white/10 max-sm:flex max-sm:flex-col max-sm:gap-0 sm:max-w-md sm:p-0"
      >
        <div className="relative max-sm:flex max-sm:flex-1 max-sm:flex-col max-sm:px-2 max-sm:pb-2 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold text-white">NexDrive AI assistant</DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                Ask about inventory, pricing or booking a test drive.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={busy ? "End call and close" : "Close"}
              className="grid size-11 shrink-0 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white sm:size-8"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Orb */}
          <div className="relative mx-auto mt-8 grid size-44 place-items-center max-sm:mt-auto" aria-hidden="true">
            <motion.span
              className="absolute inset-4 rounded-full bg-brand blur-2xl"
              style={{ scale: haloScale, opacity: haloOpacity }}
            />
            {!reduce && (phase === "connecting" || phase === "mic" || phase === "checking") ? (
              <motion.span
                className="absolute inset-2 rounded-full border border-brand/50"
                animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0.2, 0.7] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : null}
            {!reduce && phase === "live" && !agentSpeaking ? (
              <motion.span
                className="absolute inset-3 rounded-full border border-white/25"
                animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.25, 0.5] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : null}
            <motion.span
              className={cn(
                "relative grid size-28 place-items-center rounded-full bg-gradient-to-br from-brand to-amber-600 text-ink shadow-2xl transition-[filter] duration-500",
                (phase === "ended" || phase === "error" || phase === "unavailable") && "grayscale",
              )}
              style={{ scale: coreScale }}
            >
              {phase === "live" ? (
                <span className="flex items-center gap-1">
                  {[2.2, 3.4, 4.6, 3.4, 2.2].map((gain, i) => (
                    <LevelBar key={i} level={smooth} gain={gain} reduce={reduce} />
                  ))}
                </span>
              ) : phase === "mic" || phase === "connecting" || phase === "checking" ? (
                <Loader2 className="size-9 animate-spin" />
              ) : (
                <Sparkles className="size-10" />
              )}
            </motion.span>
          </div>

          {/* Status and timer */}
          <div className="mt-6 text-center" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={status}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="text-lg font-semibold tracking-tight"
              >
                {status}
              </motion.p>
            </AnimatePresence>
            {phase === "live" || (phase === "ended" && seconds > 0) ? (
              <p className="mt-1 font-mono text-sm tabular-nums text-neutral-400" aria-label={`Call time ${formatDuration(seconds)}`}>
                {formatDuration(seconds)}
              </p>
            ) : null}
          </div>

          {/* Messages */}
          {phase === "error" ? (
            <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-center text-sm text-rose-100">
              {message}
            </p>
          ) : null}
          {phase === "unavailable" ? (
            <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-sm text-neutral-200">
              The voice assistant is not available right now. Call us at{" "}
              <a href={`tel:${SITE.phone}`} className="font-semibold underline underline-offset-4">
                {SITE.phoneDisplay}
              </a>
              .
            </p>
          ) : null}

          {/* Controls */}
          <div className="mt-6 max-sm:mt-auto max-sm:pt-8">
            {busy ? (
              <div className="flex items-center justify-center gap-6 sm:gap-4">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={phase !== "live"}
                  aria-pressed={muted}
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                  className={cn(
                    "grid size-[4.5rem] place-items-center rounded-full border transition-colors disabled:opacity-40 sm:size-14",
                    muted ? "border-white bg-white text-neutral-950" : "border-white/20 bg-white/5 text-white hover:bg-white/15",
                  )}
                >
                  {muted ? <MicOff className="size-6 sm:size-5" aria-hidden="true" /> : <Mic className="size-6 sm:size-5" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={hangUp}
                  aria-label="End call"
                  className="grid size-[4.5rem] place-items-center rounded-full bg-rose-600 text-white transition-colors hover:bg-rose-500 sm:size-14"
                >
                  <PhoneOff className="size-6 sm:size-5" aria-hidden="true" />
                </button>
              </div>
            ) : canStart ? (
              <div className="space-y-4">
                {needsTurnstile ? (
                  <div className="flex justify-center">
                    <TurnstileField enabled ref={turnstile} onToken={setTurnstileToken} />
                  </div>
                ) : null}
                <Button onClick={start} disabled={waitingForCheck} className="h-12 w-full text-base">
                  <PhoneCall aria-hidden="true" />
                  {phase === "ready" ? "Start call" : "Call again"}
                </Button>
                <p className="text-center text-xs text-neutral-400">Uses your microphone. Calls may be recorded.</p>
              </div>
            ) : phase === "unavailable" ? (
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Close
              </Button>
            ) : null}
          </div>
        </div>

        {/* Live transcript: only when the call sends one, collapsed by default. */}
        {transcript.length > 0 ? (
          <div className="border-t border-white/10 max-sm:-mx-4">
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              aria-expanded={showTranscript}
              aria-controls="voice-call-transcript"
              className="flex w-full items-center justify-between px-6 py-3 text-xs font-medium text-neutral-300 hover:text-white"
            >
              {showTranscript ? "Hide transcript" : "Show transcript"}
              <ChevronDown className={cn("size-4 transition-transform", showTranscript && "rotate-180")} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {showTranscript ? (
                <motion.div
                  id="voice-call-transcript"
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ol className="max-h-48 space-y-2 overflow-y-auto px-6 pb-5 text-sm" aria-label="Call transcript">
                    {transcript.map((line, i) => (
                      // The list is replaced wholesale on every update, so position is the identity.
                      <li key={`${i}-${line.role}`} className={cn("flex", line.role === "user" && "justify-end")}>
                        <span
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2",
                            line.role === "user" ? "bg-brand text-ink" : "bg-white/10 text-neutral-100",
                          )}
                        >
                          <span className="sr-only">{line.role === "user" ? "You: " : "Assistant: "}</span>
                          {line.content}
                        </span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
