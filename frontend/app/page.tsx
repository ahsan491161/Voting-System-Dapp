"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Header from "@/components/Header";
import WalletCard from "@/components/WalletCard";
import Leaderboard from "@/components/Leaderboard";
import ResultsPanel from "@/components/ResultsPanel";
import OwnerPanel from "@/components/OwnerPanel";
import StatsStrip from "@/components/StatsStrip";
import ElectionCard from "@/components/ElectionCard";
import ActivityFeed from "@/components/ActivityFeed";
import TxToast from "@/components/TxToast";
import { connectWallet, refreshData } from "@/redux/slices/votingSlice";
import { subscribeToContractEvents } from "@/lib/events";
import type { AppDispatch, RootState } from "@/redux/store";

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { status, systemName, loading, candidates, contract, tx } = useSelector((s: RootState) => s.voting);
  const connected = status === "connected" || status === "wrong-network";

  // Stream on-chain activity (votes, candidates, registrations) in real time
  useEffect(() => {
    if (contract) subscribeToContractEvents(contract);
  }, [contract]);

  // Lightweight polling keeps stats and results live
  useEffect(() => {
    if (status !== "connected") return;
    const id = setInterval(() => {
      dispatch(refreshData());
    }, 8000);
    return () => clearInterval(id);
  }, [dispatch, status]);

  const onConnect = async () => {
    const res = await dispatch(connectWallet());
    if (connectWallet.fulfilled.match(res)) {
      await dispatch(refreshData());
    }
  };

  return (
    <div className="app">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
      </div>

      <Header />

      <main className="main">
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-chips">
            <span className="chip">⛓ IMMUTABLE</span>
            <span className="chip">👁 TRANSPARENT</span>
            <span className="chip">🔒 TAMPER-PROOF</span>
          </div>
          <h1 className="hero-title">
            DECENTRALIZED
            <br />
            <span className="neon">VOTING&nbsp;SYSTEM</span>
          </h1>
          <p className="hero-sub">
            {systemName
              ? `Connected to "${systemName}" — every ballot is a transaction, every result is public.`
              : "Cast your ballot on the blockchain. Immutable, transparent, tamper-proof."}
          </p>
          <div className="hero-cta">
            {!connected && (
              <button
                className="btn btn-primary btn-lg"
                onClick={onConnect}
                disabled={status === "connecting" || loading}
              >
                {status === "connecting" ? <span className="spinner" /> : "⚡ Connect Wallet"}
              </button>
            )}
            {connected && (
              <span className="hero-synced mono">
                <span className="live-dot" /> live on-chain session
              </span>
            )}
          </div>
        </section>

        {!connected && (
          <section className="connect-cta">
            <div className="panel center-panel">
              <div className="cta-icon">🗳</div>
              <h2>Connect your wallet to vote</h2>
              <p className="hint">
                Use MetaMask on the Hardhat local network (chain {`{`}31337{`}`},{" "}
                <span className="mono">http://127.0.0.1:8545</span>) with one of the imported test accounts.
              </p>
              <button className="btn btn-primary btn-lg" onClick={onConnect} disabled={status === "connecting" || loading}>
                {status === "connecting" ? <span className="spinner" /> : "⚡ Connect Wallet"}
              </button>
            </div>
          </section>
        )}

        {connected && (
          <>
            <StatsStrip />
            <ElectionCard />

            <section className="dashboard">
              <div className="col col-main">
                <Leaderboard />
                <ResultsPanel />
              </div>
              <div className="col col-side">
                <WalletCard />
                <ActivityFeed />
                <OwnerPanel />
              </div>
            </section>
            {loading && candidates.length === 0 && <p className="hint center">Loading data from the blockchain…</p>}
          </>
        )}
      </main>

      <footer className="footer">
        <span className="mono">NEO VOTE</span> — learning DApp · Solidity + Hardhat + Next.js + Redux · data lives on-chain
        {tx.state !== "idle" && <span className="mono footer-tx">· synced live</span>}
      </footer>

      <TxToast />
    </div>
  );
}
