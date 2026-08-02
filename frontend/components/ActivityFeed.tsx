"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";
import type { ActivityItem } from "@/redux/slices/votingSlice";

const ICONS: Record<ActivityItem["type"], string> = {
  vote: "🗳",
  candidate: "➕",
  register: "📋",
};

function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function ActivityFeed() {
  const { activity, status } = useSelector((s: RootState) => s.voting);
  const now = useNow(5000);
  const connected = status === "connected";

  return (
    <div className="panel feed-panel">
      <div className="panel-title-row">
        <h2 className="panel-title">
          <span className="panel-icon">📡</span> Live Activity
        </h2>
        <span className={`live-badge ${connected ? "" : "live-off"}`}>
          <span className="live-dot" />
          {connected ? "STREAMING" : "OFFLINE"}
        </span>
      </div>

      {activity.length === 0 ? (
        <div className="feed-empty">
          <span className="feed-empty-icon">◌</span>
          <p className="hint">
            {connected
              ? "Watching the chain for votes, candidates and registrations…"
              : "Connect your wallet to stream on-chain activity in real time."}
          </p>
        </div>
      ) : (
        <ul className="feed">
          {activity.map((item) => (
            <li key={item.id} className={`feed-item feed-${item.type}`}>
              <span className="feed-icon">{ICONS[item.type]}</span>
              <div className="feed-body">
                <div className="feed-title">{item.title}</div>
                <div className="feed-meta mono">
                  {item.addr ? `${item.addr.slice(0, 6)}…${item.addr.slice(-4)} · ` : ""}
                  {item.hash ? `${item.hash.slice(0, 10)}…${item.hash.slice(-6)}` : ""}
                </div>
              </div>
              <div className="feed-side">
                {item.live && <span className="feed-live">LIVE</span>}
                <span className="feed-time">{timeAgo(item.at, now)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
