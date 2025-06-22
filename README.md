# 🐦 CcipBird — Tweet-to-Pay, Powered by Chainlink CCIP

**CcipBird** lets you send cross-chain payments with a tweet.  
Mention `@CcipBird` on Twitter with a command like:

```

@CcipBird send 1 USDC to @bob on Polygon

````

CcipBird parses the tweet, resolves usernames to wallets, and sends tokens across chains using **Chainlink CCIP**.

---

## ✨ Features

- 🐦 Send payments with a tweet
- 🌉 Cross-chain token transfer via Chainlink CCIP
- 🤖 AI-powered natural language parser (GPT-4)
- 🪪 Twitter → Wallet identity mapping
- 🔐 Spam-protection and user verification

---

## 🔧 Example Commands

| Tweet | Action |
|-------|--------|
| `@CcipBird send 2 USDC` | Sends 2 USDC to tweet author |
| `@CcipBird tip @alice 1.5 USDC on Base` | Sends 1.5 USDC to @alice on Base |
| `@CcipBird split 3 USDC between @a @b` | Splits payment between multiple users |

---

## 🛠 Tech Stack

- 🧠 OpenAI GPT-4 for tweet parsing
- 🔗 [Chainlink CCIP](https://chain.link/ccip) for cross-chain transfers
- 🧵 Twitter API v2 for tweet detection
- 💼 Ethers.js + viem for transaction execution
- ☁️ Node.js + TypeScript backend

---

## ⚙️ Setup

```bash
git clone https://github.com/your-org/ccipbird.git
cd ccipbird
npm install
````

Set environment variables in `.env`:

```env
TWITTER_BEARER_TOKEN=...
PRIVATE_KEY=...
ETH_RPC_URL=...
POLYGON_RPC_URL=...
CCIP_ROUTER=...
LINK_TOKEN=...
```

Start the bot:

```bash
npm run dev
```

---

## 📜 License

MIT

---

> 💸 Tweet. Tip. Cross-chain.
> **CcipBird** — money in motion, powered by Chainlink.
