import { writeFile } from '@tauri-apps/plugin-fs';
import { documentDir, videoDir } from '@tauri-apps/api/path';
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
  type RecordingMode,
  type RecordingRegion,
  type AudioSource
} from '$lib/stores/recording';

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
      'video/mp4'
    ];

    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }

  /**
   * 开始录制
   */
  public async startRecording(
    mode: RecordingMode = 'fullscreen',
    region?: RecordingRegion
  ): Promise<void> {
    try {
      const settings = get(recordingSettings);
      
      // 获取视频流
      this.displayStream = await this.captureDisplay(mode, settings.frameRate);
      
      // 获取音频流
      if (settings.audioSource !== 'none') {
        this.audioStream = await this.captureAudio(settings.audioSource);
      }

      // 处理区域录制
      if (mode === 'region' && region) {
        await this.setupRegionCapture(region, settings.frameRate);
      } else {
        // 合并音视频流
        this.combinedStream = this.combineStreams();
      }

      // 设置 MediaRecorder
      const mimeType = this.getPreferredMimeType(settings.videoCodec);
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: settings.videoBitrate * 1000,
        audioBitsPerSecond: settings.audioBitrate * 1000
      };

      this.mediaRecorder = new MediaRecorder(
        this.combinedStream || this.displayStream,
        options
      );

      // 设置事件处理
      this.setupRecorderEvents();

      // 开始录制
      this.mediaRecorder.start(1000); // 每秒收集一次数据
      
      // 更新状态
      startRecordingStore(mode, region);
      
      // 开始更新时长
      this.startDurationTimer();
      
      console.log('录制已开始', { mode, region, mimeType });
    } catch (error) {
      console.error('开始录制失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`开始录制失败: ${errorMessage}`);
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
          const outputPath = await this.saveRecording();
          stopRecordingStore(outputPath);
          this.cleanup();
          resolve(outputPath);
        } catch (error) {
          console.error('保存录制失败:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setError(`保存录制失败: ${errorMessage}`);
          resolve(null);
        }
      };

      // 停止录制
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      this.stopDurationTimer();
      console.log('录制已停止');
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

    // 对于窗口和全屏模式，添加系统音频请求
    if (mode !== 'region') {
      constraints.audio = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } as MediaTrackConstraints;
    }

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
   * 设置区域捕获
   */
  private async setupRegionCapture(region: RecordingRegion, frameRate: number): Promise<void> {
    // 创建 canvas 和 video 元素
    this.canvas = document.createElement('canvas');
    this.canvas.width = region.width;
    this.canvas.height = region.height;
    this.canvasCtx = this.canvas.getContext('2d');

    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = this.displayStream;
    this.videoElement.play();

    // 等待视频加载
    await new Promise<void>((resolve) => {
      this.videoElement!.onloadedmetadata = () => resolve();
    });

    // 开始绘制循环
    const drawFrame = () => {
      if (this.canvasCtx && this.videoElement) {
        this.canvasCtx.drawImage(
          this.videoElement,
          region.x, region.y, region.width, region.height,
          0, 0, region.width, region.height
        );
      }
      this.animationFrameId = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    // 从 canvas 创建流
    const canvasStream = this.canvas.captureStream(frameRate);
    
    // 合并音频
    if (this.audioStream) {
      this.combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...this.audioStream.getAudioTracks()
      ]);
    } else {
      this.combinedStream = canvasStream;
    }
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
  private getPreferredMimeType(codec: 'vp8' | 'vp9'): string {
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
      console.error('录制器错误:', event.error);
      setError(`录制错误: ${event.error?.message || '未知错误'}`);
    };
  }

  /**
   * 保存录制
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
    const fileName = `ScreenRecording_${timestamp}.webm`;

    // 确定保存路径
    let saveDir = settings.saveDirectory;
    if (!saveDir) {
      saveDir = await videoDir();
    }
    const filePath = `${saveDir}/${fileName}`;

    // 转换为 ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 写入文件
    await writeFile(filePath, uint8Array);

    console.log('录制已保存到:', filePath);
    return filePath;
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
  }
}

// 导出单例
export const screenRecorder = new ScreenRecorder();
