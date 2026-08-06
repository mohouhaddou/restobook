import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hookSource = await readFile(new URL('../src/modules/play/hooks/useGameplayRecorder.js', import.meta.url), 'utf8');
const controlSource = await readFile(new URL('../src/modules/play/components/GameplayRecorderControl.jsx', import.meta.url), 'utf8');
const gamePlayerSource = await readFile(new URL('../src/modules/play/components/GamePlayer.jsx', import.meta.url), 'utf8');
const partnerFrameSource = await readFile(new URL('../src/modules/play/components/PartnerGameFrame.jsx', import.meta.url), 'utf8');
const toolbarSource = await readFile(new URL('../src/modules/play/components/GamePlayerToolbar.jsx', import.meta.url), 'utf8');

test('recorder hook caps capture at 60 seconds and cleans up streams, timers and object URLs', () => {
  assert.match(hookSource, /MAX_SECONDS\s*=\s*60/);
  assert.match(hookSource, /setTimeout\(stop,\s*MAX_SECONDS\s*\*\s*1000\)/);
  assert.match(hookSource, /getTracks\(\)\.forEach\(track\s*=>\s*track\.stop\(\)\)/);
  assert.match(hookSource, /URL\.revokeObjectURL/);
  assert.match(hookSource, /clearInterval/);
  assert.match(hookSource, /clearTimeout/);
});

test('recorder hook stops when the user ends screen sharing from the browser UI', () => {
  assert.match(hookSource, /addEventListener\('ended',\s*stop\)/);
});

test('recorder requests a real frame rate/resolution and a high bitrate to avoid mediocre, choppy captures', () => {
  assert.match(hookSource, /frameRate:\s*\{\s*ideal:\s*30,\s*max:\s*60\s*\}/);
  assert.match(hookSource, /width:\s*\{\s*ideal:\s*1920\s*\}/);
  assert.match(hookSource, /height:\s*\{\s*ideal:\s*1080\s*\}/);
  assert.match(hookSource, /videoBitsPerSecond:\s*VIDEO_BITS_PER_SECOND/);
  assert.match(hookSource, /VIDEO_BITS_PER_SECOND\s*=\s*8_000_000/);
  assert.match(hookSource, /recorder\.start\(TIMESLICE_MS\)/);
});

test('recorder prefers vp8 (lighter real-time encode) over vp9 to avoid dropped frames', () => {
  const vp8Index = hookSource.indexOf('vp8,opus');
  const vp9Index = hookSource.indexOf('vp9,opus');
  assert.ok(vp8Index > -1 && vp9Index > -1);
  assert.ok(vp8Index < vp9Index, 'vp8 must be listed before vp9 in MIME_CANDIDATES');
});

test('recorder tries hardware-friendly H.264-in-WebM before any software vpx codec', () => {
  const h264Index = hookSource.indexOf('h264');
  const vp8Index = hookSource.indexOf('vp8,opus');
  assert.ok(h264Index > -1 && h264Index < vp8Index, 'h264 must be listed before vp8/vp9 in MIME_CANDIDATES');
});

test('recorder hints the encoder for motion content and disables extra resampling', () => {
  assert.match(hookSource, /videoTrack\.contentHint\s*=\s*'motion'/);
  assert.match(hookSource, /resizeMode:\s*'none'/);
});

