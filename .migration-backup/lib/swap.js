// LI.FI aggregator integration — quote & execute swap (EVM same-chain / cross-chain).
// Docs: https://apidocs.li.fi/
// Kami proxy sebagian call melalui /api untuk hindari CORS.

import { ethers } from 'ethers';
import { getEvmWallet } from './wallet';

const LIFI_BASE = 'https://li.quest/v1';

// Preset token per EVM chain (contract addresses). Native token = zero address.
export const SWAP_TOKENS = {
  ethereum: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'Ether', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', coinGeckoId: 'ethereum' },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, name: 'USD Coin', logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', coinGeckoId: 'usd-coin' },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', coinGeckoId: 'tether' },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, name: 'Dai', logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', coinGeckoId: 'dai' },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, name: 'Wrapped BTC', logo: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin.png', coinGeckoId: 'wrapped-bitcoin' },
  ],
  bsc: [
    { symbol: 'BNB', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'BNB', logo: '', coinGeckoId: 'binancecoin' },
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, name: 'Tether', logo: '', coinGeckoId: 'tether' },
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, name: 'USD Coin', logo: '', coinGeckoId: 'usd-coin' },
    { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, name: 'BUSD', logo: '', coinGeckoId: 'binance-usd' },
  ],
  polygon: [
    { symbol: 'POL', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'Polygon', logo: '', coinGeckoId: 'matic-network' },
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, name: 'USD Coin', logo: '', coinGeckoId: 'usd-coin' },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, name: 'Tether', logo: '', coinGeckoId: 'tether' },
    { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, name: 'Wrapped ETH', logo: '', coinGeckoId: 'ethereum' },
  ],
  arbitrum: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'Ether', logo: '', coinGeckoId: 'ethereum' },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, name: 'USD Coin', logo: '', coinGeckoId: 'usd-coin' },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, name: 'Tether', logo: '', coinGeckoId: 'tether' },
    { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, name: 'Arbitrum', logo: '', coinGeckoId: 'arbitrum' },
  ],
  optimism: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'Ether', logo: '', coinGeckoId: 'ethereum' },
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, name: 'USD Coin', logo: '', coinGeckoId: 'usd-coin' },
    { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, name: 'Optimism', logo: '', coinGeckoId: 'optimism' },
  ],
  base: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'Ether', logo: '', coinGeckoId: 'ethereum' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, name: 'USD Coin', logo: '', coinGeckoId: 'usd-coin' },
  ],
  avalanche: [
    { symbol: 'AVAX', address: '0x0000000000000000000000000000000000000000', decimals: 18, name: 'Avalanche', logo: '', coinGeckoId: 'avalanche-2' },
    { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, name: 'USD Coin', logo: '', coinGeckoId: 'usd-coin' },
    { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, name: 'Tether', logo: '', coinGeckoId: 'tether' },
  ],
};

/**
 * Get quote from LI.FI. Uses our /api proxy to avoid CORS.
 */
export async function getQuote({ fromChainId, toChainId, fromToken, toToken, fromAmount, fromAddress }) {
  const params = new URLSearchParams({
    fromChain: String(fromChainId),
    toChain: String(toChainId),
    fromToken,
    toToken,
    fromAmount,
    fromAddress,
    order: 'RECOMMENDED',
  });
  const res = await fetch(`/api/swap/quote?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Quote error ${res.status}`);
  return data;
}

/**
 * Execute a swap using the quote's transactionRequest.
 * Handles ERC-20 approval automatically if needed.
 */
export async function executeSwap({ chain, mnemonic, quote }) {
  const wallet = getEvmWallet(chain, mnemonic);
  const tr = quote.transactionRequest;
  if (!tr) throw new Error('Quote tidak memiliki transactionRequest');

  // Handle approval if fromToken != native
  const fromTokenAddress = quote.action?.fromToken?.address;
  const approvalAddress = quote.estimate?.approvalAddress;
  const fromAmount = quote.action?.fromAmount;
  if (
    fromTokenAddress &&
    fromTokenAddress !== '0x0000000000000000000000000000000000000000' &&
    approvalAddress &&
    fromAmount
  ) {
    const erc20 = new ethers.Contract(
      fromTokenAddress,
      [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ],
      wallet
    );
    const cur = await erc20.allowance(wallet.address, approvalAddress);
    if (cur < BigInt(fromAmount)) {
      const approveTx = await erc20.approve(approvalAddress, ethers.MaxUint256);
      await approveTx.wait();
    }
  }

  const txResp = await wallet.sendTransaction({
    to: tr.to,
    data: tr.data,
    value: tr.value ? BigInt(tr.value) : 0n,
    gasLimit: tr.gasLimit ? BigInt(tr.gasLimit) : undefined,
  });
  return {
    hash: txResp.hash,
    explorer: `${chain.explorer}${chain.txPath}${txResp.hash}`,
  };
}

export { LIFI_BASE };
