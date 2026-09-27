import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createContentUnderstandingService } from "./content-understanding-service.js";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function createContentUnderstandingHttpBridge({
  projectRoot,
  mode = process.env.CONTENT_UNDERSTANDING_MODE ?? "real",
  codex = {},
  mediaProbeOptions = {},
  service = createContentUnderstandingService({ projectRoot, codex, mediaProbeOptions }),
} = {}) {
  const sessions = new Map();
  const runs = new Map();

  return {
    async handleNodeRequest(incoming, outgoing) {
      const request = toWebRequest(incoming);
      const response = await handle(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    },
    async handle(request) {
      return handle(request);
    },
  };

  async function handle(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/content-understanding/health") {
      return json({ ok: true, mode });
    }

    if (request.method === "POST" && url.pathname === "/api/content-understanding/runs") {
      return createRun(request);
    }

    const runMatch = url.pathname.match(/^\/api\/content-understanding\/runs\/([A-Za-z0-9-]+)$/);
    if (request.method === "GET" && runMatch) return readRun(runMatch[1]);

    const retryMatch = url.pathname.match(/^\/api\/content-understanding\/sessions\/([A-Za-z0-9-]+)\/retry$/);
    if (request.method === "POST" && retryMatch) return retryRun(retryMatch[1]);

    return json({ error: "NOT_FOUND", message: "Local content-understanding endpoint not found." }, 404);
  }

  async function createRun(request) {
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "INVALID_FORM", message: "无法读取本地素材，请重新选择文件。" }, 400);
    }

    const projectName = String(form.get("projectName") ?? "").trim();
    const aspectRatio = String(form.get("aspectRatio") ?? "");
    const baseVideo = form.get("baseVideo");
    const finalSrt = form.get("finalSrt");
    if (!projectName || !new Set(["9:16", "16:9"]).has(aspectRatio) || !isFile(baseVideo) || !isFile(finalSrt)) {
      return json({ error: "PROJECT_INPUT_INVALID", message: "请填写项目名称，并选择基础视频与最终 SRT。" }, 400);
    }

    const sessionId = randomUUID();
    const projectId = `local-${sessionId}`;
    const uploadDirectory = path.join(projectRoot, ".runtime", "uploads", projectId);
    await mkdir(uploadDirectory, { recursive: true });
    const videoName = safeUploadName(baseVideo.name, "base-video.mp4");
    const subtitleName = safeUploadName(finalSrt.name, "final.srt");
    const videoPath = path.join(uploadDirectory, videoName);
    const subtitlePath = path.join(uploadDirectory, subtitleName);
    await Promise.all([
      writeFile(videoPath, Buffer.from(await baseVideo.arrayBuffer()), { flag: "wx" }),
      writeFile(subtitlePath, Buffer.from(await finalSrt.arrayBuffer()), { flag: "wx" }),
    ]);

    const session = {
      sessionId,
      projectId,
      projectName,
      aspectRatio,
      baseVideoRef: toProjectRef(projectRoot, videoPath),
      finalSrtRef: toProjectRef(projectRoot, subtitlePath),
      attempt: 0,
    };
    sessions.set(sessionId, session);
    return startRun(session);
  }

  async function retryRun(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return json({ error: "SESSION_NOT_FOUND", message: "本次运行已失效，请重新提交素材。" }, 404);
    if (session.attempt >= 2) {
      return json({
        error: "RETRY_LIMIT_REACHED",
        message: "本次内容理解已达到两次尝试上限。请检查素材或本地运行环境后重新提交。",
        retry: { retryable: false, attempt: session.attempt, maxAttempts: 2, remainingAttempts: 0 },
      }, 409);
    }
    return startRun(session);
  }

  function startRun(session) {
    session.attempt += 1;
    const runId = `cu-${randomUUID()}`;
    const run = {
      runId,
      sessionId: session.sessionId,
      projectId: session.projectId,
      attempt: session.attempt,
      uiStatus: "PENDING",
      issues: [],
      retry: { retryable: session.attempt < 2, attempt: session.attempt, maxAttempts: 2, remainingAttempts: 2 - session.attempt },
      artifact: null,
      stateRef: null,
    };
    runs.set(runId, run);

    void service.run({
      runId,
      projectId: session.projectId,
      projectName: session.projectName,
      aspectRatio: session.aspectRatio,
      baseVideoRef: session.baseVideoRef,
      finalSrtRef: session.finalSrtRef,
      language: "zh-CN",
      projectContext: {},
    }, { mode, attempt: session.attempt }).then((result) => {
      Object.assign(run, {
        uiStatus: result.uiStatus,
        issues: result.issues ?? [],
        retry: result.retry,
        uiError: result.uiError ?? null,
        artifact: result.artifact ?? null,
        stateRef: result.stateRef ? { ...result.stateRef, path: undefined } : null,
        metadata: result.metadata,
      });
    }).catch((error) => {
      Object.assign(run, {
        uiStatus: "FAILED",
        issues: [{
          type: "LOCAL_RUNTIME_FAILED",
          reason: "本地内容理解未能完成。",
          recommendedAction: "确认本地运行服务可用后重试。",
        }],
        retry: { retryable: session.attempt < 2, attempt: session.attempt, maxAttempts: 2, remainingAttempts: 2 - session.attempt },
        diagnostic: error instanceof Error ? error.message : String(error),
      });
    });

    return json(publicRun(run), 202);
  }

  async function readRun(runId) {
    const run = runs.get(runId);
    if (!run) return json({ error: "RUN_NOT_FOUND", message: "找不到这次内容理解运行。" }, 404);
    if (new Set(["PENDING", "RUNNING"]).has(run.uiStatus)) {
      try {
        const persisted = await service.runtime.stateManager.readRunStatus({ projectId: run.projectId, runId });
        if (new Set(["PENDING", "RUNNING"]).has(persisted.uiStatus)) run.uiStatus = persisted.uiStatus;
      } catch (error) {
        if (error?.code !== "ENOENT") run.diagnostic = error instanceof Error ? error.message : String(error);
      }
    }
    return json(publicRun(run));
  }
}

function publicRun(run) {
  return {
    runId: run.runId,
    sessionId: run.sessionId,
    projectId: run.projectId,
    attempt: run.attempt,
    uiStatus: run.uiStatus,
    issues: run.issues,
    retry: run.retry,
    uiError: run.uiError ?? null,
    artifact: run.artifact,
    stateRef: run.stateRef,
    metadata: run.metadata,
  };
}

function toWebRequest(incoming) {
  const origin = `http://${incoming.headers.host ?? "127.0.0.1"}`;
  const init = { method: incoming.method, headers: incoming.headers };
  if (!new Set(["GET", "HEAD"]).has(incoming.method)) {
    init.body = Readable.toWeb(incoming);
    init.duplex = "half";
  }
  return new Request(new URL(incoming.url, origin), init);
}

function safeUploadName(value, fallback) {
  const basename = path.basename(String(value || fallback)).normalize("NFKC");
  const safe = basename.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return safe || fallback;
}

function isFile(value) {
  return value && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.name === "string";
}

function toProjectRef(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function json(value, status = 200) {
  return new Response(`${JSON.stringify(value)}\n`, { status, headers: jsonHeaders });
}
