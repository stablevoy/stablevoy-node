import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseLimits, parseNetwork, parsePricing, type Limits, type Network, type Pricing } from '../model/Platform.js';

/** Public facts about the platform: invoice limits, the price list and the supported networks. */
export class Platform {
  constructor(private readonly transport: Transport) {}

  async limits(): Promise<Limits> {
    return parseLimits(Fields.of(await this.transport.get('/v1/limits'), 'limits'));
  }

  async pricing(): Promise<Pricing> {
    return parsePricing(Fields.of(await this.transport.get('/v1/pricing'), 'pricing'));
  }

  async networks(): Promise<Network[]> {
    const data = await this.transport.get('/v1/networks');
    if (!Array.isArray(data)) throw new UnexpectedResponseError('networks is not a list');
    return data.map((item, i) => parseNetwork(Fields.of(item, `networks[${i}]`)));
  }
}
