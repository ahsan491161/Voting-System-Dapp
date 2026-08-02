"use client";

import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";
import { CHAIN } from "@/lib/contract";

function Stat({
  icon,
  label,
  value,
  sub,
  live = false,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  live?: boolean;
}) {
  return (
    <div className={`stat-card ${live ? "stat-live" : ""}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  );
}

export default function StatsStrip() {
  const { totalVotes, candidates, knownVoters, chainId, status } = useSelector((s: RootState) => s.voting);
  const connected = status === "connected" || status === "wrong-network";
  const live = status === "connected";

  return (
    <section className="stats-grid" aria-label="Live statistics">
      <Stat
        icon="🗳"
        label="Total votes"
        value={totalVotes.toString()}
        sub="cast on-chain"
        live={live}
      />
      <Stat
        icon="🏁"
        label="Contenders"
        value={candidates.length.toString()}
        sub="in the running"
        live={live}
      />
      <Stat
        icon="🛡"
        label="Known voters"
        value={knownVoters.toString()}
        sub="registered"
      />
      <Stat
        icon={live ? "📡" : "🔌"}
        label={live ? "Live" : "Offline"}
        value={live ? "LIVE" : "DISCONNECTED"}
        sub={connected ? `${chainId ?? CHAIN.chainId} · ${CHAIN.name}` : "connect to sync"}
        live={live}
      />
    </section>
  );
}
