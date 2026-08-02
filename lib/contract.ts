import contractInfo from "./contract.json";

// Contract deployment info, written by scripts/deploy.js
export const CONTRACT_ADDRESS: string = contractInfo.address;
export const CONTRACT_ABI = contractInfo.abi;

// Local Hardhat network config (matches hardhat.config.js + MetaMask)
export const CHAIN = {
  name: "Hardhat Local",
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  currencySymbol: "ETH",
} as const;

// Minimal typing for MetaMask's injected provider (window.ethereum)
export interface WindowEthereum {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: WindowEthereum;
  }
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
