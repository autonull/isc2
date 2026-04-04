/* eslint-disable */
/**
 * Verdict Service — browser adapter
 *
 * Delegates to @isc/social createVerdictService with browser-specific adapters.
 * checkVerdictReadiness is re-exported as a pure function from the package.
 */

import { createVerdictService, checkVerdictReadiness } from '@isc/social';
import {
  createBrowserModerationStorage,
  createBrowserModerationNetwork,
} from '../adapters.ts';
import type { Verdict } from '@isc/social';

export { checkVerdictReadiness };

const service = createVerdictService(
  createBrowserModerationStorage(),
  createBrowserModerationNetwork()
);

export function enforceVerdict(verdict: Verdict): Promise<void> {
  return service.enforce(verdict);
}

export function getVerdict(appealId: string): Promise<Verdict | null> {
  return service.get(appealId);
}

export function getAllVerdicts(): Promise<Verdict[]> {
  return service.getAll();
}
