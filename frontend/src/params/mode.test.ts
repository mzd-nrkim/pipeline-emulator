import { describe, it, expect } from 'vitest';
import { match } from './mode.js';

describe('mode param matcher', () => {
  it('accepts sample', () => expect(match('sample')).toBe(true));
  it('accepts real', () => expect(match('real')).toBe(true));
  it('rejects empty string', () => expect(match('')).toBe(false));
  it('rejects capitalized Sample', () => expect(match('Sample')).toBe(false));
  it('rejects reals (partial + suffix)', () => expect(match('reals')).toBe(false));
  it('rejects admin', () => expect(match('admin')).toBe(false));
  it('rejects arbitrary string', () => expect(match('foo')).toBe(false));
});
