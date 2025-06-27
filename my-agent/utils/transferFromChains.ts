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
  import * as CCIP from '@chainlink/ccip-js'
  import { CHAIN_ADDRESSES } from './routeraddress';
  import { parseAbi, formatUnits } from 'viem';

  const PRIVATE_KEY = process.env.MYPRIVATEKEY;
  const TO_ADDRESS = '0x98692B795D1fB6072de084728f7cC6d56100b807';
  const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

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
    chain_destination: string,
    recipient: string,
    amount: string
  ): Promise<{ txhash: string } | null> {
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  
    console.log(`
        🔄 Transfer Request:
        ----------------------------
        🔹 Token:     ${token}
        🔹 Chain:     ${chain_destination}
        🔹 Recipient: ${recipient}
        🔹 Amount:    ${amount}
        `);
        
    console.log(`\n🔐 Starting scan for available balances...`);
    console.log(`🔎 Wallet Address: ${account.address}`);
    console.log(`🎯 Transfer Target: ${TO_ADDRESS}\n`);

    /* 
        1. if balance on destination chain is enough, transfer from there
    */ 

    const destConfig = chains.find(c => c.name === chain_destination);
    if (!destConfig) throw new Error(`Unknown chain: ${chain_destination}`);
    
    const publicClient = createPublicClient({
        chain: destConfig.chain,
        transport: http(destConfig.rpcUrl),
    });

    const walletClient = createWalletClient({
        account,
        chain: destConfig.chain,
        transport: http(destConfig.rpcUrl),
    });

    const balance = await publicClient.readContract({
        address: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
    });
    
    console.log(`💰 Balance on ${chain_destination}: ${formatEther(balance)} ${destConfig.chain.nativeCurrency.symbol}`);

    if(balance > parseEther(amount)) {
        console.log(`💰 Balance is enough. Preparing to transfer...`);

        const txHash = await walletClient.sendTransaction({
            to: TO_ADDRESS,
            value: parseEther(amount),
        });
        console.log(`✅ Sent from ${chain_destination}: ${amount}`);
        console.log(`🔗 TX Hash: ${txHash}\n`);
        return { txhash: txHash };
    }

    else {
        console.log(`🚫 Balance is not enough. Preparing to transfer from first available chain using CCIP...`);

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

                const balance = await publicClient.readContract({
                    address: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [account.address],
                });

                console.log(`💰 Balance on ${name}: ${formatEther(balance)} ${chain.nativeCurrency.symbol}`);

                if(balance > parseEther(amount)) {
                    console.log(`💰 Balance is enough. Preparing to transfer...`);

                    const ccipClient = CCIP.createClient()

                    const { txHash, txReceipt } = await ccipClient.approveRouter({
                        client: walletClient,
                        routerAddress: CHAIN_ADDRESSES[chain_destination].router as `0x${string}`,
                        tokenAddress: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
                        amount: 1000000000000000000n,
                        waitForReceipt: true,
                    })  

                    console.log(`Transfer approved. Transaction hash: ${txHash}. Transaction receipt: ${txReceipt}`) 
                    
                    console.log(`Transfer approved. Transaction hash: ${txHash}. Transaction receipt: ${txReceipt}`)

                    // Get fee for the transfer
                    const fee = await ccipClient.getFee({
                    client: publicClient,
                    routerAddress: CHAIN_ADDRESSES[chain_destination].router as `0x${string}`,
                    tokenAddress: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
                    amount: 1000000000000000000n,
                    destinationAccount: TO_ADDRESS,
                    destinationChainSelector: CHAIN_ADDRESSES[chain_destination].chainSelector as `0x${string}`,
                    })

                    const { txHash: transferTxHash, messageId } = await ccipClient.transferTokens({
                        client: walletClient,
                        routerAddress: CHAIN_ADDRESSES[chain_destination].router as `0x${string}`,
                        tokenAddress: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
                        amount: 1000000000000000000n,
                        destinationAccount: TO_ADDRESS,
                        destinationChainSelector: CHAIN_ADDRESSES[chain_destination].chainSelector as `0x${string}`,
                    })
              
                    console.log(`Transfer success. Transaction hash: ${transferTxHash}. Message ID: ${messageId}`)
                }

                else {
                    console.log(`🚫 Balance is not enough on ${name}`);
                }

            } catch (err) {
                console.error(`❌ Error on ${name}: ${(err as Error).message}\n`);
            }
        }
    }

    /* 
        2. if not, transfer from first available chain using ccip
    */ 
  
    /* 
        3. error if not enough balance on any chain
    */ 
  
  
    console.log('❌ No eligible chain found with sufficient balance.\n');
    return null;
  }
  