import { writeFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { documentDir, videoDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { get } from 'svelte/store';
import { 
  recordingSettings, 
  recordingState,
  startRecording as startRecordingStore,
  pauseRecording as pauseRecordingStore,
  resumeRecording as resumeRecordingStore,
  stopRecording as stopRecordingStore,
  setError,
  updateDuration,
  updateSettings,
  clearRecordedBlob,
  type RecordingMode,
  type RecordingRegion,
  type AudioSource
} from '$lib/stores/recording';

/** 统一错误码 */
export enum RecordingErrorCode {
  INIT_MEDIA = 'INIT_MEDIA',
  INIT_AUDIO = 'INIT_AUDIO',
  UNSUPPORTED_MIME = 'UNSUPPORTED_MIME',
  SAVE_FILE = 'SAVE_FILE',
  PROCESS_DATA = 'PROCESS_DATA',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  STATE_INVALID = 'STATE_INVALID'
}

/** 录制错误对象 */
export class RecordingError extends Error {
  code: RecordingErrorCode;
  causeRaw?: unknown;
  constructor(code: RecordingErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.name = 'RecordingError';
    this.causeRaw = cause;
  }
}

/** 简单日志工具 */
const log = {
  info: (...args: any[]) => console.log('[Recorder]', ...args),
  warn: (...args: any[]) => console.warn('[Recorder]', ...args),
  error: (...args: any[]) => console.error('[Recorder]', ...args)
};

/**
 * 屏幕录制核心类
 * 封装 Web Media API 实现录屏功能
 */
export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private displayStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private durationInterval: number | null = null;
  private memoryInterval: number | null = null; // 内存监控
  private enableMemoryWatch = false; // 可通过设置或调试开启

  constructor() {
    // 初始化
  }

  /**
   * 检查浏览器支持的编码格式
   */
  public getSupportedMimeTypes(): string[] {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=h264',
      'video/mp4'
    ];

    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }

  /**
   * 开始录制
   */
  public async startRecording(
    mode: RecordingMode = 'fullscreen'
  ): Promise<void> {
    try {
      const settings = get(recordingSettings);
      if (get(recordingState).status !== 'idle') {
        throw new RecordingError(RecordingErrorCode.STATE_INVALID, '当前状态不允许开始录制');
      }
      // 获取视频流
      try {
        this.displayStream = await this.captureDisplay(mode, settings.frameRate);
      } catch (e: any) {
        const msg = e?.name === 'NotAllowedError' ? '用户未授权屏幕共享' : '获取屏幕视频流失败';
        throw new RecordingError(
          e?.name === 'NotAllowedError' ? RecordingErrorCode.PERMISSION_DENIED : RecordingErrorCode.INIT_MEDIA,
          msg,
          e
        );
      }
      // 获取音频流
      if (settings.audioSource !== 'none') {
        try {
          this.audioStream = await this.captureAudio(settings.audioSource);
        } catch (e) {
          log.warn('音频流获取失败，将继续仅录制视频', e);
        }
      }
      // 合并流
      this.combinedStream = this.combineStreams();
      // MediaRecorder 初始化
      const mimeType = this.getPreferredMimeType(settings.videoCodec, settings.fileFormat);
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: settings.videoBitrate * 1000,
        audioBitsPerSecond: settings.audioBitrate * 1000
      };
      try {
        this.mediaRecorder = new MediaRecorder(
          this.combinedStream || this.displayStream!,
          options
        );
      } catch (e) {
        throw new RecordingError(RecordingErrorCode.UNSUPPORTED_MIME, '无法初始化录制器，可能是不支持的编码格式', e);
      }
      this.setupRecorderEvents();
      this.mediaRecorder.start(1000);
      startRecordingStore(mode);
      this.startDurationTimer();
      this.startMemoryWatch(); // 开始内存监控
      log.info('录制已开始', { mode, mimeType });
    } catch (error) {
      if (error instanceof RecordingError) {
        setError(`${error.message} (代码: ${error.code})`);
      } else {
        setError('开始录制失败，请重试');
      }
      log.error('开始录制失败:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 暂停录制
   */
  public pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      pauseRecordingStore();
      this.stopDurationTimer();
      console.log('录制已暂停');
    }
  }

  /**
   * 恢复录制
   */
  public resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      resumeRecordingStore();
      this.startDurationTimer();
      console.log('录制已恢复');
    }
  }

  /**
   * 停止录制
   */
  public async stopRecording(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      // 设置停止后的处理
      this.mediaRecorder.onstop = async () => {
        try {
          const settings = get(recordingSettings);
          
          // 创建录制数据 blob
          const blob = new Blob(this.recordedChunks, { 
            type: this.mediaRecorder?.mimeType || 'video/webm' 
          });
          
          // 生成文件名
          const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .slice(0, -5);
          
          let extension = 'webm';
          if (this.mediaRecorder?.mimeType.includes('mp4')) {
            extension = 'mp4';
          } else if (settings.fileFormat === 'mp4') {
            extension = 'webm';
          }
          
          const fileName = `ScreenRecording_${timestamp}.${extension}`;
          
          if (settings.autoDownload) {
            // 自动保存模式
            const outputPath = await this.saveRecordingFromBlob(blob, fileName);
            stopRecordingStore(outputPath);
            this.cleanup();
            resolve(outputPath);
          } else {
            // 手动下载模式：只保存 blob 到 store，不写入文件
            stopRecordingStore(undefined, blob, fileName);
            this.cleanup();
            resolve(null);
          }
        } catch (error) {
          log.error('处理录制数据失败:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setError(`处理录制失败: ${errorMessage}`);
          resolve(null);
        }
      };

      // 停止录制
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      this.stopDurationTimer();
      log.info('录制已停止');
    });
  }

  /**
   * 捕获显示内容
   */
  private async captureDisplay(mode: RecordingMode, frameRate: number): Promise<MediaStream> {
    const constraints: DisplayMediaStreamOptions = {
      video: {
        frameRate: { ideal: frameRate, max: frameRate },
        cursor: 'always'
      } as MediaTrackConstraints,
      audio: false // 系统音频单独处理
    };

    // 添加系统音频请求
    constraints.audio = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    } as MediaTrackConstraints;

    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    
    // 监听流结束事件
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log('用户停止了屏幕共享');
      this.stopRecording();
    });

    return stream;
  }

  /**
   * 捕获音频
   */
  private async captureAudio(source: AudioSource): Promise<MediaStream | null> {
    if (source === 'none') return null;

    try {
      if (source === 'microphone' || source === 'both') {
        // 获取麦克风
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2
          }
        });

        // 如果需要系统音频，尝试从 displayStream 获取
        if (source === 'both' && this.displayStream) {
          const systemAudioTracks = this.displayStream.getAudioTracks();
          if (systemAudioTracks.length > 0) {
            // 混合麦克风和系统音频
            return this.mixAudioStreams(micStream, this.displayStream);
          }
        }

        return micStream;
      }

      if (source === 'system' && this.displayStream) {
        // 仅系统音频
        const systemAudioTracks = this.displayStream.getAudioTracks();
        if (systemAudioTracks.length > 0) {
          const audioStream = new MediaStream(systemAudioTracks);
          return audioStream;
        } else {
          console.warn('系统音频不可用');
          setError('系统音频捕获失败，请在屏幕共享对话框中选择"共享系统音频"');
        }
      }
    } catch (error) {
      console.error('音频捕获失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`音频捕获失败: ${errorMessage}`);
    }

    return null;
  }

  /**
   * 混合音频流
   */
  private mixAudioStreams(stream1: MediaStream, stream2: MediaStream): MediaStream {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // 添加第一个音频源
    if (stream1.getAudioTracks().length > 0) {
      const source1 = audioContext.createMediaStreamSource(stream1);
      source1.connect(destination);
    }

    // 添加第二个音频源
    if (stream2.getAudioTracks().length > 0) {
      const source2 = audioContext.createMediaStreamSource(stream2);
      source2.connect(destination);
    }

    return destination.stream;
  }

  /**
   * 合并音视频流
   */
  private combineStreams(): MediaStream {
    const tracks: MediaStreamTrack[] = [];

    // 添加视频轨道
    if (this.displayStream) {
      tracks.push(...this.displayStream.getVideoTracks());
    }

    // 添加音频轨道
    if (this.audioStream) {
      tracks.push(...this.audioStream.getAudioTracks());
    }

    return new MediaStream(tracks);
  }

  /**
   * 获取首选的 MIME 类型
   */
  private getPreferredMimeType(codec: 'vp8' | 'vp9', format: 'webm' | 'mp4' = 'webm'): string {
    // 如果指定MP4格式，尝试MP4相关的MIME类型
    if (format === 'mp4') {
      const mp4Types = [
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4'
      ];
      
      for (const type of mp4Types) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
      
      // MP4不支持时回退到WebM
      console.warn('MP4格式不受支持，回退到WebM格式');
    }

    // WebM格式处理
    const preferred = codec === 'vp9' 
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm;codecs=vp8,opus';

    if (MediaRecorder.isTypeSupported(preferred)) {
      return preferred;
    }

    // 降级选项
    const fallbacks = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    for (const fallback of fallbacks) {
      if (MediaRecorder.isTypeSupported(fallback)) {
        return fallback;
      }
    }

    return 'video/webm'; // 最终降级
  }

  /**
   * 设置录制器事件
   */
  private setupRecorderEvents(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event: any) => {
      log.error('录制器错误:', event.error);
      setError(`录制错误: ${event.error?.message || '未知错误'}`);
    };
  }

  /**
   * 从 Blob 保存录制文件
   */
  private async saveRecordingFromBlob(blob: Blob, fileName: string): Promise<string> {
    const settings = get(recordingSettings);
    
    // 确定保存路径
    let saveDir = settings.saveDirectory;
    if (!saveDir) {
      saveDir = await videoDir();
    }
    const filePath = await join(saveDir, fileName);

    // 转换为 ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 写入文件（确保目录存在）
    let savedPath: string;
    try {
      // create dir if missing (recursive)
      try {
        const dirExists = await exists(saveDir);
        if (!dirExists) {
          await mkdir(saveDir, { recursive: true });
        }
      } catch (_) {
        // ignore mkdir errors here; write will still attempt and we may fall back
      }
      await writeFile(filePath, uint8Array);
      console.log('录制已保存到:', filePath);
      savedPath = filePath;
    } catch (e: any) {
      // 若权限/范围限制，回退到默认视频目录进行一次性保存，但不修改用户设置
      const errMsg = e?.message || String(e);
      if (/forbidden|scope|permission|denied|not\s*permitted/i.test(errMsg)) {
        const fallbackDir = await videoDir();
        const fallbackPath = await join(fallbackDir, fileName);
        try {
          const existsFallback = await exists(fallbackDir);
          if (!existsFallback) {
            await mkdir(fallbackDir, { recursive: true });
          }
        } catch (_) {}
        await writeFile(fallbackPath, uint8Array);
        console.warn('原保存目录不可用，本次已回退到默认视频目录:', fallbackDir);
        savedPath = fallbackPath;
      } else {
        throw e;
      }
    }

    // 如果需要转换为MP4格式
    if (settings.fileFormat === 'mp4' && fileName.endsWith('.webm')) {
      try {
        console.log('开始转换为MP4格式...');
        const { invoke } = await import('@tauri-apps/api/core');
        const mp4Path = savedPath.replace(/\.webm$/, '.mp4');
        
        // 调用Tauri后端进行格式转换
        await invoke('convert_to_mp4', { 
          inputPath: savedPath, 
          outputPath: mp4Path 
        });
        
        console.log('MP4转换完成:', mp4Path);
        return mp4Path;
      } catch (error) {
        console.error('MP4转换失败，保留WebM格式:', error);
        // 转换失败时返回原始WebM文件
        return savedPath;
      }
    }
    
    return savedPath;
  }

  /**
   * 保存录制（传统方式，已废弃，保留用于兼容）
   * @deprecated 使用 saveRecordingFromBlob 替代
   */
  private async saveRecording(): Promise<string> {
    const settings = get(recordingSettings);
    
    // 合并录制块
    const blob = new Blob(this.recordedChunks, { 
      type: this.mediaRecorder?.mimeType || 'video/webm' 
    });

    // 生成文件名
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5);
    
    // 根据MIME类型确定文件扩展名
    let extension = 'webm';
    if (this.mediaRecorder?.mimeType.includes('mp4')) {
      extension = 'mp4';
    } else if (settings.fileFormat === 'mp4') {
      // 如果设置为MP4但实际录制为WebM，需要后续转换
      extension = 'webm'; // 先保存为webm，后续转换为mp4
    }
    
    const fileName = `ScreenRecording_${timestamp}.${extension}`;

    // 确定保存路径
    let saveDir = settings.saveDirectory;
    if (!saveDir) {
      saveDir = await videoDir();
    }
    const filePath = await join(saveDir, fileName);

    // 转换为 ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 写入文件（确保目录存在）
    let savedPath: string;
    try {
      // create dir if missing (recursive)
      try {
        const dirExists = await exists(saveDir);
        if (!dirExists) {
          await mkdir(saveDir, { recursive: true });
        }
      } catch (_) {
        // ignore mkdir errors here; write will still attempt and we may fall back
      }
      await writeFile(filePath, uint8Array);
      console.log('录制已保存到:', filePath);
      savedPath = filePath;
    } catch (e: any) {
      // 若权限/范围限制，回退到默认视频目录进行一次性保存，但不修改用户设置
      const errMsg = e?.message || String(e);
      if (/forbidden|scope|permission|denied|not\s*permitted/i.test(errMsg)) {
        const fallbackDir = await videoDir();
        const fallbackPath = await join(fallbackDir, fileName);
        try {
          const existsFallback = await exists(fallbackDir);
          if (!existsFallback) {
            await mkdir(fallbackDir, { recursive: true });
          }
        } catch (_) {}
        await writeFile(fallbackPath, uint8Array);
        console.warn('原保存目录不可用，本次已回退到默认视频目录:', fallbackDir);
        savedPath = fallbackPath;
      } else {
        throw e;
      }
    }

    // 如果需要转换为MP4格式
    if (settings.fileFormat === 'mp4' && extension === 'webm') {
      try {
        console.log('开始转换为MP4格式...');
        const { invoke } = await import('@tauri-apps/api/core');
        const mp4Path = savedPath.replace(/\.webm$/, '.mp4');
        
        // 调用Tauri后端进行格式转换
        await invoke('convert_to_mp4', { 
          inputPath: savedPath, 
          outputPath: mp4Path 
        });
        
        console.log('MP4转换完成:', mp4Path);
        return mp4Path;
      } catch (error) {
        console.error('MP4转换失败，保留WebM格式:', error);
        // 转换失败时返回原始WebM文件
        return savedPath;
      }
    }
    
    return savedPath;
  }

  /**
   * 获取录制的 Blob 数据
   */
  public getRecordedBlob(): Blob | null {
    const state = get(recordingState);
    return state.recordedBlob;
  }

  /**
   * 手动下载录制文件
   */
  public async downloadRecording(): Promise<string | null> {
    const state = get(recordingState);
    if (!state.recordedBlob || !state.recordedFileName) {
      console.warn('没有可下载的录制数据');
      return null;
    }

    try {
      const outputPath = await this.saveRecordingFromBlob(state.recordedBlob, state.recordedFileName);
      
      // 清除存储的录制数据
      clearRecordedBlob();
      
      console.log('手动下载完成:', outputPath);
      return outputPath;
    } catch (error) {
      console.error('手动下载失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`下载失败: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 开始时长计时器
   */
  private startDurationTimer(): void {
    this.durationInterval = window.setInterval(() => {
      updateDuration();
    }, 1000);
  }

  /**
   * 停止时长计时器
   */
  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private startMemoryWatch() {
    if (!this.enableMemoryWatch || this.memoryInterval) return;
    // 仅在支持 performance.memory 的环境
    const anyPerf: any = performance as any;
    if (!anyPerf || !anyPerf.memory) return;
    this.memoryInterval = window.setInterval(() => {
      const used = Math.round(anyPerf.memory.usedJSHeapSize / 1024 / 1024);
      const total = Math.round(anyPerf.memory.totalJSHeapSize / 1024 / 1024);
      if (used / total > 0.85) {
        log.warn(`内存占用较高: ${used}MB / ${total}MB`);
      }
    }, 5000);
  }
  private stopMemoryWatch() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    // 停止所有流
    if (this.displayStream) {
      this.displayStream.getTracks().forEach(track => track.stop());
      this.displayStream = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop());
      this.combinedStream = null;
    }

    // 停止动画帧
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清理 DOM 元素
    if (this.canvas) {
      this.canvas = null;
      this.canvasCtx = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    // 清理录制器
    this.mediaRecorder = null;
    this.recordedChunks = [];

    // 停止计时器
    this.stopDurationTimer();
    this.stopMemoryWatch();
  }
}

// 导出单例
export const screenRecorder = new ScreenRecorder();
