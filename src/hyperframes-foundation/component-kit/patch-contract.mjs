export const PATCH_PROTOCOL = 'r3.hyperframes.patch.v1';
export const PATCH_ACK_PROTOCOL = 'r3.hyperframes.patch-ack.v1';

export function isPlainObject(value) {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function isSupportedVariable(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return typeof value === 'string' || typeof value === 'boolean';
}

export function validateVariables(variables) {
  if (!isPlainObject(variables)) {
    return { ok: false, errorCode: 'INVALID_VARIABLES' };
  }

  for (const [key, value] of Object.entries(variables)) {
    if (!key || !isSupportedVariable(value)) {
      return { ok: false, errorCode: 'INVALID_VARIABLE_VALUE' };
    }
  }

  return { ok: true };
}

export function createPatchEnvelope(requestId, variables) {
  const validation = validateVariables(variables);
  if (!requestId || !validation.ok) {
    throw new Error(validation.errorCode ?? 'INVALID_REQUEST_ID');
  }

  return Object.freeze({ protocol: PATCH_PROTOCOL, requestId, variables });
}

export function validatePatchEnvelope(value) {
  if (!isPlainObject(value) || value.protocol !== PATCH_PROTOCOL || !value.requestId) {
    return { ok: false, errorCode: 'INVALID_PATCH_ENVELOPE' };
  }

  return validateVariables(value.variables);
}

export function createPatchAck(requestId, result) {
  return Object.freeze({
    protocol: PATCH_ACK_PROTOCOL,
    requestId,
    ok: result.ok,
    ...(result.ok ? {} : { errorCode: result.errorCode ?? 'PATCH_REJECTED' }),
    ...(result.detail ? { detail: result.detail } : {}),
  });
}

export function validatePatchAck(value) {
  if (!isPlainObject(value) || value.protocol !== PATCH_ACK_PROTOCOL || !value.requestId) {
    return { ok: false, errorCode: 'INVALID_PATCH_ACK' };
  }

  if (typeof value.ok !== 'boolean') {
    return { ok: false, errorCode: 'INVALID_PATCH_ACK' };
  }

  return { ok: true };
}
