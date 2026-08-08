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

export function getSepoliaWallet(mnemonic) {
  return getEvmWallet(SEPOLIA_CHAIN, mnemonic);
}

export async function deployKavachToken({ mnemonic, name, symbol, supply }) {
  const wallet = getSepoliaWallet(mnemonic);
  const network = await wallet.provider.getNetwork();
  if (Number(network.chainId) !== SEPOLIA_CHAIN.chainId) {
    throw new Error('RPC Sepolia tidak tersedia atau network tidak cocok.');
  }

  const recipient = await wallet.getAddress();
  const initialSupply = BigInt(supply);
  const factory = new ethers.ContractFactory(KAVACH_TOKEN_ABI, KAVACH_TOKEN_BYTECODE, wallet);
  const deployTx = await factory.getDeployTransaction(name, symbol, initialSupply, recipient);
  const feeData = await wallet.provider.getFeeData();
  const gasLimit = await wallet.provider.estimateGas({ ...deployTx, from: recipient });
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
  const estimatedCost = gasPrice ? gasLimit * gasPrice : null;
  const contract = await factory.deploy(name, symbol, initialSupply, recipient, {
    gasLimit,
  });
  const tx = contract.deploymentTransaction();
  await contract.waitForDeployment();

  return {
    address: await contract.getAddress(),
    txHash: tx?.hash || '',
    explorer: `${SEPOLIA_CHAIN.explorer}/address/${await contract.getAddress()}`,
    txExplorer: tx?.hash ? `${SEPOLIA_CHAIN.explorer}/tx/${tx.hash}` : '',
    gasLimit: gasLimit.toString(),
    estimatedCost: estimatedCost ? ethers.formatEther(estimatedCost) : null,
    recipient,
  };
}
