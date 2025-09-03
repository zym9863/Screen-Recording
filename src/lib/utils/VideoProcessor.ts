/**
 * 视频处理工具类
 * 用于处理视频的时间裁剪和空间裁剪
 */

export interface CropOptions {
  startTime: number;
  endTime: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  originalWidth: number;
  originalHeight: number;
}

export class VideoProcessor {
  /**
   * 裁剪视频（时间和空间）
   * @param videoBlob 原始视频Blob
   * @param options 裁剪选项
   * @returns 裁剪后的视频Blob
   */
  static async cropVideo(videoBlob: Blob, options: CropOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法获取Canvas上下文'));
        return;
      }

      // 设置画布尺寸为裁剪后的尺寸
      canvas.width = options.cropWidth;
      canvas.height = options.cropHeight;

      // 创建MediaRecorder用于录制裁剪后的视频
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const croppedBlob = new Blob(chunks, { type: 'video/webm' });
        resolve(croppedBlob);
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`录制失败: ${event}`));
      };

      // 视频加载完成后开始处理
      video.onloadedmetadata = () => {
        video.currentTime = options.startTime;
      };

      video.onseeked = () => {
        // 开始录制
        mediaRecorder.start();

        // 播放视频并录制
        video.play();

        // 监听播放进度
        const checkProgress = () => {
          if (video.currentTime >= options.endTime) {
            video.pause();
            mediaRecorder.stop();
            return;
          }

          // 绘制裁剪后的视频帧
          ctx.drawImage(
            video,
            options.cropX, options.cropY, options.cropWidth, options.cropHeight,
            0, 0, options.cropWidth, options.cropHeight
          );

          requestAnimationFrame(checkProgress);
        };

        checkProgress();
      };

      video.onerror = () => {
        reject(new Error('视频加载失败'));
      };

      // 设置视频源
      video.src = URL.createObjectURL(videoBlob);
      video.muted = true;
    });
  }

  /**
   * 仅进行时间裁剪（保持原始分辨率）
   * @param videoBlob 原始视频Blob
   * @param startTime 开始时间（秒）
   * @param endTime 结束时间（秒）
   * @returns 裁剪后的视频Blob
   */
  static async trimVideo(videoBlob: Blob, startTime: number, endTime: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法获取Canvas上下文'));
        return;
      }

      video.onloadedmetadata = () => {
        // 设置画布尺寸为视频原始尺寸
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 创建MediaRecorder
        const stream = canvas.captureStream(30);
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
        });

        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const trimmedBlob = new Blob(chunks, { type: 'video/webm' });
          resolve(trimmedBlob);
        };

        mediaRecorder.onerror = (event) => {
          reject(new Error(`录制失败: ${event}`));
        };

        // 跳转到开始时间
        video.currentTime = startTime;
        
        video.onseeked = () => {
          mediaRecorder.start();

          // 播放视频并录制
          video.play();

          // 监听播放进度
          const checkProgress = () => {
            if (video.currentTime >= endTime) {
              video.pause();
              mediaRecorder.stop();
              return;
            }

            // 绘制完整的视频帧
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            requestAnimationFrame(checkProgress);
          };

          checkProgress();
        };
      };

      video.onerror = () => {
        reject(new Error('视频加载失败'));
      };

      video.src = URL.createObjectURL(videoBlob);
      video.muted = true;
    });
  }

  /**
   * 获取视频信息
   * @param videoBlob 视频Blob
   * @returns 视频信息
   */
  static async getVideoInfo(videoBlob: Blob): Promise<{
    duration: number;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      };

      video.onerror = () => {
        reject(new Error('无法获取视频信息'));
      };

      video.src = URL.createObjectURL(videoBlob);
    });
  }

  /**
   * 创建视频缩略图
   * @param videoBlob 视频Blob
   * @param time 时间点（秒）
   * @returns 缩略图Blob
   */
  static async createThumbnail(videoBlob: Blob, time: number = 0): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法获取Canvas上下文'));
        return;
      }

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = time;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法创建缩略图'));
          }
        }, 'image/jpeg', 0.8);
      };

      video.onerror = () => {
        reject(new Error('视频加载失败'));
      };

      video.src = URL.createObjectURL(videoBlob);
      video.muted = true;
    });
  }

  /**
   * 检查浏览器是否支持视频处理
   * @returns 是否支持
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const stream = canvas.captureStream();
      return !!stream && typeof MediaRecorder !== 'undefined';
    } catch {
      return false;
    }
  }
}
