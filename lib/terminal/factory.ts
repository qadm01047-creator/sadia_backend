/**
 * Terminal Provider Factory
 * Returns appropriate terminal provider based on environment configuration
 */

import { TerminalProvider } from './interface';
import { MockTerminalProvider } from './mock-provider';

const PROVIDER_TYPE = process.env.TERMINAL_PROVIDER || 'mock';

export function getTerminalProvider(): TerminalProvider {
  switch (PROVIDER_TYPE) {
    case 'mock':
      return new MockTerminalProvider();
    // Future: add more providers
    // case 'real':
    //   return new RealTerminalProvider();
    default:
      console.log(`Unknown terminal provider: ${PROVIDER_TYPE}, defaulting to mock`);
      return new MockTerminalProvider();
  }
}

export type { TerminalProvider } from './interface';
