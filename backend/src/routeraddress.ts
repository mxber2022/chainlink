export const CHAIN_ADDRESSES: Record<string, { router: string; usdc: string, chainSelector: string }> = {
    arbitrumsepolia: {
      router: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",
      usdc: "0x82A7176a7601764af75CC863640544f4B0ba8e43",
      chainSelector: "3478487238524512106",
    },
    basesepolia: {
      router: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93",
      usdc: "0xD353131F4802046eF0f57FE362c64e641Be003Ad",
      chainSelector: "10344971235874465080",
    },
    polygonamoy: {
      router: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2",
      usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
      chainSelector: "16281711391670634445",
    },
    sepolia: {
      router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
      usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      chainSelector: "16015286601757825753",
    },
  };
  
  export const SUPPORTED_CHAINS = Object.keys(CHAIN_ADDRESSES);