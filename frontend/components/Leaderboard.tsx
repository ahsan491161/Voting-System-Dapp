"use client";

import { useDispatch, useSelector } from "react-redux";
import { voteFor } from "@/redux/slices/votingSlice";
import type { AppDispatch, RootState } from "@/redux/store";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { candidates, registered, voted, status, tx } = useSelector((s: RootState) => s.voting);

  if (candidates.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-title">
          <span className="panel-icon">🏆</span> Top Candidates
        </h2>
        <p className="hint">No candidates yet. The election owner can launch the slate from the Election Control panel.</p>
      </div>
    );
  }

  const ranked = [...candidates].sort((a, b) => b.voteCount - a.voteCount);
  const leaderVotes = Math.max(ranked[0].voteCount, 1);
  const canVote = status === "connected" && registered && !voted;
  const voting = tx.state === "pending";

  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="panel-icon">🏆</span> Top Candidates
      </h2>
      <div className="leaderboard">
        {ranked.map((c, i) => {
          const rank = i + 1;
          const width = Math.round((c.voteCount / leaderVotes) * 100);
          const medal = rank <= 3 ? MEDALS[rank - 1] : null;
          return (
            <div key={c.id} className={`leader-row ${rank <= 3 ? `rank-${rank}` : ""}`}>
              <div className="leader-rank" title={`Rank ${rank}`}>
                {medal ?? `#${rank}`}
              </div>
              <div className="leader-info">
                <div className="leader-name">
                  {c.name} <span className="leader-id mono">#{c.id}</span>
                </div>
                <div className="leader-bar-track">
                  <div className="leader-bar-fill" style={{ width: `${width}%` }} />
                </div>
              </div>
              <div className="leader-votes">
                <span className="leader-votes-num">{c.voteCount}</span>
                <span className="leader-votes-label">votes</span>
              </div>
              <button
                className="btn btn-primary btn-small leader-vote-btn"
                disabled={!canVote || voting}
                onClick={() => dispatch(voteFor(c.id))}
              >
                {voting ? <span className="spinner" /> : "🗳 VOTE"}
              </button>
            </div>
          );
        })}
      </div>
      {!registered && <p className="hint center">Register to vote — see Voter Status panel.</p>}
      {registered && voted && <p className="hint center">You have already cast your ballot.</p>}
    </div>
  );
}
