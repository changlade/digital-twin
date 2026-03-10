/**
 * Hybrid real-time hook:
 *  1. On mount, fetches /api/stream-history (last 5 min) immediately so the chart
 *     is pre-populated before the first poll cycle.
 *  2. Polls /api/stream-poll every 2 s for new events, deduplicating by key.
 *
 * Replaces the original SSE approach — Databricks Apps' HTTP/2 reverse proxy
 * kills persistent EventSource connections with ERR_HTTP2_PROTOCOL_ERROR.
 */
import { useEffect, useRef, useState } from "react";
import type { SensorEvent } from "../lib/types";

const MAX_BUFFER = 300;  // keep last 300 data points (~10 min)
const POLL_MS    = 2_000;

interface UseSSEResult {
  events: SensorEvent[];
  status: "connecting" | "live" | "error" | "closed";
  lastTs: string | null;
  eventRate: number;
}

export function useSSE(_url: string): UseSSEResult {
  const [events, setEvents]     = useState<SensorEvent[]>([]);
  const [status, setStatus]     = useState<UseSSEResult["status"]>("connecting");
  const [lastTs, setLastTs]     = useState<string | null>(null);
  const [eventRate, setEventRate] = useState(0);

  const recentCountRef = useRef(0);
  const rateTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenRef        = useRef<Set<string>>(new Set());

  const addEvents = (incoming: SensorEvent[], ts?: string) => {
    const newEvents = incoming.filter((e) => {
      const key = `${e.event_ts}|${e.equipment_id}|${e.event_type}`;
      if (seenRef.current.has(key)) return false;
      seenRef.current.add(key);
      return true;
    });
    if (seenRef.current.size > 10_000) {
      seenRef.current = new Set([...seenRef.current].slice(-5_000));
    }
    if (newEvents.length > 0) {
      recentCountRef.current += newEvents.length;
      if (ts) setLastTs(ts);
      setEvents((prev) => [...prev, ...newEvents].slice(-MAX_BUFFER));
    }
  };

  useEffect(() => {
    let active = true;

    // ── Step 1: backfill from history (last 5 min) ──────────────────────────
    fetch("/api/stream-history")
      .then((r) => r.json())
      .then((payload) => {
        if (!active) return;
        // history returns events oldest-first for correct chart order
        addEvents(payload.events ?? [], payload.ts);
        setStatus("live");
      })
      .catch(() => { /* non-fatal — polling will still start */ });

    // ── Step 2: live polling every 2 s ──────────────────────────────────────
    const poll = async () => {
      try {
        const res = await fetch("/api/stream-poll");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (!active) return;
        addEvents(payload.events ?? [], payload.ts);
        setStatus("live");
      } catch {
        if (active) setStatus("error");
      }
    };

    // Small delay so history loads first, then polling takes over
    const startPoll = setTimeout(() => {
      poll();
      pollTimerRef.current = setInterval(poll, POLL_MS);
    }, 500);

    // Event-rate counter resets every 5 s
    rateTimerRef.current = setInterval(() => {
      setEventRate(Math.round(recentCountRef.current / 5));
      recentCountRef.current = 0;
    }, 5_000);

    return () => {
      active = false;
      clearTimeout(startPoll);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (rateTimerRef.current) clearInterval(rateTimerRef.current);
      setStatus("closed");
    };
  }, []);

  return { events, status, lastTs, eventRate };
}
