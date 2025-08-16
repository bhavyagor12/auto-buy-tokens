import axios from "axios";

type TokenInfo = {
  address: string;
  symbol: string;
  decimals: number;
  priceUsd: number;
  totalReserveUsd: number;
  volume24h: number;
};

const GECKO_TERMINAL_BASE_URL = "https://api.geckoterminal.com/api/v2";

async function fetchRecentBaseTokens(): Promise<string[]> {
  const url = `${GECKO_TERMINAL_BASE_URL}/tokens/info_recently_updated?network=base`;
  const { data } = await axios.get(url, {
    headers: { accept: "application/json" },
  });
  // shape: data: { data: [{id, attributes:{address...}}] }
  // Normalize to addresses
  const addresses: string[] = (data?.data ?? [])
    .map((d: any) => d?.attributes?.address)
    .filter(Boolean);
  return addresses;
}

async function fetchTokenInfo(addr: string): Promise<TokenInfo | null> {
  const url = `${GECKO_TERMINAL_BASE_URL}/networks/base/tokens/${addr}`;
  const { data } = await axios.get(url, {
    headers: { accept: "application/json" },
  });
  const attributes = data?.data?.attributes;
  if (!attributes) return null;
  return {
    address: attributes.address,
    symbol: attributes.symbol,
    decimals: attributes.decimals ?? 18,
    priceUsd: Number(attributes.price_usd ?? 0),
    totalReserveUsd: Number(attributes.total_reserve_in_usd ?? 0),
    volume24h: Number(attributes.volume_usd?.h24 ?? 0),
  };
}

export { fetchRecentBaseTokens, fetchTokenInfo, TokenInfo };
