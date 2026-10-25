import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { Fields } from '../src/model/Fields.js';

describe('Fields', () => {
  it.each([
    ['missing', { a: 1 }, (f: Fields) => f.string('b'), 'x.b is missing'],
    ['string', { a: 1 }, (f: Fields) => f.string('a'), 'x.a is not a string'],
    ['nullable string', { a: 1 }, (f: Fields) => f.nullableString('a'), 'x.a is not a string or null'],
    ['int', { a: '1' }, (f: Fields) => f.int('a'), 'x.a is not an integer'],
    ['unsafe int', { a: 2 ** 60 }, (f: Fields) => f.int('a'), 'x.a is not an integer'],
    ['nullable int', { a: 1.5 }, (f: Fields) => f.nullableInt('a'), 'x.a is not an integer or null'],
    ['bool', { a: 1 }, (f: Fields) => f.bool('a'), 'x.a is not a boolean'],
    ['date', { a: 'yesterday-ish' }, (f: Fields) => f.date('a'), 'x.a is not an ISO 8601 date'],
    ['list', { a: { k: 1 } }, (f: Fields) => f.list('a'), 'x.a is not a list'],
    ['strings', { a: [1] }, (f: Fields) => f.strings('a'), 'x.a is not a list of strings'],
    ['object', { a: [1, 2] }, (f: Fields) => f.object('a'), 'x.a is not a JSON object'],
    ['inherited key', Object.create({ a: 'x' }) as object, (f: Fields) => f.string('a'), 'x.a is missing'],
  ])('names the field that is %s', (_what, data, read, message) => {
    expect(() => read(Fields.of(data, 'x'))).toThrow(new UnexpectedResponseError(message));
  });

  it('reads nulls and dates', () => {
    const f = Fields.of({ s: null, i: null, d: null, e: '2026-10-25T10:00:00.000Z' }, 'x');
    expect([f.nullableString('s'), f.nullableInt('i'), f.nullableDate('d')]).toEqual([null, null, null]);
    expect(f.nullableDate('e')?.toISOString()).toBe('2026-10-25T10:00:00.000Z');
  });

  it.each([[[1, 2]], [null], ['text']])('refuses %j where an object belongs', (value) => {
    expect(() => Fields.of(value, 'x')).toThrow(UnexpectedResponseError);
  });
});
