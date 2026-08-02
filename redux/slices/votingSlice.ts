import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { CHAIN, CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import type { RootState } from "@/redux/store";

const SESSION_KEY = "neovote.account";

export interface BrowserProviderLike {
  getBalance(address: string): Promise<bigint>;
  getNetwork(): Promise<{ chainId: bigint }>;
}

function formatBalance(wei: bigint): string {
  const value = Number(formatEther(wei));
  return value.toFixed(6).replace(/\.?0+$/, "");
}

export interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

export interface Winner {
  id: number;
  name: string;
}

export interface TxState {
  state: "idle" | "pending" | "success" | "error";
  message: string;
  hash?: string;
}

export interface ActivityItem {
  id: string;
  type: "vote" | "candidate" | "register";
  title: string;
  addr: string | null;
  hash: string;
  at: number;
  live: boolean;
}

interface TxResponse {
  hash: string;
  wait: () => Promise<void>;
}

// Minimal structural type for the contract instance we store in Redux.
// (The real `ethers.Contract` type trips up Immer's draft typing.)
export interface VotingContract {
  VOTING_SYSTEM_NAME(): Promise<string>;
  owner(): Promise<string>;
  candidatesCount(): Promise<bigint>;
  candidates(id: number): Promise<{ id: bigint; name: string; voteCount: bigint }>;
  voters(address: string): Promise<boolean>;
  hasVoted(address: string): Promise<boolean>;
  winner(): Promise<[bigint, string]>;
  vote(candidateId: number): Promise<TxResponse>;
  addCandidate(name: string): Promise<TxResponse>;
  registerVoter(address: string): Promise<TxResponse>;
  register(): Promise<TxResponse>;
  getEvent(name: string): unknown;
  queryFilter(event: unknown, fromBlock?: number | string): Promise<unknown[]>;
  on(event: unknown, listener: (...args: unknown[]) => void): unknown;
}

interface VotingState {
  status: "disconnected" | "connecting" | "connected" | "wrong-network";
  account: string | null;
  chainId: number | null;
  contract: VotingContract | null;
  provider: BrowserProviderLike | null;
  balance: string | null;
  systemName: string | null;
  owner: string | null;
  candidates: Candidate[];
  winner: Winner | null;
  registered: boolean;
  voted: boolean;
  isOwner: boolean;
  loading: boolean;
  tx: TxState;
  totalVotes: number;
  knownVoters: number;
  lastSynced: number | null;
  activity: ActivityItem[];
}

const initialState: VotingState = {
  status: "disconnected",
  account: null,
  chainId: null,
  contract: null,
  provider: null,
  balance: null,
  systemName: null,
  owner: null,
  candidates: [],
  winner: null,
  registered: false,
  voted: false,
  isOwner: false,
  loading: false,
  tx: { state: "idle", message: "" },
  totalVotes: 0,
  knownVoters: 3,
  lastSynced: null,
  activity: [],
};

// Turn an ethers/unknown error into a readable message
function toMessage(error: unknown): string {
  const e = error as {
    reason?: string;
    shortMessage?: string;
    message?: string;
    info?: { error?: { message?: string } };
  };
  return e?.reason ?? e?.shortMessage ?? e?.info?.error?.message ?? e?.message ?? String(error);
}

// ---------------------------------------------------------------
// Thunks (async web3 calls)
// ---------------------------------------------------------------

export const connectWallet = createAsyncThunk(
  "voting/connectWallet",
  async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask not detected. Please install MetaMask to continue.");
    }
    const provider = new BrowserProvider(window.ethereum);
    const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
    const account = accounts[0];
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await provider.getSigner()) as unknown as VotingContract;
    const balance = formatBalance(await provider.getBalance(account));
    try {
      localStorage.setItem(SESSION_KEY, account);
    } catch {
      // storage may be unavailable; session just won't survive a refresh
    }
    return { account, chainId, contract, provider, balance };
  }
);

export const restoreSession = createAsyncThunk(
  "voting/restoreSession",
  async (_, { rejectWithValue }) => {
    if (typeof window === "undefined" || !window.ethereum) {
      return rejectWithValue("No wallet available");
    }
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SESSION_KEY);
    } catch {
      return rejectWithValue("No saved session");
    }
    if (!saved) return rejectWithValue("No saved session");

    const provider = new BrowserProvider(window.ethereum);
    const accounts = (await provider.send("eth_accounts", [])) as string[];
    if (!accounts.includes(saved)) {
      return rejectWithValue("Saved account no longer authorized");
    }
    const account = saved;
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await provider.getSigner()) as unknown as VotingContract;
    const balance = formatBalance(await provider.getBalance(account));
    return { account, chainId, contract, provider, balance };
  }
);

