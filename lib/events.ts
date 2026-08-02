import { store } from "@/redux/store";
import { pushActivity, type ActivityItem, type VotingContract } from "@/redux/slices/votingSlice";

let subscribed = false;

interface ChainEvent {
  hash?: string;
  getBlock: () => Promise<{ timestamp: number }>;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function makeItem(type: ActivityItem["type"], title: string, addr: string | null, ev: ChainEvent, live: boolean, at: number): ActivityItem {
  return {
    id: `${ev.hash ?? type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    addr,
    hash: ev.hash ?? "",
    at,
    live,
  };
}

function attachLive(contract: VotingContract): void {
  contract.on(contract.getEvent("Voted"), (...args: unknown[]) => {
    const [voter, candidateId, ev] = args as [string, bigint, ChainEvent];
    const title = `Vote cast for candidate #${candidateId.toString()}`;
    store.dispatch(pushActivity(makeItem("vote", title, voter, ev, true, Date.now())));
  });

  contract.on(contract.getEvent("CandidateAdded"), (...args: unknown[]) => {
    const [, name, ev] = args as [bigint, string, ChainEvent];
    const title = `Candidate "${name}" added to the election`;
    store.dispatch(pushActivity(makeItem("candidate", title, null, ev, true, Date.now())));
  });

  contract.on(contract.getEvent("VoterRegistered"), (...args: unknown[]) => {
    const [voter, ev] = args as [string, ChainEvent];
    const title = `Voter ${shortAddr(voter)} registered`;
    store.dispatch(pushActivity(makeItem("register", title, voter, ev, true, Date.now())));
  });
}

async function seedHistory(contract: VotingContract): Promise<void> {
  const seeds: { kind: ActivityItem["type"]; name: string; build: (args: unknown[], ev: ChainEvent) => Omit<ActivityItem, "id" | "at" | "live" | "hash"> }[] = [
    {
      kind: "vote",
      name: "Voted",
      build: (args) => {
        const [voter, candidateId] = args as [string, bigint];
        return { type: "vote", title: `Vote cast for candidate #${candidateId.toString()}`, addr: voter };
      },
    },
    {
      kind: "candidate",
      name: "CandidateAdded",
      build: (args) => {
        const [, name] = args as [bigint, string];
        return { type: "candidate", title: `Candidate "${name}" added to the election`, addr: null };
      },
    },
    {
      kind: "register",
      name: "VoterRegistered",
      build: (args) => {
        const [voter] = args as [string];
        return { type: "register", title: `Voter ${shortAddr(voter)} registered`, addr: voter };
      },
    },
  ];

  for (const seed of seeds) {
    try {
      const events = (await contract.queryFilter(contract.getEvent(seed.name), -500)) as unknown[];
      const recent = events.slice(-10);
      for (const raw of recent) {
        const ev = raw as unknown as ChainEvent;
        let at = Date.now();
        try {
          const block = await ev.getBlock();
          at = block.timestamp * 1000;
        } catch {
          // keep local time fallback
        }
        const args = (raw as unknown as { args: unknown[] }).args ?? [];
        const base = seed.build(args, ev);
        store.dispatch(
          pushActivity({
            id: `${ev.hash ?? seed.name}-${at}-${Math.random().toString(36).slice(2, 6)}`,
            ...base,
            hash: ev.hash ?? "",
            at,
            live: false,
          })
        );
      }
    } catch {
      // history is best-effort; live feed keeps working
    }
  }
}

export function subscribeToContractEvents(contract: VotingContract): void {
  if (subscribed) return;
  subscribed = true;
  void seedHistory(contract);
  attachLive(contract);
}
