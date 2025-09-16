import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screenRecorder, RecordingErrorCode } from './ScreenRecorder';
import { recordingState, startRecording, stopRecording as stopStore, setError } from '$lib/stores/recording';
import { get } from 'svelte/store';

// 简单的媒体模拟
class FakeMediaStreamTrack {
  stopped = false;
  stop() { this.stopped = true; }
  addEventListener() {}
}
class FakeMediaStream {
  private video = [new FakeMediaStreamTrack()];
  private audio: FakeMediaStreamTrack[] = [];
  constructor(withAudio = false) { if (withAudio) this.audio.push(new FakeMediaStreamTrack()); }
  getVideoTracks() { return this.video as any; }
  getAudioTracks() { return this.audio as any; }
  getTracks() { return [...this.video, ...this.audio] as any; }
}

// jsdom 下简单 polyfill
(globalThis as any).navigator = {
  mediaDevices: {
    getDisplayMedia: async () => new FakeMediaStream(true),
    getUserMedia: async () => new FakeMediaStream(true)
  }
};

// MediaRecorder 简易 mock
class FakeMediaRecorder {
  static isTypeSupported() { return true; }
  state: string = 'inactive';
  mimeType: string = 'video/webm;codecs=vp9,opus';
  ondataavailable: any;
  onstop: any;
  onerror: any;
  private interval: any;
  constructor(public stream: any, public options: any) {
    if (options?.mimeType) {
      this.mimeType = options.mimeType;
    }
  }
  start() {
    this.state = 'recording';
    this.interval = setInterval(() => {
      // 创建一个有 arrayBuffer 方法的 mock blob
      const mockBlob = {
        arrayBuffer: async () => new ArrayBuffer(8),
        size: 8,
        type: 'video/webm'
      };
      this.ondataavailable && this.ondataavailable({ data: mockBlob });
    }, 10);
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    clearInterval(this.interval);
    this.state = 'inactive';
    this.onstop && this.onstop();
  }
}
(globalThis as any).MediaRecorder = FakeMediaRecorder as any;
(globalThis as any).MediaStream = FakeMediaStream as any;

// URL mock
(globalThis as any).URL = { createObjectURL: () => 'blob://test' };

// 文件系统 API mock
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(async () => {}),
  exists: vi.fn(async () => true),
  mkdir: vi.fn(async () => {})
}));
vi.mock('@tauri-apps/api/path', () => ({
  videoDir: async () => 'C:/Videos',
  join: async (...parts: string[]) => parts.join('/'),
  documentDir: async () => 'C:/Docs'
}));

// core invoke mock
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => {}),
  convertFileSrc: (p: string) => p
}));

describe('ScreenRecorder 基础', () => {
  beforeEach(() => {
    // 重置状态
    stopStore();
    setError(null);

    // Mock saveRecordingFromBlob 方法来避免文件操作
    vi.spyOn(screenRecorder as any, 'saveRecordingFromBlob').mockResolvedValue('test-path.webm');
  });

  it('可以启动与停止录制', async () => {
    await screenRecorder.startRecording('fullscreen');
    const state1 = get(recordingState);
    expect(state1.status).toBe('recording');
    await screenRecorder.stopRecording();
    const state2 = get(recordingState);
    expect(state2.status).toBe('idle');
  });

  it('重复 start 时抛出状态错误', async () => {
    await screenRecorder.startRecording('fullscreen');
    await expect(screenRecorder.startRecording('fullscreen')).rejects.toThrow();
  });
});
