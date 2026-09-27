import { readFile } from "node:fs/promises";

export class SchemaValidationError extends Error {
  constructor(schemaName, errors) {
    super(`${schemaName} validation failed: ${errors.join("; ")}`);
    this.name = "SchemaValidationError";
    this.schemaName = schemaName;
    this.errors = errors;
  }
}

export async function loadSchema(schemaPath) {
  return JSON.parse(await readFile(schemaPath, "utf8"));
}

export function validateSchema(schema, value, schemaName = schema.$id ?? "schema") {
  const errors = [];
  visit(schema, value, "$", errors);
  return { valid: errors.length === 0, errors, schemaName };
}

export function assertSchema(schema, value, schemaName = schema.$id ?? "schema") {
  const result = validateSchema(schema, value, schemaName);
  if (!result.valid) throw new SchemaValidationError(schemaName, result.errors);
  return value;
}

function visit(schema, value, path, errors) {
  if (schema.const !== undefined && !Object.is(value, schema.const)) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
  }

  const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.type && !allowedTypes.some((type) => matchesType(type, value))) {
    errors.push(`${path} must be ${allowedTypes.join(" or ")}`);
    return;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match ${schema.pattern}`);
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${path} must be >= ${schema.minimum}`);
  }
  if (typeof value === "number" && schema.maximum !== undefined && value > schema.maximum) {
    errors.push(`${path} must be <= ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, index) => visit(schema.items, item, `${path}[${index}]`, errors));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) visit(childSchema, value[key], `${path}.${key}`, errors);
    }
  }
}

function matchesType(type, value) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}
