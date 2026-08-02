"use client";

import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";

export default function ElectionCard() {
  const { systemName, candidates, totalVotes, knownVoters, winner, status } = useSelector((s: RootState) => s.voting);
  const live = status === "connected";

  const participation = knownVoters > 0 ? Math.min(100, Math.round((totalVotes / knownVoters) * 100)) : 0;

  return (
    <section className="panel election-card">
      <div className="election-head">
        <div className="election-title">
          <span className="election-icon">⚡</span>
          <div>
            <div className="election-label">Ongoing Election</div>
            <h2 className="election-name">{systemName ?? "Blockchain Voting DApp"}</h2>
          </div>
        </div>
        <span className={`live-badge ${live ? "" : "live-off"}`}>
          <span className="live-dot" />
          {live ? "LIVE" : "PAUSED"}
        </span>
      </div>

      <div className="election-meta">
        <div className="election-meta-item">
          <span className="election-meta-label">Candidates</span>
          <span className="election-meta-value">{candidates.length}</span>
        </div>
        <div className="election-meta-item">
          <span className="election-meta-label">Votes cast</span>
          <span className="election-meta-value">{totalVotes}</span>
        </div>
        <div className="election-meta-item">
          <span className="election-meta-label">Known voters</span>
          <span className="election-meta-value">{knownVoters}</span>
        </div>
        <div className="election-meta-item">
          <span className="election-meta-label">Leader</span>
          <span className="election-meta-value election-leader">
            {winner ? `${winner.name}` : "—"}
          </span>
        </div>
      </div>

      <div className="election-progress">
        <div className="election-progress-meta">
          <span>Participation</span>
          <span className="mono">{participation}%</span>
        </div>
        <div className="bar-track">
          <div className="bar-fill bar-fill-lead" style={{ width: `${participation}%` }} />
        </div>
      </div>

      <p className="hint election-hint">
        Ballots settle instantly on-chain — every vote is a verified transaction, every result is immutable and public.
      </p>
    </section>
  );
}
