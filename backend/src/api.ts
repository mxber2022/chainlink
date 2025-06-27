import express from 'express';
import dotenv from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  sepolia,
  polygonAmoy,
  arbitrumSepolia,
  baseSepolia,
  type Chain,
} from 'viem/chains';
import * as CCIP from '@chainlink/ccip-js';
import { CHAIN_ADDRESSES } from './routeraddress.js';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const PRIVATE_KEY = "0x4311f71b5ccbb821fbd59188d63ae9c624acb3bc9ed12bce62f1f8139cdeea15";
const TO_ADDRESS = '0x98692B795D1fB6072de084728f7cC6d56100b807';

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
]);

type ChainConfig = {
  name: string;
  rpcUrl: string;
  chain: Chain;
};

const chains: (ChainConfig & { name: string })[] = [
  { name: 'polygonAmoy', rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: polygonAmoy },
  { name: 'arbitrumSepolia', rpcUrl: 'https://arb-sepolia.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: arbitrumSepolia },
  { name: 'baseSepolia', rpcUrl: 'https://base-sepolia.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: baseSepolia },
  { name: 'sepolia', rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/pxb3cwnOJLo19ytBM10xZ2HmHUMWEnj3', chain: sepolia },
];
app.use(express.json());

app.post('/transfer', async (req: any, res: any) => {
  const { token, chain_destination, recipient, amount } = req.body;
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


  try {
  
    const destConfig = chains.find(c => c.name.toLowerCase() === chain_destination.toLowerCase());
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
    console.log("chain_destination", chain_destination)
    console.log("CHAIN_ADDRESSES[chain_destination].usdc", CHAIN_ADDRESSES[chain_destination.toLowerCase()].usdc )
    const balance = await publicClient.readContract({
        address: CHAIN_ADDRESSES[chain_destination.toLowerCase()].usdc as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
    });
    
    console.log(`💰 Balance on ${chain_destination}: ${balance} ${destConfig.chain.nativeCurrency.symbol}`);
    const parsedAmount = BigInt(Math.floor(Number(amount) * 1e6));

    if(balance > parsedAmount) {
        console.log(`💰 Balance is enough. Preparing to transfer...`);

        const txHash = await walletClient.writeContract({
          address: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [recipient, parsedAmount],
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
              console.log("chain.name", name.toLowerCase())
              console.log("CHAIN_ADDRESSES[chain.name].usdc", CHAIN_ADDRESSES[name.toLowerCase()].usdc)
              const balance = await publicClient.readContract({
                  address: CHAIN_ADDRESSES[name.toLowerCase()].usdc as `0x${string}`,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [account.address],
              });

              console.log(`💰 Balance on ${name}: ${balance} ${chain.nativeCurrency.symbol}`);
              const parsedAmount = BigInt(Math.floor(Number(amount) * 1e6));
             // if(balance > parseEther(amount)) {
              if(balance > parsedAmount) {
                  console.log(`💰 Balance is enough. Preparing to transfer...`);

                  const ccipClient = CCIP.createClient()

                  const { txHash, txReceipt } = await ccipClient.approveRouter({
                      client: walletClient,
                      //chain with balance
                      routerAddress: CHAIN_ADDRESSES[chain.name.toLowerCase()].router as `0x${string}`,
                      tokenAddress: CHAIN_ADDRESSES[chain.name.toLowerCase()].usdc as `0x${string}`,
                      amount: 1000n,
                      waitForReceipt: true,
                  })  

                  console.log(`Transfer approved. Transaction hash: ${txHash}. Transaction receipt: ${txReceipt}`) 

                  // Get fee for the transfer
                  const fee = await ccipClient.getFee({
                  client: publicClient,
                  routerAddress: CHAIN_ADDRESSES[chain.name.toLowerCase()].router as `0x${string}`,
                  tokenAddress: CHAIN_ADDRESSES[chain.name.toLowerCase()].usdc as `0x${string}`,
                  amount: 1000n,
                  destinationAccount: TO_ADDRESS,
                  destinationChainSelector: CHAIN_ADDRESSES[chain_destination.toLowerCase()].chainSelector as `0x${string}`,
                  })

                  console.log("fee", fee)

                  const { txHash: transferTxHash, messageId } = await ccipClient.transferTokens({
                      client: walletClient,
                      routerAddress: CHAIN_ADDRESSES[chain.name.toLowerCase()].router as `0x${string}`,
                      tokenAddress: CHAIN_ADDRESSES[chain.name.toLowerCase()].usdc as `0x${string}`,
                      amount: 1000n,
                      destinationAccount: TO_ADDRESS,
                      destinationChainSelector: CHAIN_ADDRESSES[chain_destination.toLowerCase()].chainSelector as `0x${string}`,
                  })
                  console.log("transferTxHash", transferTxHash)
                  console.log("messageId", messageId)
                  console.log(`Transfer success. Transaction hash: ${transferTxHash}. Message ID: ${messageId}`)

                  return res.json({
                    success: true,
                    method: 'ccip',
                    from: name,
                    txhash: transferTxHash,
                    messageId
                  });
              }

              else {
                  console.log(`🚫 Balance is not enough on ${name}`);
                  // return res.status(400).json({
                  //   success: false,
                  //   error: 'No eligible chain found with sufficient balance.',
                  // });
              }

          } catch (err) {
              console.error(`❌ Error on ${name}: ${(err as Error).message}\n`);
              console.error('Error occurred:', (err as Error).stack);
              return res.status(500).json({
                success: false,
                error: `Error on ${name}: ${(err as Error).message}`,
              });
          }
      }
  }

  } catch (err) {
    console.error(`❌`, err);
    return res
      .status(500)
      .json({ success: false, error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});



/* 

app.post('/transfer', async (req: any, res: any) => {
  const { token, chain_destination, recipient, amount } = req.body;
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

  try {
    const destConfig = chains.find((c) => c.name === chain_destination);
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

    if (balance > parseEther(amount)) {
      const txHash = await walletClient.sendTransaction({
        to: recipient,
        value: parseEther(amount),
      });

      return res.json({
        success: true,
        method: 'direct',
        from: chain_destination,
        txhash: txHash,
      });
    }

    // Fallback to CCIP from other chains
    for (const { name, chain, rpcUrl } of chains) {
      const client = createPublicClient({ chain, transport: http(rpcUrl) });
      const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });

      const bal = await client.readContract({
        address: CHAIN_ADDRESSES[name].usdc as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      });

      if (bal > parseEther(amount)) {
        const ccipClient = CCIP.createClient();

        await ccipClient.approveRouter({
          client: wallet,
          routerAddress: CHAIN_ADDRESSES[chain_destination].router as `0x${string}`,
          tokenAddress: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
          amount: parseEther(amount),
          waitForReceipt: true,
        });

        const fee = await ccipClient.getFee({
          client,
          routerAddress: CHAIN_ADDRESSES[chain_destination].router as `0x${string}`,
          tokenAddress: CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
          amount: parseEther(amount),
          destinationAccount: recipient,
          destinationChainSelector:
            CHAIN_ADDRESSES[chain_destination].chainSelector as `0x${string}`,
        });

        const { txHash: ccipTxHash, messageId } =
          await ccipClient.transferTokens({
            client: wallet,
            routerAddress:
              CHAIN_ADDRESSES[chain_destination].router as `0x${string}`,
            tokenAddress:
              CHAIN_ADDRESSES[chain_destination].usdc as `0x${string}`,
            amount: parseEther(amount),
            destinationAccount: recipient,
            destinationChainSelector:
              CHAIN_ADDRESSES[chain_destination].chainSelector as `0x${string}`,
          });

        return res.json({
          success: true,
          method: 'ccip',
          from: name,
          txhash: ccipTxHash,
          messageId,
          fee,
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'No eligible chain found with sufficient balance.',
    });
  } catch (err) {
    console.error(`❌`, err);
    return res
      .status(500)
      .json({ success: false, error: (err as Error).message });
  }
});


*/
