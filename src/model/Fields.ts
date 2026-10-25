import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';

/**
 * Strict reads from a decoded JSON object. A missing field or one of the wrong type is an error naming the field,
 * never a silent default.
 */
export class Fields {
  private constructor(
    private readonly data: Readonly<Record<string, unknown>>,
    private readonly path: string,
  ) {}

  static of(value: unknown, path: string): Fields {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new UnexpectedResponseError(`${path} is not a JSON object`);
    return new Fields(value as Record<string, unknown>, path);
  }

  string(key: string): string {
    const value = this.value(key);
    if (typeof value !== 'string') throw this.wrong(key, 'a string');
    return value;
  }

  nullableString(key: string): string | null {
    const value = this.value(key);
    if (value !== null && typeof value !== 'string') throw this.wrong(key, 'a string or null');
    return value;
  }

  int(key: string): number {
    const value = this.value(key);
    if (!Number.isSafeInteger(value)) throw this.wrong(key, 'an integer');
    return value as number;
  }

  nullableInt(key: string): number | null {
    const value = this.value(key);
    if (value !== null && !Number.isSafeInteger(value)) throw this.wrong(key, 'an integer or null');
    return value as number | null;
  }

  bool(key: string): boolean {
    const value = this.value(key);
    if (typeof value !== 'boolean') throw this.wrong(key, 'a boolean');
    return value;
  }

  date(key: string): Date {
    return this.parseDate(key, this.string(key));
  }

  nullableDate(key: string): Date | null {
    const value = this.nullableString(key);
    return value === null ? null : this.parseDate(key, value);
  }

  strings(key: string): string[] {
    return this.list(key).map((item) => {
      if (typeof item !== 'string') throw this.wrong(key, 'a list of strings');
      return item;
    });
  }

  list(key: string): unknown[] {
    const value = this.value(key);
    if (!Array.isArray(value)) throw this.wrong(key, 'a list');
    return value;
  }

  /** Each item of a list of objects, parsed with `parse`. */
  objects<T>(key: string, parse: (item: Fields) => T): T[] {
    return this.list(key).map((item, i) => parse(Fields.of(item, `${this.path}.${key}[${i}]`)));
  }

  object(key: string): Fields {
    return Fields.of(this.value(key), `${this.path}.${key}`);
  }

  /** The object as decoded, for data this library does not model. */
  raw(): Readonly<Record<string, unknown>> {
    return this.data;
  }

  private value(key: string): unknown {
    if (!Object.hasOwn(this.data, key)) throw new UnexpectedResponseError(`${this.path}.${key} is missing`);
    return this.data[key];
  }

  private parseDate(key: string, value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw this.wrong(key, 'an ISO 8601 date');
    return date;
  }

  private wrong(key: string, expected: string): UnexpectedResponseError {
    return new UnexpectedResponseError(`${this.path}.${key} is not ${expected}`);
  }
}
