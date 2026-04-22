import { describe, it, expect } from 'vitest';
import {
  isEmptyValue,
  isTextFilterMode,
  serializeFilterValue,
} from '@/components/admin/users/filterHelpers';

describe('isEmptyValue', () => {
  it('returns true for null', () => {
    expect(isEmptyValue(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isEmptyValue(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isEmptyValue('')).toBe(true);
  });

  it('returns true for whitespace-only string', () => {
    expect(isEmptyValue('   ')).toBe(true);
  });

  it('returns true for tab/newline whitespace', () => {
    expect(isEmptyValue('\t\n  ')).toBe(true);
  });

  it('returns false for non-empty string', () => {
    expect(isEmptyValue('valor')).toBe(false);
  });

  it('returns false for a string with leading/trailing whitespace but real content', () => {
    expect(isEmptyValue('  hola  ')).toBe(false);
  });

  it('returns false for 0 (not an empty value, just falsy)', () => {
    expect(isEmptyValue(0)).toBe(false);
  });

  it('returns false for boolean false', () => {
    expect(isEmptyValue(false)).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(isEmptyValue([])).toBe(true);
  });

  it('returns false for non-empty array', () => {
    expect(isEmptyValue(['a'])).toBe(false);
  });

  it('returns true for empty plain object', () => {
    expect(isEmptyValue({})).toBe(true);
  });

  it('returns false for non-empty plain object', () => {
    expect(isEmptyValue({ a: 1 })).toBe(false);
  });
});

describe('isTextFilterMode', () => {
  it('accepts { mode: "empty" }', () => {
    expect(isTextFilterMode({ mode: 'empty' })).toBe(true);
  });

  it('accepts { mode: "notEmpty" }', () => {
    expect(isTextFilterMode({ mode: 'notEmpty' })).toBe(true);
  });

  it('rejects strings', () => {
    expect(isTextFilterMode('empty')).toBe(false);
  });

  it('rejects booleans', () => {
    expect(isTextFilterMode(true)).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isTextFilterMode(null)).toBe(false);
    expect(isTextFilterMode(undefined)).toBe(false);
  });

  it('rejects objects with unknown mode', () => {
    expect(isTextFilterMode({ mode: 'contains' })).toBe(false);
    expect(isTextFilterMode({ mode: 42 })).toBe(false);
  });

  it('rejects objects without mode key', () => {
    expect(isTextFilterMode({})).toBe(false);
    expect(isTextFilterMode({ other: 'empty' })).toBe(false);
  });
});

describe('serializeFilterValue', () => {
  it('distinguishes string "empty" from { mode: "empty" }', () => {
    expect(serializeFilterValue('empty')).not.toBe(serializeFilterValue({ mode: 'empty' }));
  });

  it('distinguishes { mode: "empty" } from { mode: "notEmpty" }', () => {
    expect(serializeFilterValue({ mode: 'empty' })).not.toBe(
      serializeFilterValue({ mode: 'notEmpty' })
    );
  });

  it('serializes primitives as String()', () => {
    expect(serializeFilterValue('hola')).toBe('hola');
    expect(serializeFilterValue(true)).toBe('true');
    expect(serializeFilterValue(false)).toBe('false');
    expect(serializeFilterValue(42)).toBe('42');
  });

  it('serializes objects as JSON', () => {
    expect(serializeFilterValue({ mode: 'empty' })).toBe('{"mode":"empty"}');
  });
});
