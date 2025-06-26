import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
  parseKeyValueXml
} from '@elizaos/core';
import { z } from 'zod';
import { transferFromFirstAvailableChain } from './utils/transferFromChains';
/**
 * Define the configuration schema for the plugin with the following properties:
 *
 * @param {string} EXAMPLE_PLUGIN_VARIABLE - The name of the plugin (min length of 1, optional)
 * @returns {object} - The configured schema object
 */
// const configSchema = z.object({
//   EXAMPLE_PLUGIN_VARIABLE: z
//     .string()
//     .min(1, 'Example plugin variable is not provided')
//     .optional()
//     .transform((val) => {
//       if (!val) {
//         console.warn('Warning: Example plugin variable is not provided');
//       }
//       return val;
//     }),
// });
;
const transferSchema = z.object({
  amount: z.string()
    .regex(/^[0-9]*\.?[0-9]+$/, 'Amount must be a number as a string')
    .transform((val) => {
      logger.info('Validating amount:', val);
      return val;
    }),
  token: z.string().default('ETH'),
  chain: z.enum(['ethereum', 'sepolia', 'base', 'polygon'])
    .transform((val) => {
      logger.info('Chain selected:', val);
      return val;
    }),
  to: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
    .transform((val) => {
      logger.info('Recipient address:', val);
      return val;
    }),
});

const tokenTransferTemplate = `Extract the token symbol, amount, chain name, and recipient address from the user's message.

User message: "{{userMessage}}"

Return the values in this XML format:
<response>
<token>TOKEN_SYMBOL</token>
<amount>AMOUNT</amount>
<chain>CHAIN_NAME</chain>
<to>RECIPIENT_ADDRESS</to>
</response>

If the message is not a token transfer request, return:
<response>
<error>Not a token transfer request</error>
</response>`;



/**
 * Example HelloWorld action
 * This demonstrates the simplest possible action structure
 */
/**
 * Represents an action that responds with a simple hello world message.
 *
 * @typedef {Object} Action
 * @property {string} name - The name of the action
 * @property {string[]} similes - The related similes of the action
 * @property {string} description - Description of the action
 * @property {Function} validate - Validation function for the action
 * @property {Function} handler - The function that handles the action
 * @property {Object[]} examples - Array of examples for the action
 */
const ccipTransferAction: Action = { 
  name: 'CCIP_TRANSFER',
  similes: ['SEND_PAYMENT', 'TRANSFER_TOKENS', 'CROSS_CHAIN_TRANSFER'],
  description: 'Execute a cross-chain token transfer using Chainlink CCIP',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling CCIP_TRANSFER action');

      const prompt = tokenTransferTemplate.replace('{{userMessage}}', message.content.text || '');
      const response = await _runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        maxTokens: 100,
      });
      
      const parsed = parseKeyValueXml(response);
      
      // ❌ Fallback if not a proper transfer request
      if (!parsed || parsed.error || !parsed.token || !parsed.chain || !parsed.to || !parsed.amount) {
        return { text: '', data: {}, values: {} };
      }
      
      // ✅ Normalized values
      const token = parsed.token.toUpperCase();
      const chain = parsed.chain.toLowerCase();
      const recipient = parsed.to;
      const amount = parsed.amount;
      console.log("token, chain, recipient, amount", token, chain, recipient, amount);


      const result = await transferFromFirstAvailableChain(token, chain, recipient, amount);
      const { txhash } = result!;
      // Simple response content
      const responseContent: Content = {
        text: txhash,
        actions: ['CCIP_TRANSFER'],
        source: message.content.source,
      };

      // Call back with the hello world message
      await callback(responseContent);

      return responseContent;
    } catch (error) {
      logger.error('Error in CCIP_TRANSFER action:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Please transfer 0.001 ETH to 0x98692B795D1fB6072de084728f7cC6d56100b807 using CCIP.',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Transfer complete! Transaction hash: 0x1234abcd... (example)',
          actions: ['CCIP_TRANSFER'],
        },
      },
    ],
  ],
};

/**
 * Example Hello World Provider
 * This demonstrates the simplest possible provider implementation
 */
const helloWorldProvider: Provider = {
  name: 'HELLO_WORLD_PROVIDER',
  description: 'A simple example provider',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    return {
      text: 'I am a provider',
      values: {},
      data: {},
    };
  },
};

export class StarterService extends Service {
  static serviceType = 'starter';
  capabilityDescription =
    'This is a starter service which is attached to the agent through the starter plugin.';

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('*** Starting starter service ***');
    const service = new StarterService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping starter service ***');
    // get the service from the runtime
    const service = runtime.getService(StarterService.serviceType);
    if (!service) {
      throw new Error('Starter service not found');
    }
    service.stop();
  }

  async stop() {
    logger.info('*** Stopping starter service instance ***');
  }
}

const plugin: Plugin = {
  name: 'starter',
  description: 'A starter plugin for Eliza',
  // Set lowest priority so real models take precedence
  priority: -1000,
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE,
  },
  async init(config: Record<string, string>) {
    logger.info('*** Initializing starter plugin ***');
    try {
      const validatedConfig = await transferSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      _runtime,
      { prompt, stopSequences = [] }: GenerateTextParams
    ) => {
      return 'Never gonna give you up, never gonna let you down, never gonna run around and desert you...';
    },
    [ModelType.TEXT_LARGE]: async (
      _runtime,
      {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams
    ) => {
      return 'Never gonna make you cry, never gonna say goodbye, never gonna tell a lie and hurt you...';
    },
  },
  routes: [
    {
      name: 'helloworld',
      path: '/helloworld',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        // send a response
        res.json({
          message: 'Hello World!',
        });
      },
    },
  ],
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('MESSAGE_RECEIVED event received');
        // print the keys
        logger.info(Object.keys(params));
      },
    ],
    VOICE_MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('VOICE_MESSAGE_RECEIVED event received');
        // print the keys
        logger.info(Object.keys(params));
      },
    ],
    WORLD_CONNECTED: [
      async (params) => {
        logger.info('WORLD_CONNECTED event received');
        // print the keys
        logger.info(Object.keys(params));
      },
    ],
    WORLD_JOINED: [
      async (params) => {
        logger.info('WORLD_JOINED event received');
        // print the keys
        logger.info(Object.keys(params));
      },
    ],
  },
  services: [StarterService],
  actions: [ccipTransferAction],
  providers: [helloWorldProvider],
};

export default plugin;
