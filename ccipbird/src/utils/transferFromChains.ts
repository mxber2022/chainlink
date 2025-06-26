import {
    createPublicClient,
    createWalletClient,
    http,
    formatEther,
    parseEther,
  } from 'viem';
  import { privateKeyToAccount } from 'viem/accounts';
  import {
    type Chain,
    sepolia,
    polygonAmoy,
    arbitrumSepolia,
    baseSepolia,
  } from 'viem/chains';
  
  const PRIVATE_KEY = process.env.MYPRIVATEKEY;
  const TO_ADDRESS = '0x98692B795D1fB6072de084728f7cC6d56100b807';
  
  type ChainConfig = {
    name: string;
    rpcUrl: string;
    chain: Chain;
  };
  
  const chains: ChainConfig[] = [
    { name: 'Polygon Amoy', rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: polygonAmoy },
    { name: 'Arbitrum Sepolia', rpcUrl: 'https://arb-sepolia.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: arbitrumSepolia },
    { name: 'Base Sepolia', rpcUrl: 'https://base-sepolia.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: baseSepolia },
    { name: 'Sepolia', rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: sepolia },
  ];
  
  export async function transferFromFirstAvailableChain(
    token: string,
    chain: string,
    recipient: string,
    amount: string
  ): Promise<{ txhash: string } | null> {
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  
    console.log(`
        🔄 Transfer Request:
        ----------------------------
        🔹 Token:     ${token}
        🔹 Chain:     ${chain}
        🔹 Recipient: ${recipient}
        🔹 Amount:    ${amount}
        `);
        
    console.log(`\n🔐 Starting scan for available balances...`);
    console.log(`🔎 Wallet Address: ${account.address}`);
    console.log(`🎯 Transfer Target: ${TO_ADDRESS}\n`);
  
    for (const { name, chain, rpcUrl } of chains) {
      console.log(`🌐 Checking ${name}...`);
  
      try {
        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });
  
        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(rpcUrl),
        });
  
        const balance = await publicClient.getBalance({ address: account.address });
        console.log(`💰 Balance on ${name}: ${formatEther(balance)} ${chain.nativeCurrency.symbol}`);
  
        if (balance > parseEther('0.001')) {
          console.log(`📈 Balance is above threshold. Preparing to transfer...`);
  
          const gas = await publicClient.estimateGas({
            account: account.address,
            to: TO_ADDRESS,
            value: parseEther('0.001'),
          });
  
          const gasPrice = await publicClient.getGasPrice();
          const fee = gas * gasPrice;
          const sendAmount = balance - fee;
  
          console.log(`⛽ Gas estimate: ${gas}`);
          console.log(`💸 Gas price: ${formatEther(gasPrice)} ${chain.nativeCurrency.symbol}`);
          console.log(`📤 Amount to send (after gas): ${formatEther(sendAmount)} ${chain.nativeCurrency.symbol}`);
  
          if (sendAmount <= 0n) {
            console.log(`⚠️ Not enough balance to cover gas on ${name}\n`);
            continue;
          }
  
          const txHash = await walletClient.sendTransaction({
            to: TO_ADDRESS,
            value: parseEther("0.001"),
          });
  
          console.log(`✅ Sent from ${name}: ${formatEther(sendAmount)} ${chain.nativeCurrency.symbol}`);
          console.log(`🔗 TX Hash: ${txHash}\n`);
          return { txhash: txHash };
        } else {
          console.log(`🚫 Balance too low to transfer on ${name}\n`);
        }
      } catch (err) {
        console.error(`❌ Error on ${name}: ${(err as Error).message}\n`);
      }
    }
  
    console.log('❌ No eligible chain found with sufficient balance.\n');
    return null;
  }
  