"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { connectWallet, disconnectWallet, refreshData, restoreSession, switchNetwork } from "@/redux/slices/votingSlice";
import type { AppDispatch, RootState } from "@/redux/store";
import { CHAIN, shortAddress } from "@/lib/contract";

export default function Header() {
  const dispatch = useDispatch<AppDispatch>();
  const pathname = usePathname();
  const { status, account, chainId, systemName, loading, balance } = useSelector((s: RootState) => s.voting);

  // Silent reconnect after refresh, on every page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await dispatch(restoreSession());
      if (restoreSession.fulfilled.match(res) && !cancelled) {
        await dispatch(refreshData());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const onConnect = async () => {
    const res = await dispatch(connectWallet());
    if (connectWallet.fulfilled.match(res)) {
      await dispatch(refreshData());
    }
  };

  const onSwitchAndConnect = async () => {
    const res = await dispatch(switchNetwork());
    if (switchNetwork.fulfilled.match(res)) {
      await onConnect();
    }
  };

  const onDisconnect = () => {
    dispatch(disconnectWallet());
  };

  const connected = status === "connected" || status === "wrong-network";

  return (
    <header className="header">
      <div className="header-left">
        <Link href="/" className="brand">
          <span className="brand-icon">⬢</span>
          <span className="brand-name">NEO&nbsp;VOTE</span>
          {systemName && <span className="brand-sub hide-sm">{systemName}</span>}
        </Link>

        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
            Dashboard
          </Link>
          <Link href="/explorer" className={`nav-link ${pathname === "/explorer" ? "active" : ""}`}>
            ⛓ Explorer
          </Link>
        </nav>
      </div>

      <div className="header-right">
        {status === "wrong-network" && (
          <button className="btn btn-warn btn-small" onClick={onSwitchAndConnect}>
            Switch to {CHAIN.name}
          </button>
        )}
        {!connected && (
          <button className="btn btn-primary btn-small" onClick={onConnect} disabled={status === "connecting" || loading}>
            {status === "connecting" ? <span className="spinner" /> : "Connect Wallet"}
          </button>
        )}
        {connected && account && (
          <div className="account-chip">
            <span className={`dot ${status === "connected" ? "dot-ok" : "dot-bad"}`} />
            <span className="account-balance" title="Available balance">
              {balance ?? "0.0000"} <em>GO</em>
            </span>
            <span className="account-addr">{shortAddress(account)}</span>
            <span className="account-chain hide-sm">{chainId === CHAIN.chainId ? "Hardhat" : `Chain ${chainId}`}</span>
            <button className="btn btn-ghost btn-small" onClick={onDisconnect} title="Disconnect">
              ✕
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
