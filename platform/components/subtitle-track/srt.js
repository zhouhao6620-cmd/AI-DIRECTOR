import {highlightSegments} from "./layout.js";

// Adapter from a real subtitle timeline into the SubtitleTrack content tree.
//
// It consumes the segments produced by the platform's existing SRT reader
// (`platform/material/srt-parser.js` → `readFinalSrt` / `parseSrt`) so the project
// keeps exactly one SRT parsing rule. This module performs no file access, which
// keeps it safe to import from both the browser bundle and the Node test runner.
export function cuesFromSegments(segments, {translations = {}, idPrefix = "cue"} = {}) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error("字幕文件没有可用字幕条。");
  const lookup = (segment, index) => Array.isArray(translations)
    ? translations[index]
    : translations[segment.sourceSegmentId] ?? translations[String(segment.sourceCueId)] ?? undefined;
  return {
    cues: segments.map((segment, index) => {
      const text = String(segment.text ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
      const result = {id: `${idPrefix}-${String(index + 1).padStart(4, "0")}`, startMs: segment.startMs, endMs: segment.endMs, text};
      const translation = lookup(segment, index);
      if (typeof translation === "string" && translation.trim()) result.translation = translation.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
      return result;
    }),
  };
}

// Reports the emphasis spans the source `*keyword*` markup produced, so QA can
// assert that keyword styling comes from real content rather than a hardcoded look.
export function keywordSpansOf(text) {
  const {ranges, error} = highlightSegments(text);
  return {count: ranges.length, ranges, error};
}
