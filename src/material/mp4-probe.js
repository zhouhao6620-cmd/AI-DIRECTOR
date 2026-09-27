import { open, stat } from "node:fs/promises";
import { MaterialPreparationError } from "./material-error.js";

const maximumMoovBytes = 64 * 1024 * 1024;

export async function probeIsoBmff(filePath) {
  const fileStat = await stat(filePath);
  const handle = await open(filePath, "r");
  try {
    const topLevel = await readTopLevelBoxes(handle, fileStat.size);
    const ftyp = topLevel.find((box) => box.type === "ftyp");
    const moov = topLevel.find((box) => box.type === "moov");
    if (!ftyp || !moov) throw invalidVideo("Base video is missing required MP4/MOV structure.");
    if (moov.size > maximumMoovBytes) throw invalidVideo("Base video metadata is unexpectedly large.");

    const moovBuffer = Buffer.alloc(Number(moov.size));
    await handle.read(moovBuffer, 0, moovBuffer.length, Number(moov.offset));
    const moovRoot = { dataStart: moov.headerSize, end: moovBuffer.length };
    const movieHeader = findChild(moovBuffer, moovRoot, "mvhd");
    const movieTime = movieHeader ? readMediaTime(moovBuffer, movieHeader) : null;
    const tracks = children(moovBuffer, moovRoot).filter((box) => box.type === "trak");
    const videoTrack = tracks.map((track) => readVideoTrack(moovBuffer, track)).find(Boolean);
    if (!videoTrack) throw invalidVideo("Base video does not contain a readable video track.");

    const durationSeconds = videoTrack.durationSeconds ?? movieTime?.durationSeconds;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw invalidVideo("Base video duration could not be read.");
    }
    if (videoTrack.width <= 0 || videoTrack.height <= 0) {
      throw invalidVideo("Base video dimensions could not be read.");
    }
    return {
      width: videoTrack.width,
      height: videoTrack.height,
      encodedWidth: videoTrack.encodedWidth,
      encodedHeight: videoTrack.encodedHeight,
      rotationDegrees: videoTrack.rotationDegrees,
      durationMs: Math.round(durationSeconds * 1000),
      fps: videoTrack.fps,
      sampleCount: videoTrack.sampleCount,
    };
  } finally {
    await handle.close();
  }
}

async function readTopLevelBoxes(handle, fileSize) {
  const boxes = [];
  let offset = 0;
  while (offset + 8 <= fileSize) {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, 16, offset);
    if (bytesRead < 8) break;
    const size32 = header.readUInt32BE(0);
    const type = header.toString("ascii", 4, 8);
    const headerSize = size32 === 1 ? 16 : 8;
    const size = size32 === 0 ? fileSize - offset : size32 === 1 ? Number(header.readBigUInt64BE(8)) : size32;
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > fileSize) throw invalidVideo("Base video contains a corrupt MP4/MOV box.");
    boxes.push({ type, offset, size, headerSize });
    offset += size;
  }
  return boxes;
}

function readVideoTrack(buffer, track) {
  const mdia = findChild(buffer, track, "mdia");
  const handler = mdia && findChild(buffer, mdia, "hdlr");
  if (!handler || buffer.toString("ascii", handler.dataStart + 8, handler.dataStart + 12) !== "vide") return null;
  const trackHeader = findChild(buffer, track, "tkhd");
  const mediaHeader = findChild(buffer, mdia, "mdhd");
  if (!trackHeader || !mediaHeader) return null;

  const dimensions = readTrackDimensions(buffer, trackHeader);
  const mediaTime = readMediaTime(buffer, mediaHeader);
  const minf = findChild(buffer, mdia, "minf");
  const stbl = minf && findChild(buffer, minf, "stbl");
  const stts = stbl && findChild(buffer, stbl, "stts");
  const sampleTiming = stts ? readSampleTiming(buffer, stts, mediaTime.timescale) : { fps: null, sampleCount: null };
  return { ...dimensions, ...mediaTime, ...sampleTiming };
}

function readTrackDimensions(buffer, box) {
  const version = buffer.readUInt8(box.dataStart);
  const matrixOffset = box.dataStart + (version === 1 ? 52 : 40);
  const widthOffset = box.dataStart + (version === 1 ? 88 : 76);
  const encodedWidth = buffer.readUInt32BE(widthOffset) / 65536;
  const encodedHeight = buffer.readUInt32BE(widthOffset + 4) / 65536;
  const a = buffer.readInt32BE(matrixOffset) / 65536;
  const b = buffer.readInt32BE(matrixOffset + 4) / 65536;
  const c = buffer.readInt32BE(matrixOffset + 12) / 65536;
  const d = buffer.readInt32BE(matrixOffset + 16) / 65536;
  const quarterTurn = Math.abs(b) > 0.9 && Math.abs(c) > 0.9 && Math.abs(a) < 0.1 && Math.abs(d) < 0.1;
  const rotationDegrees = quarterTurn ? (b > 0 ? 90 : 270) : (a < -0.9 && d < -0.9 ? 180 : 0);
  return {
    encodedWidth: Math.round(encodedWidth),
    encodedHeight: Math.round(encodedHeight),
    width: Math.round(quarterTurn ? encodedHeight : encodedWidth),
    height: Math.round(quarterTurn ? encodedWidth : encodedHeight),
    rotationDegrees,
  };
}

function readMediaTime(buffer, box) {
  const version = buffer.readUInt8(box.dataStart);
  const timescaleOffset = box.dataStart + (version === 1 ? 20 : 12);
  const durationOffset = box.dataStart + (version === 1 ? 24 : 16);
  const timescale = buffer.readUInt32BE(timescaleOffset);
  const duration = version === 1 ? Number(buffer.readBigUInt64BE(durationOffset)) : buffer.readUInt32BE(durationOffset);
  return { timescale, durationSeconds: timescale > 0 ? duration / timescale : null };
}

function readSampleTiming(buffer, box, timescale) {
  const entryCount = buffer.readUInt32BE(box.dataStart + 4);
  let offset = box.dataStart + 8;
  let sampleCount = 0;
  let mediaDuration = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 8 > box.end) throw invalidVideo("Base video sample timing metadata is truncated.");
    const count = buffer.readUInt32BE(offset);
    const delta = buffer.readUInt32BE(offset + 4);
    sampleCount += count;
    mediaDuration += count * delta;
    offset += 8;
  }
  const fps = timescale > 0 && mediaDuration > 0 ? sampleCount * timescale / mediaDuration : null;
  return { fps: Number.isFinite(fps) ? Number(fps.toFixed(3)) : null, sampleCount };
}

function children(buffer, parent) {
  const boxes = [];
  let offset = parent.dataStart;
  while (offset + 8 <= parent.end) {
    const size32 = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const headerSize = size32 === 1 ? 16 : 8;
    const size = size32 === 0 ? parent.end - offset : size32 === 1 ? Number(buffer.readBigUInt64BE(offset + 8)) : size32;
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > parent.end) break;
    boxes.push({ type, offset, size, headerSize, dataStart: offset + headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function findChild(buffer, parent, type) {
  return children(buffer, parent).find((box) => box.type === type) ?? null;
}

function invalidVideo(message) {
  return new MaterialPreparationError("BASE_VIDEO_NOT_USABLE", message, {
    recommendedAction: "Replace the base video with a readable MP4, MOV, or M4V file.",
  });
}

