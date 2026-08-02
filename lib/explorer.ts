import { Interface, type JsonRpcProvider, type Block } from "ethers";
import contractInfo from "./contract.json";

const CONTRACT_ADDRESS_LOWER = contractInfo.address.toLowerCase();
const iface = new Interface(contractInfo.abi);

export const GO = "GO";

export interface ExplorerTx {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  gasUsed: bigint;
  gasPrice: bigint | null;
  toContract: boolean;
  method: string | null;
  args: string[] | null;
}

export interface ExplorerBlock {
  number: number;
  hash: string;
  timestamp: number;
  txCount: number;
  gasUsed: bigint;
  gasLimit: bigint;
  miner: string;
}

export interface ExplorerTxDetail extends ExplorerTx {
  blockNumber: number;
  timestamp: number;
}

function decodeTxMethod(to: string | null, data: string): { toContract: boolean; method: string | null; args: string[] | null } {
  if (!to || to.toLowerCase() !== CONTRACT_ADDRESS_LOWER || !data || data.length < 10) {
    return { toContract: false, method: null, args: null };
  }
  const selector = data.slice(0, 10);
  try {
    const fragment = iface.getFunction(selector);
    if (!fragment) return { toContract: true, method: null, args: null };
    const decoded = iface.decodeFunctionData(fragment, data);
    const args = Array.from(decoded).map((v) => (typeof v === "bigint" ? v.toString() : String(v)));
    return { toContract: true, method: fragment.name, args };
  } catch {
    return { toContract: true, method: null, args: null };
  }
}

export function formatGo(value: bigint): string {
  const n = Number(value) / 1e18;
  return n.toFixed(6).replace(/\.?0+$/, "");
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function toBlockMeta(block: Block): ExplorerBlock {
  return {
    number: block.number,
    hash: block.hash ?? "",
    timestamp: block.timestamp,
    txCount: block.transactions.length,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    miner: block.miner ?? "",
  };
}

export async function fetchLatestBlocks(provider: JsonRpcProvider, count: number): Promise<ExplorerBlock[]> {
  const latest = await provider.getBlockNumber();
  const blocks: ExplorerBlock[] = [];
  for (let n = latest; n > latest - count && n >= 0; n--) {
    const block = await provider.getBlock(n, false);
    if (block) blocks.push(toBlockMeta(block));
  }
  return blocks;
}

export async function fetchBlockByNumber(provider: JsonRpcProvider, n: number): Promise<ExplorerBlock | null> {
  const block = await provider.getBlock(n, false);
  return block ? toBlockMeta(block) : null;
}

export async function fetchRecentTransactions(provider: JsonRpcProvider, limit = 15): Promise<ExplorerTxDetail[]> {
  const latest = await provider.getBlockNumber();
  const txs: ExplorerTxDetail[] = [];
  for (let n = latest; n >= 0 && txs.length < limit && latest - n < 60; n--) {
    const block = await provider.getBlock(n, false);
    if (!block || block.transactions.length === 0) continue;
    const details = await fetchBlockTransactions(provider, n);
    txs.push(...details);
  }
  return txs.slice(0, limit);
}

export type SearchResult =
  | { kind: "block"; block: ExplorerBlock }
  | { kind: "tx"; blockNumber: number; tx: ExplorerTxDetail; txs: ExplorerTxDetail[] }
  | null;

export async function searchBlockOrTx(provider: JsonRpcProvider, input: string): Promise<SearchResult> {
  const trimmed = input.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    const receipt = await provider.getTransactionReceipt(trimmed);
    if (!receipt) return null;
    const txs = await fetchBlockTransactions(provider, receipt.blockNumber);
    const tx = txs.find((t) => t.hash.toLowerCase() === trimmed.toLowerCase());
    if (!tx) return null;
    return { kind: "tx", blockNumber: receipt.blockNumber, tx, txs };
  }
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 0 && trimmed !== "") {
    const block = await fetchBlockByNumber(provider, n);
    return block ? { kind: "block", block } : null;
  }
  return null;
}

export async function fetchBlockTransactions(provider: JsonRpcProvider, blockNumber: number): Promise<ExplorerTxDetail[]> {
  const block = await provider.getBlock(blockNumber, true);
  if (!block) return [];
  const details: ExplorerTxDetail[] = [];
  for (const tx of block.prefetchedTransactions) {
    const receipt = await provider.getTransactionReceipt(tx.hash);
    const decoded = decodeTxMethod(tx.to, tx.data);
    details.push({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasUsed: receipt ? receipt.gasUsed : BigInt(0),
      gasPrice: receipt?.gasPrice ?? tx.gasPrice ?? null,
      blockNumber: blockNumber,
      timestamp: block.timestamp,
      ...decoded,
    });
  }
  return details;
}

export function methodLabel(method: string | null, args: string[] | null): { label: string; detail: string | null } | null {
  if (!method) return null;
  switch (method) {
    case "vote":
      return { label: "VOTE", detail: args?.[0] ? `candidate #${args[0]}` : null };
    case "addCandidate":
      return { label: "ADD CANDIDATE", detail: args?.[0] ? `"${args[0]}"` : null };
    case "register":
      return { label: "REGISTER", detail: "self" };
    case "registerVoter":
      return { label: "REGISTER VOTER", detail: args?.[0] ? shortAddr(args[0]) : null };
    default:
      return { label: method.toUpperCase(), detail: args?.length ? args.join(", ") : null };
  }
}

export function isContractAddress(address: string | null): boolean {
  return !!address && address.toLowerCase() === CONTRACT_ADDRESS_LOWER;
}
