"use client";

import { useDispatch, useSelector } from "react-redux";
import { clearTx } from "@/redux/slices/votingSlice";
import type { AppDispatch, RootState } from "@/redux/store";

export default function TxToast() {
  const dispatch = useDispatch<AppDispatch>();
  const { tx } = useSelector((s: RootState) => s.voting);

  if (tx.state === "idle") return null;

  const icon = tx.state === "success" ? "✓" : tx.state === "error" ? "✕" : "◌";

  return (
    <div className={`toast toast-${tx.state}`} role="status">
      <span className="toast-icon">{icon}</span>
      <div className="toast-body">
        <div className="toast-message">{tx.message}</div>
        {tx.hash && (
          <div className="toast-hash mono">
            tx: {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
          </div>
        )}
      </div>
      <button className="toast-close" onClick={() => dispatch(clearTx())} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