export const switchNetwork = createAsyncThunk(
  "voting/switchNetwork",
  async (_: void, { rejectWithValue }) => {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("MetaMask not detected.");
    const chainIdHex = `0x${CHAIN.chainId.toString(16)}`;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error) {
      const err = error as { code?: number };
      if (err.code === 4902) {
        // Chain not added to MetaMask yet -> add it
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: CHAIN.name,
              rpcUrls: [CHAIN.rpcUrl],
              nativeCurrency: { name: "Ether", symbol: CHAIN.currencySymbol, decimals: 18 },
            },
          ],
        });
      } else {
        return rejectWithValue(toMessage(error));
      }
    }
    return null;
  }
);

export const refreshData = createAsyncThunk(
  "voting/refreshData",
  async (_: void, { getState, rejectWithValue }) => {
    const { contract, account, provider } = (getState() as RootState).voting;
    if (!contract || !account) return rejectWithValue("Not connected");

    const systemName = await contract.VOTING_SYSTEM_NAME();
    const owner = await contract.owner();
    const count = Number(await contract.candidatesCount());

    const candidates: Candidate[] = [];
    for (let i = 1; i <= count; i++) {
      const c = await contract.candidates(i);
      candidates.push({ id: Number(c.id), name: c.name, voteCount: Number(c.voteCount) });
    }
    const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);

    let balance: string | null = null;
    if (provider) {
      balance = formatBalance(await provider.getBalance(account));
    }

    const registered = await contract.voters(account);
    const voted = await contract.hasVoted(account);

    let winner: Winner | null = null;
    if (count > 0) {
      const w = await contract.winner();
      winner = { id: Number(w[0]), name: w[1] };
    }

    return {
      systemName,
      owner,
      candidates,
      totalVotes,
      registered,
      voted,
      winner,
      balance,
      isOwner: owner.toLowerCase() === account.toLowerCase(),
    };
  }
);

export const voteFor = createAsyncThunk(
  "voting/voteFor",
  async (candidateId: number, { getState, dispatch, rejectWithValue }) => {
    const { contract } = (getState() as RootState).voting;
    if (!contract) return rejectWithValue("Not connected");
    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();
      await dispatch(refreshData());
      return { hash: tx.hash };
    } catch (error) {
      return rejectWithValue(toMessage(error));
    }
  }
);

export const addCandidate = createAsyncThunk(
  "voting/addCandidate",
  async (name: string, { getState, dispatch, rejectWithValue }) => {
    const { contract } = (getState() as RootState).voting;
    if (!contract) return rejectWithValue("Not connected");
    try {
      const tx = await contract.addCandidate(name);
      await tx.wait();
      await dispatch(refreshData());
      return { hash: tx.hash };
    } catch (error) {
      return rejectWithValue(toMessage(error));
    }
  }
);

export const registerVoter = createAsyncThunk(
  "voting/registerVoter",
  async (address: string, { getState, dispatch, rejectWithValue }) => {
    const { contract } = (getState() as RootState).voting;
    if (!contract) return rejectWithValue("Not connected");
    try {
      const tx = await contract.registerVoter(address);
      await tx.wait();
      await dispatch(refreshData());
      return { hash: tx.hash };
    } catch (error) {
      return rejectWithValue(toMessage(error));
    }
  }
);

export const registerSelf = createAsyncThunk(
  "voting/registerSelf",
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    const { contract } = (getState() as RootState).voting;
    if (!contract) return rejectWithValue("Not connected");
    try {
      const tx = await contract.register();
      await tx.wait();
      await dispatch(refreshData());
      return { hash: tx.hash };
    } catch (error) {
      return rejectWithValue(toMessage(error));
    }
  }
);

export const disconnectWallet = createAsyncThunk("voting/disconnectWallet", async () => null);

// ---------------------------------------------------------------
// Slice
// ---------------------------------------------------------------

