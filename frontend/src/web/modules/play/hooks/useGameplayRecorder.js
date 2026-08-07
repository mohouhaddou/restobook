import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 60;
const TIMESLICE_MS = 1000;
const VIDEO_BITS_PER_SECOND = 8_000_000;
const AUDIO_BITS_PER_SECOND = 128_000;
// H.264-in-WebM first: on Chrome/Edge this path can use the machine's hardware
// video encoder (Intel Quick Sync / NVENC / etc.) instead of software vpx, so
// it doesn't compete with the game for the same CPU cores — the single
// biggest lever against dropped/stuttering frames. vp8 (lighter software
// encode than vp9) is the fallback, vp9 last since it's the heaviest to
// encode in real time.
const MIME_CANDIDATES = ['video/webm;codecs=h264,opus', 'video/webm;codecs=h264', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return 'video/webm';
  return MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
}

export function isGameplayRecordingSupported() {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function'
    && typeof window !== 'undefined'
    && typeof window.MediaRecorder === 'function';
}

export function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

/**
 * Local-only screen recording for superadmin QA: captures the current tab via
 * getDisplayMedia/MediaRecorder and hands back a Blob URL. Nothing is ever
 * uploaded — callers are responsible for triggering the download.
 */
export default function useGameplayRecorder() {
  const [status, setStatus] = useState('idle'); // idle | requesting | recording | preview | error
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [errorCode, setErrorCode] = useState('');
  const [audioWarning, setAudioWarning] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const videoUrlRef = useRef('');

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const revokeUrl = useCallback(() => {
    if (videoUrlRef.current) { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = ''; }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    releaseStream();
    revokeUrl();
    recorderRef.current = null;
    chunksRef.current = [];
    setVideoUrl('');
    setSecondsLeft(MAX_SECONDS);
    setAudioWarning(false);
    setErrorCode('');
    setStatus('idle');
  }, [clearTimers, releaseStream, revokeUrl]);

  useEffect(() => () => reset(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, [clearTimers]);

  const start = useCallback(async (withAudio) => {
    if (!isGameplayRecordingSupported()) { setErrorCode('unsupported'); setStatus('error'); return; }
    setErrorCode('');
    setAudioWarning(false);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: { ideal: 30, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 }, resizeMode: 'none' },
        audio: withAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
        preferCurrentTab: true,
        surfaceSwitching: 'exclude',
        selfBrowserSurface: 'include',
      });
      streamRef.current = stream;
      chunksRef.current = [];
      // Hints the encoder to favor temporal smoothness over per-frame sharpness,
      // which matches fast-moving game footage better than the 'detail' default.
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && 'contentHint' in videoTrack) videoTrack.contentHint = 'motion';
      if (withAudio && stream.getAudioTracks().length === 0) setAudioWarning(true);
      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: VIDEO_BITS_PER_SECOND, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        clearTimers();
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        releaseStream();
        const url = URL.createObjectURL(blob);
        videoUrlRef.current = url;
        setVideoUrl(url);
        setStatus('preview');
      };
      videoTrack?.addEventListener('ended', stop);
      recorder.start(TIMESLICE_MS);
      setStatus('recording');
      setSecondsLeft(MAX_SECONDS);
      intervalRef.current = setInterval(() => {
        setSecondsLeft((value) => (value <= 1 ? 0 : value - 1));
      }, 1000);
      timeoutRef.current = setTimeout(stop, MAX_SECONDS * 1000);
    } catch (error) {
      releaseStream();
      clearTimers();
      setStatus('error');
      setErrorCode(error?.name === 'NotAllowedError' ? 'denied' : 'failed');
    }
  }, [clearTimers, releaseStream, stop]);

  return { status, secondsLeft, errorCode, audioWarning, videoUrl, start, stop, restart: reset, close: reset };
}
