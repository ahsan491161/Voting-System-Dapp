"use client";

import { useDispatch, useSelector } from "react-redux";
import { registerSelf } from "@/redux/slices/votingSlice";
import type { AppDispatch, RootState } from "@/redux/store";
import { shortAddress } from "@/lib/contract";

export default function WalletCard() {
  const dispatch = useDispatch<AppDispatch>();
  const { account, registered, voted, isOwner, chainId, status, tx } = useSelector((s: RootState) => s.voting);

  if (!account) return null;

  const pending = tx.state === "pending";

  return (
    <div className="panel wallet-card">
      <h2 className="panel-title">
        <span className="panel-icon">🛡</span> Voter Status
      </h2>

      <div className="wallet-row">
        <span className="label">Wallet</span>
        <span className="mono">{shortAddress(account)}</span>
      </div>
      <div className="wallet-row">
        <span className="label">Network</span>
        <span className="mono">{chainId ?? "unknown"}</span>
      </div>
      <div className="wallet-row">
        <span className="label">Registered</span>
        <span className={`badge ${registered ? "badge-ok" : "badge-bad"}`}>
          {registered ? "YES" : "NO"}
        </span>
      </div>
      <div className="wallet-row">
        <span className="label">Has voted</span>
        <span className={`badge ${voted ? "badge-ok" : "badge-bad"}`}>{voted ? "YES" : "NO"}</span>
      </div>
      {isOwner && (
        <div className="wallet-row">
          <span className="label">Role</span>
          <span className="badge badge-owner">OWNER</span>
        </div>
      )}

      {status === "connected" && !registered && (
        <>
          <p className="hint">You are not registered yet. Register to unlock voting — a MetaMask popup will ask you to confirm the transaction.</p>
          <button
            className="btn btn-primary btn-block register-btn"
            disabled={pending}
            onClick={() => dispatch(registerSelf())}
          >
            {pending ? <span className="spinner" /> : "⚡ REGISTER TO VOTE"}
          </button>
        </>
      )}

      {registered && !voted && (
        <p className="hint">You can cast your single vote below — clicking VOTE opens a MetaMask confirmation.</p>
      )}
      {voted && <p className="hint">You already voted. Results below are live from the blockchain.</p>}
    </div>
  );
}