const votingSlice = createSlice({
  name: "voting",
  initialState,
  reducers: {
    clearTx(state) {
      state.tx = { state: "idle", message: "" };
    },
    pushActivity(state, action: PayloadAction<ActivityItem>) {
      state.activity = [action.payload, ...state.activity].slice(0, 30);
    },
  },
  extraReducers: (builder) => {
    builder
      // connectWallet
      .addCase(connectWallet.pending, (state) => {
        state.status = "connecting";
        state.tx = { state: "idle", message: "" };
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        const { account, chainId, contract, provider, balance } = action.payload;
        state.account = account;
        state.chainId = chainId;
        state.contract = contract;
        state.provider = provider;
        state.balance = balance;
        state.status = chainId === CHAIN.chainId ? "connected" : "wrong-network";
        if (state.status === "wrong-network") {
          state.tx = {
            state: "error",
            message: `Wrong network: you are on chain ${chainId}. Expected Hardhat Local (${CHAIN.chainId}).`,
          };
        }
      })
      .addCase(connectWallet.rejected, (state, action) => {
        state.status = "disconnected";
        state.tx = { state: "error", message: String(action.error.message ?? "Connection failed") };
      })
      // restoreSession (silent reconnect after refresh)
      .addCase(restoreSession.pending, (state) => {
        state.status = "connecting";
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        const { account, chainId, contract, provider, balance } = action.payload;
        state.account = account;
        state.chainId = chainId;
        state.contract = contract;
        state.provider = provider;
        state.balance = balance;
        state.status = chainId === CHAIN.chainId ? "connected" : "wrong-network";
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = "disconnected";
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          // ignore storage errors
        }
      })
      // refreshData
      .addCase(refreshData.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshData.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.loading = false;
        state.lastSynced = Date.now();
      })
      .addCase(refreshData.rejected, (state, action) => {
        state.loading = false;
        state.tx = { state: "error", message: String(action.error.message ?? "Refresh failed") };
      })
      // voteFor
      .addCase(voteFor.pending, (state) => {
        state.tx = { state: "pending", message: "Submitting your vote..." };
      })
      .addCase(voteFor.fulfilled, (state, action) => {
        state.tx = { state: "success", message: "Vote recorded on-chain!", hash: action.payload.hash };
      })
      .addCase(voteFor.rejected, (state, action) => {
        state.tx = { state: "error", message: String(action.payload ?? "Vote failed") };
      })
      // addCandidate
      .addCase(addCandidate.pending, (state) => {
        state.tx = { state: "pending", message: "Adding candidate..." };
      })
      .addCase(addCandidate.fulfilled, (state, action) => {
        state.tx = { state: "success", message: "Candidate added!", hash: action.payload.hash };
      })
      .addCase(addCandidate.rejected, (state, action) => {
        state.tx = { state: "error", message: String(action.payload ?? "Failed to add candidate") };
      })
      // registerVoter
      .addCase(registerVoter.pending, (state) => {
        state.tx = { state: "pending", message: "Registering voter..." };
      })
      .addCase(registerVoter.fulfilled, (state, action) => {
        state.tx = { state: "success", message: "Voter registered!", hash: action.payload.hash };
        state.knownVoters += 1;
      })
      .addCase(registerVoter.rejected, (state, action) => {
        state.tx = { state: "error", message: String(action.payload ?? "Failed to register voter") };
      })
      // registerSelf
      .addCase(registerSelf.pending, (state) => {
        state.tx = { state: "pending", message: "Confirm registration in MetaMask..." };
      })
      .addCase(registerSelf.fulfilled, (state, action) => {
        state.tx = { state: "success", message: "You are registered! You can now vote.", hash: action.payload.hash };
        state.knownVoters += 1;
      })
      .addCase(registerSelf.rejected, (state, action) => {
        state.tx = { state: "error", message: String(action.payload ?? "Registration failed") };
      })
      // disconnectWallet
      .addCase(disconnectWallet.fulfilled, (state) => {
        state.status = "disconnected";
        state.account = null;
        state.chainId = null;
        state.contract = null;
        state.provider = null;
        state.balance = null;
        state.candidates = [];
        state.winner = null;
        state.registered = false;
        state.voted = false;
        state.isOwner = false;
        state.totalVotes = 0;
        state.lastSynced = null;
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          // ignore storage errors
        }
      });
  },
});

export const { clearTx, pushActivity } = votingSlice.actions;
export default votingSlice.reducer;
