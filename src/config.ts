const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const TP_PCT = Number(process.env.TP_PCT ?? 30);
const SL_PCT = Number(process.env.SL_PCT ?? 20);
const BUY_USDC = Number(process.env.BUY_USDC ?? 10);
const POLL_SEC = Number(process.env.POLL_SEC ?? 120);
const PRICE_CHECK_MS = 30 * 60 * 1000; // 30 min

// Addresses (Base)
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const AERO_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
const UNI_V3_ROUTER02 = "0x2626664c2603336E57B271c5C0b26F421741e481";

// ABIs (trimmed)
const erc20 = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "o", type: "address" },
      { name: "s", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "s", type: "address" },
      { name: "amt", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Aerodrome (V2-like) router: swapExactTokensForTokens
const aeroRouter = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amountIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountOutMin",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "address",
            name: "from",
            type: "address",
          },
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "bool",
            name: "stable",
            type: "bool",
          },
          {
            internalType: "address",
            name: "factory",
            type: "address",
          },
        ],
        internalType: "struct IRouter.Route[]",
        name: "routes",
        type: "tuple[]",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactTokensForTokens",
    outputs: [
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Uniswap v3 SwapRouter02 — use exactInput (multi-hop) for fallback
const uniV3Router = [
  {
    type: "function",
    name: "exactInput",
    inputs: [
      {
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

export {
  RPC_URL,
  PRIVATE_KEY,
  TP_PCT,
  SL_PCT,
  BUY_USDC,
  POLL_SEC,
  PRICE_CHECK_MS,
  USDC,
  WETH,
  AERO_ROUTER,
  UNI_V3_ROUTER02,
  erc20,
  aeroRouter,
  uniV3Router,
};
