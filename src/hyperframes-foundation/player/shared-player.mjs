import { createPatchEnvelope, validatePatchAck } from '../component-kit/patch-contract.mjs';
import { HyperframesAdapter } from './hyperframes-adapter.mjs';

function newRequestId() {
  return `r3-hf-${crypto.randomUUID()}`;
}

function compositionWindow(player) {
  return player.iframe?.contentWindow ?? player.iframeElement?.contentWindow;
}

export class SharedPlayer {
  #window;
  #document;
  #origin;
  #runtimeUrl;
  #adapter;
  #pending = new Map();
  #onMessage;

  constructor({ window, document = window.document, origin = window.location.origin, runtimeUrl }) {
    if (!runtimeUrl) {
      throw new Error('A resolved R3 runtime URL is required.');
    }
    this.#window = window;
    this.#document = document;
    this.#origin = new URL(origin).origin;
    this.#runtimeUrl = runtimeUrl;
    this.#onMessage = this.#receivePatchAck.bind(this);
  }

  get adapter() {
    return this.#adapter;
  }

  mount(container, { source, width = 640, height = 360 }) {
    if (this.#adapter) {
      throw new Error('SharedPlayer is already mounted.');
    }

    const player = this.#document.createElement('hyperframes-player');
    player.setAttribute('src', source);
    player.setAttribute('runtime-src', this.#runtimeUrl);
    player.setAttribute('width', String(width));
    player.setAttribute('height', String(height));
    container.append(player);
    this.#adapter = new HyperframesAdapter(player);
    this.#window.addEventListener('message', this.#onMessage);
    return this.#adapter;
  }

  patch(variables, { timeoutMs = 1500 } = {}) {
    if (!this.#adapter) {
      return Promise.reject(new Error('SharedPlayer is not mounted.'));
    }

    const target = compositionWindow(this.#adapter.element);
    if (!target) {
      return Promise.reject(new Error('HyperFrames frame is not ready for patching.'));
    }

    const requestId = newRequestId();
    const envelope = createPatchEnvelope(requestId, variables);

    return new Promise((resolve, reject) => {
      const timer = this.#window.setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error('PATCH_ACK_TIMEOUT'));
      }, timeoutMs);

      this.#pending.set(requestId, { resolve, reject, timer });
      target.postMessage(envelope, this.#origin);
    });
  }

  #receivePatchAck(event) {
    if (!this.#adapter || event.origin !== this.#origin) {
      return;
    }

    const expectedSource = compositionWindow(this.#adapter.element);
    if (!expectedSource || event.source !== expectedSource) {
      return;
    }

    const validation = validatePatchAck(event.data);
    if (!validation.ok) {
      return;
    }

    const pending = this.#pending.get(event.data.requestId);
    if (!pending) {
      return;
    }

    this.#pending.delete(event.data.requestId);
    this.#window.clearTimeout(pending.timer);
    if (event.data.ok) {
      pending.resolve(event.data);
    } else {
      pending.reject(new Error(event.data.errorCode));
    }
  }

  destroy() {
    this.#window.removeEventListener('message', this.#onMessage);
    for (const [requestId, pending] of this.#pending) {
      this.#window.clearTimeout(pending.timer);
      pending.reject(new Error('PLAYER_DESTROYED'));
      this.#pending.delete(requestId);
    }
    this.#adapter?.destroy();
    this.#adapter?.element.remove();
    this.#adapter = undefined;
  }
}
