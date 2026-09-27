export class MaterialPreparationError extends Error {
  constructor(code, message, {
    retryable = true,
    recommendedAction = "Correct the source input and retry.",
    ui = null,
    cause,
  } = {}) {
    super(message, { cause });
    this.name = "MaterialPreparationError";
    this.code = code;
    this.retryable = retryable;
    this.recommendedAction = recommendedAction;
    this.ui = ui;
  }
}

export function asMaterialError(error) {
  if (error instanceof MaterialPreparationError) return error;
  return new MaterialPreparationError(
    "MATERIAL_PREPARATION_FAILED",
    error instanceof Error ? error.message : String(error),
    { cause: error },
  );
}
