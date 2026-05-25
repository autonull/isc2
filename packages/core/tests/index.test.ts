/* eslint-disable */
import { describe, it, expect } from 'vitest';
import * as core from '../src/index.js';

describe('index', () => {
  it('should have exports', () => {
    expect(Object.keys(core).length).toBeGreaterThan(0);
  });
});