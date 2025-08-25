import { writable, derived } from 'svelte/store';
import { Store } from '@tauri-apps/plugin-store';

/**
 * 录制状态类型
 */
export type RecordingStatus = 'idle' | 'recording' | 'paused';

/**
 * 录制模式类型
 */
export type RecordingMode = 'fullscreen' | 'window' | 'region';

/**
 * 音频输入源类型
 */
export type AudioSource = 'none' | 'microphone' | 'system' | 'both';

/**
 * 视频质量预设
 */
export type VideoQuality = 'low' | 'medium' | 'high' | 'custom';

/**
 * 录制设置接口
 */
export interface RecordingSettings {
  mode: RecordingMode;
  audioSource: AudioSource;
  videoQuality: VideoQuality;
  frameRate: number;
  videoBitrate: number; // kbps
  audioBitrate: number; // kbps
  videoCodec: 'vp8' | 'vp9';
  saveDirectory: string;
  fileFormat: 'webm' | 'mp4';
  minimizeToTray: boolean;
  afterRecording: 'nothing' | 'openFile' | 'openFolder';
  shortcuts: {
    toggleRecording: string;
    togglePause: string;
  };
}

/**
 * 录制区域接口
 */
export interface RecordingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 录制状态接口
 */
export interface RecordingState {
  status: RecordingStatus;
  duration: number; // 秒
  startTime: number | null;
  pausedTime: number;
  mode: RecordingMode;
  region: RecordingRegion | null;
  lastOutputPath: string | null;
  error: string | null;
  isMinimized: boolean;
}

// 默认设置
const defaultSettings: RecordingSettings = {
  mode: 'fullscreen',
  audioSource: 'microphone',
  videoQuality: 'medium',
  frameRate: 30,
  videoBitrate: 5000,
  audioBitrate: 128,
  videoCodec: 'vp9',
  saveDirectory: '',
  fileFormat: 'webm',
  minimizeToTray: true,
  afterRecording: 'openFolder',
  shortcuts: {
    toggleRecording: 'Ctrl+Alt+R',
    togglePause: 'Ctrl+Alt+P'
  }
};

// 默认状态
const defaultState: RecordingState = {
  status: 'idle',
  duration: 0,
  startTime: null,
  pausedTime: 0,
  mode: 'fullscreen',
  region: null,
  lastOutputPath: null,
  error: null,
  isMinimized: false
};

// 创建 Stores
export const recordingState = writable<RecordingState>(defaultState);
export const recordingSettings = writable<RecordingSettings>(defaultSettings);

// 派生状态
export const isRecording = derived(
  recordingState,
  $state => $state.status === 'recording'
);

export const isPaused = derived(
  recordingState,
  $state => $state.status === 'paused'
);

export const isIdle = derived(
  recordingState,
  $state => $state.status === 'idle'
);

export const canRecord = derived(
  recordingState,
  $state => $state.status === 'idle'
);

export const canPause = derived(
  recordingState,
  $state => $state.status === 'recording'
);

export const canResume = derived(
  recordingState,
  $state => $state.status === 'paused'
);

export const canStop = derived(
  recordingState,
  $state => $state.status !== 'idle'
);

// Tauri Store 持久化
let tauriStore: Store | null = null;

/**
 * 初始化持久化存储
 */
export async function initializeStore() {
  try {
    tauriStore = await Store.load('settings.json');
    
    // 加载保存的设置
    const savedSettings = await tauriStore.get('recording_settings');
    if (savedSettings) {
      recordingSettings.set({ ...defaultSettings, ...savedSettings });
    }
    
    // 订阅设置变化，自动保存
    recordingSettings.subscribe(async (settings) => {
      if (tauriStore) {
        await tauriStore.set('recording_settings', settings);
        await tauriStore.save();
      }
    });
  } catch (error) {
    console.error('初始化存储失败:', error);
  }
}

/**
 * 开始录制
 */
export function startRecording(mode: RecordingMode = 'fullscreen', region?: RecordingRegion) {
  recordingState.update(state => ({
    ...state,
    status: 'recording',
    startTime: Date.now(),
    mode,
    region: region || null,
    error: null
  }));
}

/**
 * 暂停录制
 */
export function pauseRecording() {
  recordingState.update(state => {
    if (state.status === 'recording') {
      return {
        ...state,
        status: 'paused',
        pausedTime: state.pausedTime + (Date.now() - (state.startTime || 0))
      };
    }
    return state;
  });
}

/**
 * 恢复录制
 */
export function resumeRecording() {
  recordingState.update(state => {
    if (state.status === 'paused') {
      return {
        ...state,
        status: 'recording',
        startTime: Date.now()
      };
    }
    return state;
  });
}

/**
 * 停止录制
 */
export function stopRecording(outputPath?: string) {
  recordingState.update(state => ({
    ...defaultState,
    lastOutputPath: outputPath || state.lastOutputPath
  }));
}

/**
 * 更新录制时长
 */
export function updateDuration() {
  recordingState.update(state => {
    if (state.status === 'recording' && state.startTime) {
      return {
        ...state,
        duration: Math.floor((Date.now() - state.startTime + state.pausedTime) / 1000)
      };
    }
    return state;
  });
}

/**
 * 设置错误
 */
export function setError(error: string | null) {
  recordingState.update(state => ({
    ...state,
    error
  }));
}

/**
 * 重置状态
 */
export function resetState() {
  recordingState.set(defaultState);
}

/**
 * 更新设置
 */
export function updateSettings(settings: Partial<RecordingSettings>) {
  recordingSettings.update(current => ({
    ...current,
    ...settings
  }));
}

/**
 * 格式化时长为 HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (hours > 0) {
    parts.push(hours.toString().padStart(2, '0'));
  }
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  
  return parts.join(':');
}

/**
 * 获取视频质量设置
 */
export function getQualitySettings(quality: VideoQuality): { bitrate: number; frameRate: number } {
  switch (quality) {
    case 'low':
      return { bitrate: 2000, frameRate: 15 };
    case 'medium':
      return { bitrate: 5000, frameRate: 30 };
    case 'high':
      return { bitrate: 10000, frameRate: 60 };
    default:
      return { bitrate: 5000, frameRate: 30 };
  }
}
