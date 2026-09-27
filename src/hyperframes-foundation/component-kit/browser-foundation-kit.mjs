import {
  createPatchAck,
  validatePatchEnvelope,
  validateVariables,
} from './patch-contract.mjs';

export function createFoundationComponentKit({
  window,
  initialVariables = {},
  render,
  createTimeline,
}) {
  const initialValidation = validateVariables(initialVariables);
  if (!initialValidation.ok) {
    throw new Error(initialValidation.errorCode);
  }

  const expectedOrigin = window.location.origin;
  let variables = { ...initialVariables };
  let timeline;
  let rebindCount = 0;

  function rebindTimeline() {
    timeline?.kill?.();
    timeline = createTimeline?.({ variables: { ...variables }, rebindCount });
    rebindCount += 1;
    window.document.documentElement.dataset.r3TimelineRebind = String(rebindCount);
  }

  function applyPatch(nextVariables) {
    const validation = validateVariables(nextVariables);
    if (!validation.ok) {
      return validation;
    }

    variables = { ...variables, ...nextVariables };
    render?.({ ...variables });
    rebindTimeline();
    return { ok: true, variables: { ...variables }, rebindCount };
  }

  function onMessage(event) {
    if (event.origin !== expectedOrigin || event.source !== window.parent) {
      return;
    }

    const validation = validatePatchEnvelope(event.data);
    if (!validation.ok) {
      return;
    }

    const result = applyPatch(event.data.variables);
    window.parent.postMessage(createPatchAck(event.data.requestId, result), expectedOrigin);
  }

  window.addEventListener('message', onMessage);
  render?.({ ...variables });
  rebindTimeline();

  return Object.freeze({
    get variables() {
      return { ...variables };
    },
    get rebindCount() {
      return rebindCount;
    },
    applyPatch,
    rebindTimeline,
    dispose() {
      window.removeEventListener('message', onMessage);
      timeline?.kill?.();
    },
  });
}
