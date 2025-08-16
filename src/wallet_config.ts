import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { RPC_URL, PRIVATE_KEY } from "./config";

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const pub = createPublicClient({ chain: base, transport: http(RPC_URL) });
const wallet = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

export { pub, wallet, account };
