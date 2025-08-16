import "dotenv/config";
import express from "express";
import { oneDayMs, now } from "./helpers";
import { fetchRecentBaseTokens, fetchTokenInfo, TokenInfo } from "./tokens";
import { pub, wallet, account } from "./wallet_config";
import {
  TP_PCT,
  SL_PCT,
  BUY_USDC,
  POLL_SEC,
  PRICE_CHECK_MS,
  USDC,
  WETH,
  AERO_ROUTER,
  erc20,
  aeroRouter,
} from "./config";

// ---------- Swapping ----------
async function ensureApproval(
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
) {
  const [allow] = (await Promise.all([
    pub.readContract({
      address: token,
      abi: erc20,
      functionName: "allowance",
      args: [account.address, spender],
    }),
  ])) as [bigint];
  if (allow >= amount) return;

  await wallet.writeContract({
    address: token,
    abi: erc20,
    functionName: "approve",
    args: [spender, amount],
  });
}

async function buyTokenAerodrome(usdcIn: bigint, token: `0x${string}`) {
  // Default path: USDC -> token (try direct), else USDC -> WETH -> token
  const to = account.address;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 2); // 2 minutes
  const minOut = 0n; // keep simple; you can compute quotes later
  // Try direct
  try {
    await ensureApproval(
      USDC as `0x${string}`,
      AERO_ROUTER as `0x${string}`,
      usdcIn,
    );
    const hash = await wallet.writeContract({
      address: AERO_ROUTER as `0x${string}`,
      abi: aeroRouter,
      functionName: "swapExactTokensForTokens",
      args: [usdcIn, minOut, [USDC, token], to, deadline],
    });
    return { ok: true, hash };
  } catch (e) {
    // fallback path via WETH
    await ensureApproval(
      USDC as `0x${string}`,
      AERO_ROUTER as `0x${string}`,
      usdcIn,
    );
    const hash = await wallet.writeContract({
      address: AERO_ROUTER as `0x${string}`,
      abi: aeroRouter,
      functionName: "swapExactTokensForTokens",
      args: [usdcIn, minOut, [USDC, WETH, token], to, deadline],
    });
    return { ok: true, hash };
  }
}

async function sellTokenAerodrome(amountIn: bigint, token: `0x${string}`) {
  const to = account.address;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 2);
  const minOut = 0n;
  // try token -> USDC directly, else token -> WETH -> USDC
  try {
    await ensureApproval(token, AERO_ROUTER as `0x${string}`, amountIn);
    const hash = await wallet.writeContract({
      address: AERO_ROUTER as `0x${string}`,
      abi: aeroRouter,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, minOut, [token, USDC], to, deadline],
    });
    return { ok: true, hash };
  } catch (e) {
    await ensureApproval(token, AERO_ROUTER as `0x${string}`, amountIn);
    const hash = await wallet.writeContract({
      address: AERO_ROUTER as `0x${string}`,
      abi: aeroRouter,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, minOut, [token, WETH, USDC], to, deadline],
    });
    return { ok: true, hash };
  }
}

// ---------- Strategy ----------
function shouldConsider(info: TokenInfo) {
  // super simple gating; tweak later
  if (!Number.isFinite(info.priceUsd) || info.priceUsd <= 0) return false;
  if (info.totalReserveUsd < 5000) return false; // avoid dust pools
  if (info.volume24h < 1000) return false; // basic activity filter
  return true;
}

async function tryBuy(addr: `0x${string}`, info: TokenInfo) {
  // compute USDC amount
  const usdcDecimals = 6;
  const usdcIn = BigInt(Math.floor(BUY_USDC * 10 ** usdcDecimals));
  // Execute on Aerodrome (v2 style)
  const res = await buyTokenAerodrome(usdcIn, addr);
  console.log("BUY tx:", res);
  // After buy, record token balance as qty
  const bal = (await pub.readContract({
    address: addr,
    abi: erc20,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  insertPos.run(
    addr,
    info.symbol,
    info.decimals,
    bal.toString(),
    info.priceUsd,
    TP_PCT,
    SL_PCT,
    now(),
  );
}

async function trySell(addr: `0x${string}`, decimals: number) {
  const bal = (await pub.readContract({
    address: addr,
    abi: erc20,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  if (bal === 0n) {
    removePosition.run(addr);
    return;
  }
  const res = await sellTokenAerodrome(bal, addr);
  console.log("SELL tx:", res);
  removePosition.run(addr);
}

// ---------- Schedulers ----------
async function pollNewTokens() {
  try {
    const addrs = await fetchRecentBaseTokens();
    for (const a0 of addrs) {
      const addr = (a0 as string).toLowerCase();
      const row = getSeen.get(addr);
      if (!row) {
        // first time we've seen it — mark timestamp
        upsertSeen.run(addr, now());
      }
      // only consider within 24h of first_seen
      const firstSeen = row?.first_seen_ms ?? now();
      if (now() - firstSeen > oneDayMs()) continue;

      const info = await fetchTokenInfo(addr);
      if (!info) continue;

      if (!shouldConsider(info)) continue;

      // If not already holding position — buy once.
      const existing = insertPos.get?.call ? insertPos.get(addr) : null; // guard if driver differs
      const curPositions = db
        .prepare("SELECT 1 FROM positions WHERE token = ?")
        .get(addr);
      if (curPositions) continue;

      console.log(`Buying ${info.symbol} (${addr}) @ ~${info.priceUsd} USD`);
      await tryBuy(addr as `0x${string}`, info);
    }
  } catch (e) {
    console.error("poll error", e);
  }
}

async function priceCheckLoop() {
  try {
    const rows = getPositions.all() as any[];
    for (const p of rows) {
      const info = await fetchTokenInfo(p.token);
      if (!info) continue;

      const changePct =
        ((info.priceUsd - p.entry_price_usd) / p.entry_price_usd) * 100;
      if (changePct >= p.tp_pct) {
        console.log(
          `TP hit for ${p.symbol}: +${changePct.toFixed(2)}% — selling`,
        );
        await trySell(p.token as `0x${string}`, p.decimals);
      } else if (changePct <= -p.sl_pct) {
        console.log(
          `SL hit for ${p.symbol}: ${changePct.toFixed(2)}% — selling`,
        );
        await trySell(p.token as `0x${string}`, p.decimals);
      } else {
        console.log(`${p.symbol}: ${changePct.toFixed(2)}% (hold)`);
      }
    }
  } catch (e) {
    console.error("price check error", e);
  } finally {
    setTimeout(priceCheckLoop, PRICE_CHECK_MS);
  }
}

const app = express();

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/run-once", async (_, res) => {
  await pollNewTokens();
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log("server on :3000");
  setInterval(pollNewTokens, POLL_SEC * 1000);
  setTimeout(priceCheckLoop, 5_000);
});
