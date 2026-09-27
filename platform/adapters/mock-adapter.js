import { pathToFileURL } from "node:url";

export class MockAdapter {
  name = "mock";

  async execute(context) {
    const module = await import(pathToFileURL(context.definition.skill.mockModulePath));
    if (typeof module.run !== "function") throw new Error("Mock skill module must export run(context)");
    return { artifact: await module.run(context), modelVersion: "deterministic-test-v1" };
  }
}