test('recorder hook lets the caller pick audio on/off and never calls the network', () => {
  assert.match(hookSource, /audio:\s*withAudio\s*\?/);
  assert.doesNotMatch(hookSource, /fetch\(/);
  assert.doesNotMatch(hookSource, /XMLHttpRequest/);
  assert.doesNotMatch(hookSource, /usePlayApi/);
});

test('no network transmission primitive exists anywhere in the recorder hook or UI — nothing can reach the server or disk there', () => {
  const NETWORK_PRIMITIVES = [/fetch\(/, /XMLHttpRequest/, /axios/, /sendBeacon/, /new WebSocket/, /usePlayApi/, /\bpost\(/, /\bput\(/, /\brequest\(/];
  for (const source of [hookSource, controlSource]) {
    for (const pattern of NETWORK_PRIMITIVES) assert.doesNotMatch(source, pattern);
  }
});

test('GamePlayer never wires the recorder Blob/video URL into its own session or report API calls', () => {
  assert.doesNotMatch(gamePlayerSource, /videoUrl/);
  assert.doesNotMatch(gamePlayerSource, /GameplayRecorderControl[^>]*videoUrl/);
});

test('feature detection hides the control on unsupported browsers and mobile', async () => {
  const { isGameplayRecordingSupported, isLikelyMobileDevice } = await import('../src/modules/play/hooks/useGameplayRecorder.js');
  const savedNavigator = globalThis.navigator;
  const savedWindow = globalThis.window;
  const savedMediaRecorder = globalThis.MediaRecorder;
  try {
    globalThis.navigator = { mediaDevices: { getDisplayMedia: () => {} }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' };
    globalThis.window = {};
    globalThis.window.MediaRecorder = function MediaRecorder() {};
    assert.equal(isGameplayRecordingSupported(), true);
    assert.equal(isLikelyMobileDevice(), false);

    globalThis.navigator = { mediaDevices: {}, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile' };
    assert.equal(isGameplayRecordingSupported(), false);
    assert.equal(isLikelyMobileDevice(), true);
  } finally {
    globalThis.navigator = savedNavigator;
    globalThis.window = savedWindow;
    globalThis.MediaRecorder = savedMediaRecorder;
  }
});

test('recorder control is superadmin-only, hides on unsupported/mobile, and gates partner games behind allowGameplayRecording', () => {
  assert.match(controlSource, /isSuperAdmin/);
  assert.match(controlSource, /if\s*\(!isSuperAdmin\s*\|\|\s*mobile\s*\|\|\s*!partnerAllowed\s*\|\|\s*!supported\)\s*return null/);
  assert.match(controlSource, /game\?\.source\s*===\s*'partner'/);
  assert.match(controlSource, /game\?\.config\?\.allowGameplayRecording\s*===\s*true/);
});

test('recorded clips download locally as WebM with the expected filename, no upload', () => {
  assert.match(controlSource, /ifilino-play-\$\{slug\}-\$\{stamp\}\.webm/);
  assert.match(controlSource, /a\.download\s*=\s*buildFileName/);
  assert.doesNotMatch(controlSource, /fetch\(/);
  assert.doesNotMatch(controlSource, /usePlayApi/);
});

test('recording UI exposes a red indicator, a countdown and a stop control, plus post-stop Download/Restart/Close', () => {
  assert.match(controlSource, /play-record-dot/);
  assert.match(controlSource, /formatCountdown\(secondsLeft\)/);
  assert.match(controlSource, /play-record-stop/);
  assert.match(controlSource, /play.shell.record.download/);
  assert.match(controlSource, /play.shell.record.restart/);
  assert.match(controlSource, /play.shell.record.close/);
});

test('GamePlayer wires the recorder into the shared toolbar without touching the partner iframe or the toolbar component', () => {
  assert.match(gamePlayerSource, /import GameplayRecorderControl from'\.\/GameplayRecorderControl'/);
  assert.match(gamePlayerSource, /<GameplayRecorderControl game=\{game\}\/>/);
  assert.doesNotMatch(partnerFrameSource, /GameplayRecorder/);
  assert.doesNotMatch(toolbarSource, /GameplayRecorder/);
});

test('partner iframe sandboxing is untouched', () => {
  assert.match(partnerFrameSource, /sandbox=\{descriptor\.sandbox\}/);
  assert.match(partnerFrameSource, /referrerPolicy=\{descriptor\.referrerPolicy\}/);
});

test('recorder translations exist in fr, ar and en with matching keys', async () => {
  const [fr, en, ar] = await Promise.all(['fr', 'en', 'ar'].map(async (lang) => {
    const raw = await readFile(new URL(`../src/i18n/locales/${lang}/play.json`, import.meta.url), 'utf8');
    return JSON.parse(raw);
  }));
  for (const key of ['play.shell.record.button', 'play.shell.record.withAudio', 'play.shell.record.withoutAudio', 'play.shell.record.stop', 'play.shell.record.download', 'play.shell.record.restart', 'play.shell.record.close', 'play.shell.record.audioUnavailable']) {
    assert.ok(fr[key], `fr missing ${key}`);
    assert.ok(en[key], `en missing ${key}`);
    assert.ok(ar[key], `ar missing ${key}`);
  }
});
