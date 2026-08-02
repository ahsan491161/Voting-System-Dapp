"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JsonRpcProvider } from "ethers";
import Header from "@/components/Header";
import {
  fetchBlockTransactions,
  fetchLatestBlocks,
  fetchRecentTransactions,
  formatGo,
  isContractAddress,
  methodLabel,
  searchBlockOrTx,
  shortAddr,
  shortHash,
  GO,
  type ExplorerBlock,
  type ExplorerTxDetail,
} from "@/lib/explorer";
import { CHAIN } from "@/lib/contract";

const BLOCKS_TO_SHOW = 12;
const RECENT_TX_LIMIT = 15;
const POLL_MS = 6000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function timeAgo(atSec: number, now: number): string {
  const s = Math.max(0, Math.round(now / 1000 - atSec));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function TxRow({ tx, now, highlighted }: { tx: ExplorerTxDetail; now: number; highlighted: boolean }) {
  const method = methodLabel(tx.method, tx.args);
  const toLabel = isContractAddress(tx.to) ? "NEO VOTE" : tx.to ? shortAddr(tx.to) : "—";
  return (
    <div id={`tx-${tx.hash}`} className={`tx-row ${highlighted ? "tx-highlight" : ""}`}>
      <div className="tx-main">
        <div className="tx-hash mono" title={tx.hash}>
          {shortHash(tx.hash)}
        </div>
        <div className="tx-route mono">
          <span className="tx-addr" title={tx.from}>
            {shortAddr(tx.from)}
          </span>
          <span className="tx-arrow">→</span>
          <span className={`tx-addr ${tx.toContract ? "tx-addr-contract" : ""}`} title={tx.to ?? ""}>
            {toLabel}
          </span>
        </div>
        <span className="tx-block mono">block #{tx.blockNumber}</span>
        {method && (
          <span className="method-chip" title={method.detail ?? ""}>
            {method.label}
            {method.detail ? <em> · {method.detail}</em> : null}
          </span>
        )}
      </div>
      <div className="tx-values">
        <span className="tx-value">
          {formatGo(tx.value)} <em>{GO}</em>
        </span>
        <span className="tx-fee mono">fee {formatGo(tx.gasUsed * (tx.gasPrice ?? BigInt(0)))}</span>
        <span className="tx-time">{timeAgo(tx.timestamp, now)}</span>
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  const now = useNow(5000);
  const [provider] = useState<JsonRpcProvider | null>(
    () => (typeof window === "undefined" ? null : new JsonRpcProvider(CHAIN.rpcUrl))
  );
  const [blocks, setBlocks] = useState<ExplorerBlock[]>([]);
  const [latest, setLatest] = useState<number | null>(null);
  const [recentTxs, setRecentTxs] = useState<ExplorerTxDetail[]>([]);
  const [expanded, setExpanded] = useState<Record<number, ExplorerTxDetail[]>>({});
  const [loadingTxs, setLoadingTxs] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ hash: string; block: number } | null>(null);
  const [searchedBlock, setSearchedBlock] = useState<ExplorerBlock | null>(null);
  const recentRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!provider) return;
    try {
      const [latestBlock, list, recent] = await Promise.all([
        provider.getBlockNumber(),
        fetchLatestBlocks(provider, BLOCKS_TO_SHOW),
        fetchRecentTransactions(provider, RECENT_TX_LIMIT),
      ]);
      setLatest(latestBlock);
      setBlocks(list);
      setRecentTxs(recent);
      setOnline(true);
      setError(null);
    } catch (e) {
      setOnline(false);
      setError(e instanceof Error ? e.message : "Cannot reach the local node");
    }
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    const initial = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [load, provider]);

  const toggleBlock = useCallback(
    async (number: number) => {
      if (!provider) return;
      if (expanded[number]) {
        setExpanded((prev) => {
          const next = { ...prev };
          delete next[number];
          return next;
        });
        return;
      }
      setLoadingTxs(number);
      try {
        const txs = await fetchBlockTransactions(provider, number);
        setExpanded((prev) => ({ ...prev, [number]: txs }));
      } catch {
        setError("Failed to load transactions");
      } finally {
        setLoadingTxs(null);
      }
    },
    [expanded, provider]
  );

  const scrollToTx = (hash: string) => {
    setTimeout(() => {
      document.getElementById(`tx-${hash}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setHighlight(null);
    setSearchedBlock(null);
    const trimmed = searchInput.trim();
    if (!trimmed || !provider) return;

    if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed) && !/^\d+$/.test(trimmed)) {
      setSearchError("Enter a block number (e.g. 12) or a transaction hash (0x…)");
      return;
    }

    try {
      const result = await searchBlockOrTx(provider, trimmed);
      if (!result) {
        setSearchError(trimmed.startsWith("0x") ? "Transaction not found" : `Block "${trimmed}" not found`);
        return;
      }
      if (result.kind === "block") {
        setSearchedBlock(result.block);
        setSearchError(null);
        setSearchInput("");
        setTimeout(() => recentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else {
        setExpanded((prev) => ({ ...prev, [result.blockNumber]: result.txs }));
        setHighlight({ hash: result.tx.hash, block: result.blockNumber });
        setSearchError(null);
        setSearchInput("");
        scrollToTx(result.tx.hash);
      }
    } catch {
      setSearchError("Search failed — is the node running?");
    }
  };

  const totalShownTxs = blocks.reduce((sum, b) => sum + b.txCount, 0);

  return (
    <div className="app">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
      </div>

      <Header />

      <main className="main">
        <section className="hero explorer-hero">
          <div className="hero-chips">
            <span className="chip">⛓ PRIVATE CHAIN</span>
            <span className="chip">🆔 CHAIN 31337</span>
            <span className="chip">⚡ LOCAL NODE</span>
          </div>
          <h1 className="hero-title">
            BLOCKCHAIN
            <br />
            <span className="neon">EXPLORER</span>
          </h1>
          <p className="hero-sub">
            Browse every block and transaction on the NEO VOTE private blockchain — all data comes straight from{" "}
            <span className="mono">{CHAIN.rpcUrl}</span>.
          </p>
          <div className="hero-cta">
            <span className={`hero-synced mono ${online ? "" : "hero-offline"}`}>
              <span className={`live-dot ${online ? "" : "dot-bad"}`} />
              {online ? `node live · block #${latest ?? "…"}` : "node offline"}
            </span>
            <form className="jump-form" onSubmit={handleSearch}>
              <input
                className="input jump-input"
                placeholder="Search block # or tx hash"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-small">
                SEARCH
              </button>
            </form>
          </div>
          {searchError && <p className="hint center">{searchError}</p>}
        </section>

        <section className="stats-grid explorer-stats" aria-label="Chain statistics">
          <div className="stat-card">
            <div className="stat-icon">🪨</div>
            <div className="stat-body">
              <div className="stat-label">Latest block</div>
              <div className="stat-value">#{latest ?? "…"}</div>
              <div className="stat-sub">chain tip</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🗃</div>
            <div className="stat-body">
              <div className="stat-label">Txs in view</div>
              <div className="stat-value">{totalShownTxs}</div>
              <div className="stat-sub">last {BLOCKS_TO_SHOW} blocks</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🧾</div>
            <div className="stat-body">
              <div className="stat-label">Recent txs</div>
              <div className="stat-value">{recentTxs.length}</div>
              <div className="stat-sub">latest on chain</div>
            </div>
          </div>
          <div className={`stat-card ${online ? "stat-live" : ""}`}>
            <div className="stat-icon">{online ? "📡" : "🔌"}</div>
            <div className="stat-body">
              <div className="stat-label">Node status</div>
              <div className="stat-value">{online ? "ONLINE" : "OFFLINE"}</div>
              <div className="stat-sub">auto-refresh {POLL_MS / 1000}s</div>
            </div>
          </div>
        </section>

        {!online && (
          <section className="panel offline-panel">
            <div className="offline-icon">🔌</div>
            <h2 className="offline-title">Local node unreachable</h2>
            <p className="hint center">
              Start it with <span className="mono">npx hardhat node</span>, then hit refresh — this page polls
              automatically.
            </p>
            {error && <p className="hint center mono">{error}</p>}
            <div className="center">
              <button className="btn btn-primary" onClick={() => void load()}>
                ↻ RETRY
              </button>
            </div>
          </section>
        )}

        {online && (
          <section ref={recentRef} className="recent-section">
            {searchedBlock && (
              <div className="block-card block-jumped">
                <div className="block-head">
                  <div className="block-num-wrap">
                    <span className="block-label">SEARCH RESULT</span>
                    <span className="block-num">#{searchedBlock.number}</span>
                    <span className="block-hash mono" title={searchedBlock.hash}>
                      {shortHash(searchedBlock.hash)}
                    </span>
                  </div>
                  <div className="block-meta">
                    <span className="block-time">{timeAgo(searchedBlock.timestamp, now)}</span>
                    <span className="tx-badge">{searchedBlock.txCount} tx</span>
                    <span className="block-gas mono">
                      {formatGo(searchedBlock.gasUsed)}/{formatGo(searchedBlock.gasLimit)} gas
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-title-row">
                <h2 className="panel-title">
                  <span className="panel-icon">🧾</span> Recent Transactions
                </h2>
                <span className="sync-note">
                  <span className="live-dot" /> live feed
                </span>
              </div>

              {recentTxs.length === 0 ? (
                <p className="hint center">No transactions yet — cast a vote and it will appear here instantly.</p>
              ) : (
                <div className="recent-list">
                  {recentTxs.map((tx) => (
                    <TxRow key={tx.hash} tx={tx} now={now} highlighted={highlight?.hash === tx.hash} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {online && (
          <section className="blocks">
            {blocks.map((block) => {
              const open = !!expanded[block.number];
              const txs = expanded[block.number] ?? [];
              return (
                <div key={block.number} className="block-card">
                  <div className="block-head">
                    <div className="block-num-wrap">
                      <span className="block-num">#{block.number}</span>
                      <span className="block-hash mono" title={block.hash}>
                        {shortHash(block.hash)}
                      </span>
                    </div>
                    <div className="block-meta">
                      <span className="block-time">{timeAgo(block.timestamp, now)}</span>
                      <span className="tx-badge">{block.txCount} tx</span>
                      <span className="block-gas mono">
                        {formatGo(block.gasUsed)}/{formatGo(block.gasLimit)} gas
                      </span>
                      {block.txCount > 0 && (
                        <button
                          className="btn btn-ghost btn-small"
                          onClick={() => void toggleBlock(block.number)}
                          disabled={loadingTxs === block.number}
                        >
                          {loadingTxs === block.number ? <span className="spinner" /> : open ? "HIDE TXS" : "VIEW TXS"}
                        </button>
                      )}
                    </div>
                  </div>

                  {open && txs.length === 0 && <p className="hint center">No transactions in this block.</p>}

                  {open && txs.length > 0 && (
                    <div className="tx-list">
                      {txs.map((tx) => (
                        <TxRow key={tx.hash} tx={tx} now={now} highlighted={highlight?.hash === tx.hash} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {blocks.length === 0 && <p className="hint center">Fetching blocks…</p>}
          </section>
        )}
      </main>

      <footer className="footer">
        <span className="mono">NEO VOTE</span> — explorer · reads {CHAIN.rpcUrl} · chain {CHAIN.chainId} · unit {GO}
      </footer>
    </div>
  );
}
