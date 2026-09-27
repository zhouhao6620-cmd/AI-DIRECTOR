export class CapabilityRegistry {
  #definitions = new Map();

  register(definition) {
    validateDefinition(definition);
    if (this.#definitions.has(definition.capabilityName)) {
      throw new Error(`Capability already registered: ${definition.capabilityName}`);
    }
    this.#definitions.set(definition.capabilityName, Object.freeze(structuredClone(definition)));
    return this;
  }

  resolve(capabilityName) {
    const definition = this.#definitions.get(capabilityName);
    if (!definition) throw new Error(`Unknown capabilityName: ${capabilityName}`);
    return definition;
  }

  listPublic() {
    return [...this.#definitions.values()].map(({ capabilityName, description, outputArtifactType }) => ({
      capabilityName,
      description,
      outputArtifactType,
    }));
  }
}

function validateDefinition(definition) {
  const required = ["capabilityName", "description", "skill", "adapters", "outputArtifactType", "outputSchema"];
  for (const key of required) {
    if (!definition[key]) throw new Error(`Capability definition missing ${key}`);
  }
  if (!definition.adapters.real || !definition.adapters.mock) {
    throw new Error("Capability must declare real and mock adapters with the same contract");
  }
}
