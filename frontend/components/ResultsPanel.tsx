"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function ResultsPanel() {
  const { candidates, winner, loading, lastSynced } = useSelector((s: RootState) => s.voting);
  const now = useNow(8000);

  if (candidates.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-title">
          <span className="panel-icon">📊</span> Live Results
        </h2>
        <p className="hint">Results appear once candidates exist.</p>
      </div>
    );
  }

  const total = candidates.reduce((sum, c) => sum + c.voteCount, 0);
  const maxVotes = Math.max(...candidates.map((c) => c.voteCount), 1);
  const syncedAgo = lastSynced ? Math.max(0, Math.round((now - lastSynced) / 1000)) : null;

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h2 className="panel-title">
          <span className="panel-icon">📊</span> Live Results
        </h2>
        {syncedAgo !== null && (
          <span className="sync-note">
            <span className="live-dot" /> synced {syncedAgo}s ago
          </span>
        )}
      </div>

      {winner && (
        <div className="winner-banner">
          <span className="winner-crown">👑</span>
          <div>
            <div className="winner-label">CURRENT WINNER</div>
            <div className="winner-name">
              #{winner.id} {winner.name}
            </div>
          </div>
          <span className="winner-pct">
            {total > 0
              ? Math.round(((candidates.find((c) => c.id === winner.id)?.voteCount ?? 0) / total) * 100)
              : 0}
            %
          </span>
        </div>
      )}

      <div className="bars">
        {candidates.map((c) => {
          const pct = total === 0 ? 0 : Math.round((c.voteCount / total) * 100);
          const width = total === 0 ? 0 : Math.round((c.voteCount / maxVotes) * 100);
          const leading = winner && c.id === winner.id;
          return (
            <div key={c.id} className="bar-row">
              <div className="bar-meta">
                <span className="bar-name">
                  {leading && "★ "}#{c.id} {c.name}
                </span>
                <span className="bar-nums">
                  {c.voteCount} / {total} · {pct}%
                </span>
              </div>
              <div className="bar-track">
                <div className={`bar-fill ${leading ? "bar-fill-lead" : ""}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {loading && <p className="hint center">Syncing with chain…</p>}
    </div>
  );
}
