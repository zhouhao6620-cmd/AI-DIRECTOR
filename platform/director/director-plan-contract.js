import { assertSchema } from "../contracts/schema-validator.js";
import { loadArtifactSchema } from "../contracts/schema-registry.js";

export class DirectorPlanContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "DirectorPlanContractError";
  }
}

export async function assertDirectorPlanHandoff({ plan, contentUnderstanding, componentIndex }) {
  assertSchema(await loadArtifactSchema("DirectorPlan"), plan, "DirectorPlan");
  assertSchema(await loadArtifactSchema("ComponentCapabilityIndex"), componentIndex, "ComponentCapabilityIndex");

  if (plan.technical.lifecycle !== "CANDIDATE") {
    throw new DirectorPlanContractError("M02 may hand off only a CANDIDATE DirectorPlan");
  }
  if (plan.product.projectId !== contentUnderstanding.product.projectId) {
    throw new DirectorPlanContractError("DirectorPlan project does not match Content Understanding");
  }
  if (plan.technical.inputRevision !== contentUnderstanding.technical.inputRevision) {
    throw new DirectorPlanContractError("DirectorPlan inputRevision does not match Content Understanding");
  }
  if (plan.technical.traceability.contentUnderstandingArtifactId !== contentUnderstanding.technical.artifactId) {
    throw new DirectorPlanContractError("DirectorPlan traceability does not reference the input artifact");
  }
  if (plan.technical.traceability.componentCapabilityIndexRevision !== componentIndex.technical.revision) {
    throw new DirectorPlanContractError("DirectorPlan does not reference the supplied component index revision");
  }

  const sourceSegments = new Map(contentUnderstanding.product.segments.map((segment) => [segment.sourceSegmentId, segment]));
  const registeredComponents = new Map(
    componentIndex.product.components
      .filter((component) => component.availability === "REGISTERED")
      .map((component) => [component.componentId, component]),
  );
  const chapterIds = new Set();
  const shotIds = new Set();

  for (const chapter of plan.product.chapters) {
    requireUnique(chapterIds, chapter.chapterId, "chapterId");
    if (chapter.endMs <= chapter.startMs) throw new DirectorPlanContractError(`Chapter ${chapter.chapterId} has an invalid time range`);

    for (const shot of chapter.shots) {
      requireUnique(shotIds, shot.directorShotId, "directorShotId");
      if (shot.endMs <= shot.startMs) throw new DirectorPlanContractError(`Shot ${shot.directorShotId} has an invalid time range`);
      if (shot.startMs < chapter.startMs || shot.endMs > chapter.endMs) {
        throw new DirectorPlanContractError(`Shot ${shot.directorShotId} is outside chapter ${chapter.chapterId}`);
      }

      const tracedSegments = shot.sourceSegmentIds.map((segmentId) => {
        const segment = sourceSegments.get(segmentId);
        if (!segment) throw new DirectorPlanContractError(`Shot ${shot.directorShotId} references unknown source segment ${segmentId}`);
        return segment;
      });
      const expectedStart = Math.min(...tracedSegments.map((segment) => segment.startMs));
      const expectedEnd = Math.max(...tracedSegments.map((segment) => segment.endMs));
      if (shot.startMs !== expectedStart || shot.endMs !== expectedEnd) {
        throw new DirectorPlanContractError(`Shot ${shot.directorShotId} time range must match its source segments`);
      }

      for (const component of shot.components) {
        const registered = registeredComponents.get(component.componentId);
        if (!registered) {
          throw new DirectorPlanContractError(`Shot ${shot.directorShotId} references unregistered component ${component.componentId}; use assetGaps instead`);
        }
        if (component.componentType !== registered.type || component.componentName !== registered.name) {
          throw new DirectorPlanContractError(`Shot ${shot.directorShotId} component identity does not match the registry`);
        }
        if (component.componentVersion !== undefined && component.componentVersion !== registered.version) {
          throw new DirectorPlanContractError(`Shot ${shot.directorShotId} component ${component.componentId} version does not match the registry`);
        }
      }
    }
  }

  return plan;
}

function requireUnique(values, value, label) {
  if (values.has(value)) throw new DirectorPlanContractError(`Duplicate ${label}: ${value}`);
  values.add(value);
}
