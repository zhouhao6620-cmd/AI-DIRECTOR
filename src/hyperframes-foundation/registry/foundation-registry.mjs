const FORMAL_ASSET_ID = /^CMP-/;

export class FoundationRegistry {
  #entries = new Map();

  register({ id, kind, entry }) {
    if (!id || FORMAL_ASSET_ID.test(id)) {
      throw new Error('Foundation registry cannot accept formal CMP assets.');
    }
    if (kind !== 'foundation-fixture' || !entry) {
      throw new Error('Foundation registry only accepts an explicit test fixture.');
    }
    if (this.#entries.has(id)) {
      throw new Error(`Duplicate foundation entry: ${id}`);
    }
    const value = Object.freeze({ id, kind, entry });
    this.#entries.set(id, value);
    return value;
  }

  get(id) {
    return this.#entries.get(id);
  }
}
