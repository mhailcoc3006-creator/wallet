import { ethers } from 'ethers';
import { KAVACH_TOKEN_ABI, KAVACH_TOKEN_BYTECODE } from './kavach-token-contract';
import { getEvmWallet } from './wallet';

export const SEPOLIA_CHAIN = {
  id: 'sepolia',
  name: 'Ethereum Sepolia',
  chainId: 11155111,
  rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  explorer: 'https://sepolia.etherscan.io',
};

export const MAINNET_CHAIN = {
  id: 'mainnet',
  name: 'Ethereum Mainnet',
  chainId: 1,
  rpc: 'https://eth.drpc.org',
  explorer: 'https://etherscan.io',
};

export const TOKEN_NETWORKS = {
  mainnet: MAINNET_CHAIN,
  sepolia: SEPOLIA_CHAIN,
};

export function getTokenNetwork(networkId = 'mainnet') {
  return TOKEN_NETWORKS[networkId] || MAINNET_CHAIN;
}

export function getSepoliaWallet(mnemonic) {
  return getEvmWallet(SEPOLIA_CHAIN, mnemonic);
}

function getTokenWallet(mnemonic, networkId) {
  return getEvmWallet(getTokenNetwork(networkId), mnemonic);
}

async function prepareTokenDeployment({ mnemonic, name, symbol, supply, networkId }) {
  const networkConfig = getTokenNetwork(networkId);
  const wallet = getTokenWallet(mnemonic, networkId);
  const network = await wallet.provider.getNetwork();
  if (Number(network.chainId) !== networkConfig.chainId) {
    throw new Error(`RPC ${networkConfig.name} tidak tersedia atau network tidak cocok.`);
  }

  const recipient = await wallet.getAddress();
  const initialSupply = BigInt(supply);
  const factory = new ethers.ContractFactory(KAVACH_TOKEN_ABI, KAVACH_TOKEN_BYTECODE, wallet);
  const deployTx = await factory.getDeployTransaction(name, symbol, initialSupply, recipient);
  const feeData = await wallet.provider.getFeeData();
  const gasLimit = await wallet.provider.estimateGas({ ...deployTx, from: recipient });
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
  const balanceWei = await wallet.provider.getBalance(recipient);
  const estimatedCostWei = gasPrice ? (gasLimit * 11n / 10n) * gasPrice : null;

  return {
    wallet,
    networkConfig,
    recipient,
    initialSupply,
    factory,
    gasLimit: gasLimit * 11n / 10n,
    gasPrice,
    balanceWei,
    estimatedCostWei,
  };
}

export async function estimateKavachToken({ mnemonic, name, symbol, supply, networkId = 'mainnet' }) {
  const prepared = await prepareTokenDeployment({ mnemonic, name, symbol, supply, networkId });
  return {
    network: prepared.networkConfig,
    recipient: prepared.recipient,
    gasLimit: prepared.gasLimit.toString(),
    estimatedCost: prepared.estimatedCostWei ? ethers.formatEther(prepared.estimatedCostWei) : null,
    balance: ethers.formatEther(prepared.balanceWei),
    canPayGas: prepared.estimatedCostWei == null || prepared.balanceWei >= prepared.estimatedCostWei,
  };
}

export async function deployKavachToken({ mnemonic, name, symbol, supply, networkId = 'mainnet' }) {
  const prepared = await prepareTokenDeployment({ mnemonic, name, symbol, supply, networkId });
  if (prepared.estimatedCostWei && prepared.balanceWei < prepared.estimatedCostWei) {
    throw new Error(`Saldo ETH tidak cukup untuk gas. Perkiraan ${ethers.formatEther(prepared.estimatedCostWei)} ETH, saldo ${ethers.formatEther(prepared.balanceWei)} ETH.`);
  }

  const { wallet, networkConfig, recipient, initialSupply, factory } = prepared;
  const contract = await factory.deploy(name, symbol, initialSupply, recipient, {
    gasLimit: prepared.gasLimit,
  });
  const tx = contract.deploymentTransaction();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  return {
    address,
    txHash: tx?.hash || '',
    network: networkConfig,
    explorer: `${networkConfig.explorer}/address/${address}`,
    txExplorer: tx?.hash ? `${networkConfig.explorer}/tx/${tx.hash}` : '',
    gasLimit: prepared.gasLimit.toString(),
    estimatedCost: prepared.estimatedCostWei ? ethers.formatEther(prepared.estimatedCostWei) : null,
    recipient,
  };
}
