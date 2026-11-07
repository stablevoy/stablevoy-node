import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseUnmatchedTransfer, type UnmatchedTransfer } from '../model/UnmatchedTransfer.js';

/** Transfers to the payout wallet that matched no invoice, on the networks of the key's store. Read only. */
export class UnmatchedTransfers {
  constructor(private readonly transport: Transport) {}

  /** Newest first, at most 100. The API allows 30 calls a minute per store. */
  async list(): Promise<UnmatchedTransfer[]> {
    const data = await this.transport.get('/v1/unmatched-transfers');
    if (!Array.isArray(data)) throw new UnexpectedResponseError('unmatchedTransfers is not a list');
    return data.map((item, i) => parseUnmatchedTransfer(Fields.of(item, `unmatchedTransfers[${i}]`)));
  }
}
