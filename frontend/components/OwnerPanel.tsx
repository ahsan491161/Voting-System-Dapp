"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addCandidate, registerVoter } from "@/redux/slices/votingSlice";
import type { AppDispatch, RootState } from "@/redux/store";
import { CHAIN } from "@/lib/contract";

export default function OwnerPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { isOwner, status, candidates, tx } = useSelector((s: RootState) => s.voting);
  const [candidateName, setCandidateName] = useState("");
  const [voterAddress, setVoterAddress] = useState("");

  if (!isOwner || status !== "connected") return null;

  const pending = tx.state === "pending";

  const submitCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) return;
    dispatch(addCandidate(candidateName.trim()));
    setCandidateName("");
  };

  const submitVoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(voterAddress.trim())) {
      alert("Enter a valid 0x address");
      return;
    }
    dispatch(registerVoter(voterAddress.trim()));
    setVoterAddress("");
  };

  return (
    <div className="panel owner-panel">
      <h2 className="panel-title">
        <span className="panel-icon">⚙</span> Election Control
      </h2>
      <p className="hint">
        Admin console — you own this election ({CHAIN.name}). {candidates.length} candidate
        {candidates.length === 1 ? "" : "s"} on the slate so far.
      </p>

      <div className="admin-section">
        <h3 className="admin-section-title">
          <span>🗳</span> Add candidate
        </h3>
        <form className="form" onSubmit={submitCandidate}>
          <div className="form-row">
            <input
              className="input"
              placeholder="Candidate name…"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              maxLength={64}
            />
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? <span className="spinner" /> : "ADD"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-section">
        <h3 className="admin-section-title">
          <span>📋</span> Register voter
        </h3>
        <form className="form" onSubmit={submitVoter}>
          <div className="form-row">
            <input
              className="input mono"
              placeholder="0x…"
              value={voterAddress}
              onChange={(e) => setVoterAddress(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? <span className="spinner" /> : "REGISTER"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
