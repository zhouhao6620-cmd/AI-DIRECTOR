export class HyperframesAdapter {
  #player;
  #cleanup = [];

  constructor(player) {
    if (!player) {
      throw new Error('A HyperFrames player element is required.');
    }
    this.#player = player;
  }

  get element() {
    return this.#player;
  }

  async play() {
    await this.#player.play();
  }

  async pause() {
    await this.#player.pause();
  }

  async seek(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('Seek time must be a non-negative finite number.');
    }
    await this.#player.seek(seconds);
  }

  setRate(rate) {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Playback rate must be a positive finite number.');
    }
    this.#player.playbackRate = rate;
  }

  on(type, listener) {
    const wrapped = (event) => listener(event.detail);
    this.#player.addEventListener(type, wrapped);
    const dispose = () => this.#player.removeEventListener(type, wrapped);
    this.#cleanup.push(dispose);
    return dispose;
  }

  destroy() {
    for (const dispose of this.#cleanup.splice(0)) {
      dispose();
    }
  }
}
