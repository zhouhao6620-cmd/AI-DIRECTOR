import { MaterialPreparationError } from './material-error.js';

const timingPattern = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})(?:\s+.*)?$/;

export function parseSrt(source, { sourceRef = 'final.srt' } = {}) {
  const lines = String(source).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const segments = [];
  let index = 0;

  while (index < lines.length) {
    while (index < lines.length && lines[index].trim() === '') index += 1;
    if (index >= lines.length) break;

    const cueId = lines[index];
    index += 1;
    const timingLine = lines[index] ?? '';
    const timing = timingLine.match(timingPattern);
    if (!timing) throw srtParseError(segments.length + 1, `invalid timing line: ${timingLine}`);
    index += 1;

    const textLines = [];
    while (index < lines.length && lines[index].trim() !== '') {
      textLines.push(lines[index]);
      index += 1;
    }
    if (textLines.length === 0) throw srtParseError(segments.length + 1, 'subtitle text is empty');

    const startMs = toMilliseconds(timing.slice(1, 5));
    const endMs = toMilliseconds(timing.slice(5, 9));
    if (startMs >= endMs) throw srtParseError(segments.length + 1, 'start time must be before end time');
    if (segments.length > 0 && startMs < segments.at(-1).startMs) {
      throw srtParseError(segments.length + 1, 'cue start times must be in source order');
    }

    segments.push({
      sourceSegmentId: `srt-${String(segments.length + 1).padStart(4, '0')}`,
      sourceCueId: cueId,
      sourceRef,
      startMs,
      endMs,
      text: textLines.join('\n'),
    });
  }

  if (segments.length === 0) throw srtParseError(1, 'no subtitle cues were found');
  return segments;
}

function toMilliseconds(parts) {
  const [hours, minutes, seconds, milliseconds] = parts.map(Number);
  if (minutes > 59 || seconds > 59) throw srtParseError(1, 'timestamp minute/second is out of range');
  return (((hours * 60 + minutes) * 60) + seconds) * 1000 + milliseconds;
}

function srtParseError(cueNumber, detail) {
  return new MaterialPreparationError('FINAL_SRT_PARSE_FAILED', `Final SRT cue ${cueNumber} is invalid: ${detail}.`, {
    recommendedAction: 'Replace the file with the approved final SRT; this step does not edit subtitles.',
  });
}
