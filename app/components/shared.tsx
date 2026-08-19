"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntakeStatus } from "@/lib/intake/types";
import { INTAKE_STATUSES } from "@/lib/intake/types";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  INTAKE_STATUSES.map((s) => [s.id, s.label])
);

export function StatusPill({ status }: { status: IntakeStatus }) {
  return <span className={`status ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** Persisted "who am I" for attribution on the intake tracker (no auth in pilot). */
export function useCurrentUser(): [string, (n: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => {
    setName(localStorage.getItem("aid_user") || "");
  }, []);
  const update = (n: string) => {
    setName(n);
    localStorage.setItem("aid_user", n);
  };
  return [name, update];
}

/* ------------------------------- Pinned items ------------------------------- */

export interface Pin {
  id: string;
  kind: "session" | "usecase";
  label: string;
  href: string;
  at: number;
}

const PINS_KEY = "aid_pins";
const PINS_EVENT = "aid_pins_changed";

function readPins(): Pin[] {
  try {
    return JSON.parse(localStorage.getItem(PINS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writePins(pins: Pin[]) {
  localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  window.dispatchEvent(new Event(PINS_EVENT));
}

/** Pins synced across all components via a window event. */
export function usePins() {
  const [pins, setPins] = useState<Pin[]>([]);
  useEffect(() => {
    const sync = () => setPins(readPins());
    sync();
    window.addEventListener(PINS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PINS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((p: Omit<Pin, "at">) => {
    const current = readPins();
    const exists = current.some((x) => x.id === p.id);
    writePins(exists ? current.filter((x) => x.id !== p.id) : [{ ...p, at: Date.now() }, ...current]);
  }, []);

  const has = useCallback((id: string) => pins.some((x) => x.id === id), [pins]);
  return { pins, toggle, has };
}

/** A small pin/unpin toggle button for headers. */
export function PinButton({ pin }: { pin: Omit<Pin, "at"> }) {
  const { has, toggle } = usePins();
  const pinned = has(pin.id);
  return (
    <button
      className="btn ghost"
      onClick={() => toggle(pin)}
      title={pinned ? "Unpin" : "Pin to sidebar"}
      style={{ color: pinned ? "var(--brand)" : undefined }}
    >
      {pinned ? "★ Pinned" : "☆ Pin"}
    </button>
  );
}
