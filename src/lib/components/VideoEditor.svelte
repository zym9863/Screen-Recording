<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { VideoProcessor, type CropOptions } from '$lib/utils/VideoProcessor';
  import { t, translate } from '$lib/i18n';
  
  export let videoBlob: Blob;
  export let isLoading = false;
  
  const dispatch = createEventDispatcher();
  
  // 视频元素和画布引用
  let videoElement: HTMLVideoElement;
  let canvasElement: HTMLCanvasElement;
  let previewCanvas: HTMLCanvasElement;
  
  // 视频信息
  let videoDuration = 0;
  let videoWidth = 0;
  let videoHeight = 0;
  let videoUrl = '';
  
  // 时间裁剪状态
  let startTime = 0;
  let endTime = 0;
  let currentTime = 0;
  let isPlaying = false;
  
  // 空间裁剪状态
  let cropX = 0;
  let cropY = 0;
  let cropWidth = 0;
  let cropHeight = 0;
  let isDragging = false;
  let isResizing = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let resizeHandle = '';
  
  // 预览模式
  let previewMode: 'original' | 'cropped' = 'original';

  // 处理状态
  let processingStatus = '';
  let processingProgress = 0;
  
  /**
   * 初始化视频
   */
  function initializeVideo() {
    if (videoBlob) {
      videoUrl = URL.createObjectURL(videoBlob);
    }
  }
  
  /**
   * 视频加载完成处理
   */
  function handleVideoLoaded() {
    if (videoElement) {
      videoDuration = videoElement.duration;
      videoWidth = videoElement.videoWidth;
      videoHeight = videoElement.videoHeight;
      
      // 初始化时间裁剪范围
      startTime = 0;
      endTime = videoDuration;
      
      // 初始化空间裁剪范围（全屏）
      cropX = 0;
      cropY = 0;
      cropWidth = videoWidth;
      cropHeight = videoHeight;
      
      // 设置画布尺寸
      if (canvasElement) {
        canvasElement.width = videoWidth;
        canvasElement.height = videoHeight;
      }
      
      updatePreview();
    }
  }
  
  /**
   * 播放/暂停切换
   */
  function togglePlayback() {
    if (!videoElement) return;
    
    if (isPlaying) {
      videoElement.pause();
    } else {
      // 确保在裁剪范围内播放
      if (currentTime < startTime || currentTime > endTime) {
        videoElement.currentTime = startTime;
      }
      videoElement.play();
    }
    isPlaying = !isPlaying;
  }
  
  /**
   * 时间更新处理
   */
  function handleTimeUpdate() {
    if (!videoElement) return;
    
    currentTime = videoElement.currentTime;
    
    // 如果超出裁剪范围，暂停播放
    if (currentTime > endTime) {
      videoElement.pause();
      videoElement.currentTime = endTime;
      isPlaying = false;
    }
  }
  
  /**
   * 跳转到指定时间
   */
  function seekTo(time: number) {
    if (videoElement) {
      videoElement.currentTime = Math.max(startTime, Math.min(endTime, time));
    }
  }
  
  /**
   * 更新开始时间
   */
  function updateStartTime(time: number) {
    startTime = Math.max(0, Math.min(time, endTime - 0.1));
    if (currentTime < startTime) {
      seekTo(startTime);
    }
  }
  
  /**
   * 更新结束时间
   */
  function updateEndTime(time: number) {
    endTime = Math.min(videoDuration, Math.max(time, startTime + 0.1));
    if (currentTime > endTime) {
      seekTo(endTime);
    }
  }
  
  /**
   * 格式化时间显示
   */
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * 更新预览
   */
  function updatePreview() {
    if (!videoElement || !previewCanvas) return;
    
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    
    // 设置预览画布尺寸
    const maxWidth = 400;
    const maxHeight = 300;
    const aspectRatio = videoWidth / videoHeight;
    
    let previewWidth = maxWidth;
    let previewHeight = maxWidth / aspectRatio;
    
    if (previewHeight > maxHeight) {
      previewHeight = maxHeight;
      previewWidth = maxHeight * aspectRatio;
    }
    
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;
    
    // 绘制视频帧
    if (previewMode === 'original') {
      ctx.drawImage(videoElement, 0, 0, previewWidth, previewHeight);
    } else {
      // 绘制裁剪后的视频
      ctx.drawImage(
        videoElement,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, previewWidth, previewHeight
      );
    }
    
    // 如果是原始模式，绘制裁剪框
    if (previewMode === 'original') {
      drawCropOverlay(ctx, previewWidth, previewHeight);
    }
  }
  
  /**
   * 绘制裁剪框覆盖层
   */
  function drawCropOverlay(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    const scaleX = canvasWidth / videoWidth;
    const scaleY = canvasHeight / videoHeight;
    
    const scaledCropX = cropX * scaleX;
    const scaledCropY = cropY * scaleY;
    const scaledCropWidth = cropWidth * scaleX;
    const scaledCropHeight = cropHeight * scaleY;
    
    // 绘制半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 清除裁剪区域
    ctx.clearRect(scaledCropX, scaledCropY, scaledCropWidth, scaledCropHeight);
    
    // 重新绘制裁剪区域的视频
    ctx.drawImage(
      videoElement,
      cropX, cropY, cropWidth, cropHeight,
      scaledCropX, scaledCropY, scaledCropWidth, scaledCropHeight
    );
    
    // 绘制裁剪框边框
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(scaledCropX, scaledCropY, scaledCropWidth, scaledCropHeight);
    
    // 绘制调整手柄
    drawResizeHandles(ctx, scaledCropX, scaledCropY, scaledCropWidth, scaledCropHeight);
  }
  
  /**
   * 绘制调整手柄
   */
  function drawResizeHandles(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
    const handleSize = 8;
    ctx.fillStyle = '#3b82f6';

    // 四个角的手柄
    ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);

    // 边中点的手柄
    ctx.fillRect(x + width/2 - handleSize/2, y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width/2 - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
  }

  /**
   * 处理画布鼠标按下事件
   */
  function handleCanvasMouseDown(event: MouseEvent) {
    if (previewMode !== 'original' || !previewCanvas) return;

    const rect = previewCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const scaleX = videoWidth / previewCanvas.width;
    const scaleY = videoHeight / previewCanvas.height;

    const scaledCropX = cropX / scaleX;
    const scaledCropY = cropY / scaleY;
    const scaledCropWidth = cropWidth / scaleX;
    const scaledCropHeight = cropHeight / scaleY;

    // 检查是否点击了调整手柄
    const handleSize = 8;
    const handles = [
      { name: 'nw', x: scaledCropX - handleSize/2, y: scaledCropY - handleSize/2 },
      { name: 'ne', x: scaledCropX + scaledCropWidth - handleSize/2, y: scaledCropY - handleSize/2 },
      { name: 'sw', x: scaledCropX - handleSize/2, y: scaledCropY + scaledCropHeight - handleSize/2 },
      { name: 'se', x: scaledCropX + scaledCropWidth - handleSize/2, y: scaledCropY + scaledCropHeight - handleSize/2 },
      { name: 'n', x: scaledCropX + scaledCropWidth/2 - handleSize/2, y: scaledCropY - handleSize/2 },
      { name: 's', x: scaledCropX + scaledCropWidth/2 - handleSize/2, y: scaledCropY + scaledCropHeight - handleSize/2 },
      { name: 'w', x: scaledCropX - handleSize/2, y: scaledCropY + scaledCropHeight/2 - handleSize/2 },
      { name: 'e', x: scaledCropX + scaledCropWidth - handleSize/2, y: scaledCropY + scaledCropHeight/2 - handleSize/2 }
    ];

    for (const handle of handles) {
      if (x >= handle.x && x <= handle.x + handleSize && y >= handle.y && y <= handle.y + handleSize) {
        isResizing = true;
        resizeHandle = handle.name;
        dragStartX = x;
        dragStartY = y;
        return;
      }
    }

    // 检查是否点击了裁剪区域内部（用于拖拽）
    if (x >= scaledCropX && x <= scaledCropX + scaledCropWidth &&
        y >= scaledCropY && y <= scaledCropY + scaledCropHeight) {
      isDragging = true;
      dragStartX = x - scaledCropX;
      dragStartY = y - scaledCropY;
    }
  }

  /**
   * 处理画布鼠标移动事件
   */
  function handleCanvasMouseMove(event: MouseEvent) {
    if ((!isDragging && !isResizing) || !previewCanvas) return;

    const rect = previewCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const scaleX = videoWidth / previewCanvas.width;
    const scaleY = videoHeight / previewCanvas.height;

    if (isDragging) {
      // 拖拽裁剪区域
      const newCropX = Math.max(0, Math.min((x - dragStartX) * scaleX, videoWidth - cropWidth));
      const newCropY = Math.max(0, Math.min((y - dragStartY) * scaleY, videoHeight - cropHeight));

      cropX = newCropX;
      cropY = newCropY;
    } else if (isResizing) {
      // 调整裁剪区域大小
      const deltaX = (x - dragStartX) * scaleX;
      const deltaY = (y - dragStartY) * scaleY;

      let newCropX = cropX;
      let newCropY = cropY;
      let newCropWidth = cropWidth;
      let newCropHeight = cropHeight;

      switch (resizeHandle) {
        case 'nw':
          newCropX = Math.max(0, cropX + deltaX);
          newCropY = Math.max(0, cropY + deltaY);
          newCropWidth = cropWidth - (newCropX - cropX);
          newCropHeight = cropHeight - (newCropY - cropY);
          break;
        case 'ne':
          newCropY = Math.max(0, cropY + deltaY);
          newCropWidth = Math.min(videoWidth - cropX, cropWidth + deltaX);
          newCropHeight = cropHeight - (newCropY - cropY);
          break;
        case 'sw':
          newCropX = Math.max(0, cropX + deltaX);
          newCropWidth = cropWidth - (newCropX - cropX);
          newCropHeight = Math.min(videoHeight - cropY, cropHeight + deltaY);
          break;
        case 'se':
          newCropWidth = Math.min(videoWidth - cropX, cropWidth + deltaX);
          newCropHeight = Math.min(videoHeight - cropY, cropHeight + deltaY);
          break;
        case 'n':
          newCropY = Math.max(0, cropY + deltaY);
          newCropHeight = cropHeight - (newCropY - cropY);
          break;
        case 's':
          newCropHeight = Math.min(videoHeight - cropY, cropHeight + deltaY);
          break;
        case 'w':
          newCropX = Math.max(0, cropX + deltaX);
          newCropWidth = cropWidth - (newCropX - cropX);
          break;
        case 'e':
          newCropWidth = Math.min(videoWidth - cropX, cropWidth + deltaX);
          break;
      }

      // 确保最小尺寸
      if (newCropWidth >= 50 && newCropHeight >= 50) {
        cropX = newCropX;
        cropY = newCropY;
        cropWidth = newCropWidth;
        cropHeight = newCropHeight;
      }

      dragStartX = x;
      dragStartY = y;
    }
  }

  /**
   * 处理画布鼠标释放事件
   */
  function handleCanvasMouseUp() {
    isDragging = false;
    isResizing = false;
    resizeHandle = '';
  }
  
  /**
   * 保存裁剪后的视频
   */
  async function saveVideo() {
    try {
      isLoading = true;
      processingStatus = translate('editor.processing.analyzing');
      processingProgress = 10;

      // 检查是否需要裁剪
      const needsTimeCrop = startTime > 0 || endTime < videoDuration;
      const needsSpaceCrop = cropX > 0 || cropY > 0 ||
                            cropWidth < videoWidth || cropHeight < videoHeight;

      let processedBlob = videoBlob;

      if (needsTimeCrop || needsSpaceCrop) {
        processingStatus = translate('editor.processing.processing');
        processingProgress = 30;

        // 需要裁剪处理
        const cropOptions: CropOptions = {
          startTime,
          endTime,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          originalWidth: videoWidth,
          originalHeight: videoHeight
        };

        if (needsTimeCrop && needsSpaceCrop) {
          // 时间和空间都需要裁剪
          processingStatus = translate('editor.processing.cropping');
          processingProgress = 50;
          processedBlob = await VideoProcessor.cropVideo(videoBlob, cropOptions);
        } else if (needsTimeCrop) {
          // 仅时间裁剪
          processingStatus = translate('editor.processing.trimming');
          processingProgress = 50;
          processedBlob = await VideoProcessor.trimVideo(videoBlob, startTime, endTime);
        } else {
          // 仅空间裁剪
          processingStatus = translate('editor.processing.cropping');
          processingProgress = 50;
          processedBlob = await VideoProcessor.cropVideo(videoBlob, cropOptions);
        }
      }

      processingStatus = translate('editor.processing.saving');
      processingProgress = 80;

      dispatch('save', {
        processedBlob,
        originalBlob: videoBlob,
        cropOptions: {
          startTime,
          endTime,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          originalWidth: videoWidth,
          originalHeight: videoHeight
        }
      });

      processingProgress = 100;
    } catch (error) {
      console.error(translate('editor.processing.failed'), error);
      processingStatus = translate('editor.processing.failed');
      dispatch('error', {
        message: error instanceof Error ? error.message : '视频处理失败'
      });
    } finally {
      setTimeout(() => {
        isLoading = false;
        processingStatus = '';
        processingProgress = 0;
      }, 500);
    }
  }
  
  /**
   * 取消编辑
   */
  function cancelEdit() {
    dispatch('cancel');
  }

  /**
   * 处理键盘快捷键
   */
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === ' ') {
      // 空格键播放/暂停
      event.preventDefault();
      togglePlayback();
    } else if (event.key === 'Escape') {
      // ESC键取消编辑
      event.preventDefault();
      cancelEdit();
    } else if (event.ctrlKey && event.key === 's') {
      // Ctrl+S保存
      event.preventDefault();
      if (!isLoading) {
        saveVideo();
      }
    } else if (event.key === 'ArrowLeft') {
      // 左箭头后退5秒
      event.preventDefault();
      seekTo(Math.max(startTime, currentTime - 5));
    } else if (event.key === 'ArrowRight') {
      // 右箭头前进5秒
      event.preventDefault();
      seekTo(Math.min(endTime, currentTime + 5));
    }
  }
  
  // 初始化视频
  $: if (videoBlob) {
    initializeVideo();
  }

  // 定期更新预览
  let previewInterval: number;
  $: if (videoElement && previewCanvas) {
    if (previewInterval) {
      clearInterval(previewInterval);
    }
    previewInterval = setInterval(updatePreview, 100);
  }
</script>

<!-- 键盘快捷键监听 -->
<svelte:window on:keydown={handleKeydown} />

<div class="video-editor">
  <h3>{$t('editor.title')}</h3>
  
  <!-- 隐藏的视频元素用于处理 -->
  <video
    bind:this={videoElement}
    src={videoUrl}
    on:loadedmetadata={handleVideoLoaded}
    on:timeupdate={handleTimeUpdate}
    style="display: none;"
    preload="metadata"
    muted
  >
    <track kind="captions" />
  </video>

  <!-- 视频预览区域 -->
  <div class="preview-section">
    <div class="preview-controls">
      <button
        class="btn btn-secondary"
        class:active={previewMode === 'original'}
        on:click={() => previewMode = 'original'}
      >
        {$t('editor.preview.original')}
      </button>
      <button
        class="btn btn-secondary"
        class:active={previewMode === 'cropped'}
        on:click={() => previewMode = 'cropped'}
      >
        {$t('editor.preview.cropped')}
      </button>
    </div>

    <div class="preview-container">
      <canvas
        bind:this={previewCanvas}
        class="preview-canvas"
        on:mousedown={handleCanvasMouseDown}
        on:mousemove={handleCanvasMouseMove}
        on:mouseup={handleCanvasMouseUp}
        on:mouseleave={handleCanvasMouseUp}
      ></canvas>
    </div>
    
    <!-- 播放控制 -->
    <div class="playback-controls">
      <button class="btn btn-primary" on:click={togglePlayback}>
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      <span class="time-display">
        {formatTime(currentTime)} / {formatTime(videoDuration)}
      </span>
    </div>
  </div>
  
  <!-- 时间裁剪控制 -->
  <div class="time-crop-section">
    <h4>{$t('editor.timeCrop.title')}</h4>
    <div class="time-controls">
      <div class="time-input-group">
        <label for="start-time-range">{$t('editor.timeCrop.start')}:</label>
        <input
          id="start-time-range"
          type="range"
          min="0"
          max={videoDuration}
          step="0.1"
          bind:value={startTime}
          on:input={(e) => updateStartTime(parseFloat((e.target as HTMLInputElement).value))}
        />
        <span>{formatTime(startTime)}</span>
      </div>

      <div class="time-input-group">
        <label for="end-time-range">{$t('editor.timeCrop.end')}:</label>
        <input
          id="end-time-range"
          type="range"
          min="0"
          max={videoDuration}
          step="0.1"
          bind:value={endTime}
          on:input={(e) => updateEndTime(parseFloat((e.target as HTMLInputElement).value))}
        />
        <span>{formatTime(endTime)}</span>
      </div>
      
      <div class="duration-info">
        {$t('editor.timeCrop.duration')}: {formatTime(endTime - startTime)}
      </div>
    </div>
  </div>

  <!-- 空间裁剪控制 -->
  <div class="space-crop-section">
    <h4>{$t('editor.spaceCrop.title')}</h4>
    <div class="crop-controls">
      <div class="crop-info">
        <div class="crop-input-group">
          <label for="crop-x">{$t('editor.spaceCrop.x')}:</label>
          <input
            id="crop-x"
            type="number"
            min="0"
            max={videoWidth - cropWidth}
            bind:value={cropX}
          />
          <span>px</span>
        </div>

        <div class="crop-input-group">
          <label for="crop-y">{$t('editor.spaceCrop.y')}:</label>
          <input
            id="crop-y"
            type="number"
            min="0"
            max={videoHeight - cropHeight}
            bind:value={cropY}
          />
          <span>px</span>
        </div>

        <div class="crop-input-group">
          <label for="crop-width">{$t('editor.spaceCrop.width')}:</label>
          <input
            id="crop-width"
            type="number"
            min="50"
            max={videoWidth - cropX}
            bind:value={cropWidth}
          />
          <span>px</span>
        </div>

        <div class="crop-input-group">
          <label for="crop-height">{$t('editor.spaceCrop.height')}:</label>
          <input
            id="crop-height"
            type="number"
            min="50"
            max={videoHeight - cropY}
            bind:value={cropHeight}
          />
          <span>px</span>
        </div>
      </div>

      <div class="crop-presets">
        <button
          class="btn btn-secondary"
          on:click={() => {
            cropX = 0;
            cropY = 0;
            cropWidth = videoWidth;
            cropHeight = videoHeight;
          }}
        >
          {$t('editor.spaceCrop.resetFull')}
        </button>

        <button
          class="btn btn-secondary"
          on:click={() => {
            const centerX = videoWidth / 2;
            const centerY = videoHeight / 2;
            const size = Math.min(videoWidth, videoHeight) * 0.8;
            cropX = centerX - size / 2;
            cropY = centerY - size / 2;
            cropWidth = size;
            cropHeight = size;
          }}
        >
          {$t('editor.spaceCrop.centerSquare')}
        </button>
      </div>

      <div class="crop-size-info">
        {$t('editor.spaceCrop.size')}: {cropWidth} × {cropHeight} px
      </div>
    </div>
  </div>

  <!-- 处理进度 -->
  {#if isLoading && processingStatus}
    <div class="processing-status">
      <div class="status-text">{processingStatus}</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {processingProgress}%"></div>
      </div>
      <div class="progress-text">{processingProgress}%</div>
    </div>
  {/if}

  <!-- 操作按钮 -->
  <div class="editor-actions">
    <button
      class="btn btn-primary"
      class:loading={isLoading}
      on:click={saveVideo}
      disabled={isLoading}
    >
      <span class="icon icon-download"></span>
      {isLoading ? processingStatus || translate('common.loading') : $t('editor.actions.save')}
    </button>
    <button
      class="btn btn-secondary"
      on:click={cancelEdit}
      disabled={isLoading}
    >
      <span class="icon icon-cancel"></span>
      {$t('editor.actions.cancel')}
    </button>
  </div>

  <!-- 操作提示 -->
  <div class="help-section">
    <h4>{$t('editor.help.title')}</h4>
    <div class="help-items">
      <div class="help-item">
        <kbd>空格</kbd> {$t('editor.help.playPause')}
      </div>
      <div class="help-item">
        <kbd>←</kbd> <kbd>→</kbd> {$t('editor.help.seek')}
      </div>
      <div class="help-item">
        <kbd>Ctrl</kbd>+<kbd>S</kbd> {$t('editor.help.save')}
      </div>
      <div class="help-item">
        <kbd>Esc</kbd> {$t('editor.help.cancel')}
      </div>
    </div>
    <div class="help-note">
      {$t('editor.help.note')}
    </div>
  </div>
</div>

<!-- 隐藏的画布用于处理 -->
<canvas bind:this={canvasElement} style="display: none;"></canvas>

<style>
  .video-editor {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    transition: all 0.3s ease;
  }
  
  .video-editor h3 {
    margin-top: 0;
    margin-bottom: 2rem;
    color: #1d4ed8;
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .video-editor h3::before {
    content: '🎬';
    font-size: 1.25rem;
  }
  
  .preview-section {
    margin-bottom: 2rem;
  }
  
  .preview-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    justify-content: center;
  }
  
  .preview-controls .btn.active {
    background: #3b82f6;
    color: white;
  }
  
  .preview-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }
  
  .preview-canvas {
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    max-width: 100%;
    height: auto;
  }
  
  .playback-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  
  .time-display {
    font-family: monospace;
    font-size: 1rem;
    color: #374151;
  }
  
  .time-crop-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .time-crop-section h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #1d4ed8;
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .time-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .time-input-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .time-input-group label {
    min-width: 80px;
    font-weight: 500;
    color: #374151;
  }
  
  .time-input-group input[type="range"] {
    flex: 1;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  
  .time-input-group input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: #3b82f6;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .time-input-group span {
    min-width: 60px;
    font-family: monospace;
    color: #6b7280;
  }
  
  .duration-info {
    text-align: center;
    font-weight: 600;
    color: #059669;
    padding: 0.5rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 8px;
  }

  .space-crop-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: rgba(168, 85, 247, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(168, 85, 247, 0.2);
  }

  .space-crop-section h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #7c3aed;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .crop-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .crop-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .crop-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .crop-input-group label {
    min-width: 60px;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .crop-input-group input[type="number"] {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.9rem;
    background: white;
    min-width: 80px;
  }

  .crop-input-group input[type="number"]:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
  }

  .crop-input-group span {
    font-size: 0.85rem;
    color: #6b7280;
    min-width: 20px;
  }

  .crop-presets {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .crop-size-info {
    text-align: center;
    font-weight: 600;
    color: #7c3aed;
    padding: 0.5rem;
    background: rgba(168, 85, 247, 0.1);
    border-radius: 8px;
  }

  .processing-status {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(59, 130, 246, 0.2);
    text-align: center;
  }

  .status-text {
    font-weight: 600;
    color: #1d4ed8;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.9rem;
    color: #6b7280;
    font-weight: 500;
  }

  .editor-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border: 2px solid transparent;
    border-radius: 16px;
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 140px;
    justify-content: center;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
  }
  
  .btn-secondary {
    background: rgba(107, 114, 128, 0.1);
    color: #374151;
    border-color: rgba(107, 114, 128, 0.2);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: rgba(107, 114, 128, 0.2);
    border-color: rgba(107, 114, 128, 0.3);
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
  
  .btn.loading {
    position: relative;
    color: transparent;
  }
  
  .btn.loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
  
  .icon {
    font-size: 1.1rem;
  }
  
  .icon-download::before {
    content: '⬇️';
  }
  
  .icon-cancel::before {
    content: '❌';
  }

  .help-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: rgba(107, 114, 128, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(107, 114, 128, 0.2);
  }

  .help-section h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #374151;
    font-size: 1rem;
    font-weight: 600;
  }

  .help-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .help-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #6b7280;
  }

  .help-item kbd {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: #374151;
    background: linear-gradient(145deg, #f8fafc, #e2e8f0);
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-weight: 600;
  }

  .help-note {
    font-size: 0.85rem;
    color: #6b7280;
    font-style: italic;
    text-align: center;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    border-left: 3px solid #3b82f6;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .video-editor {
      padding: 1.5rem;
    }

    .preview-controls {
      flex-direction: column;
      gap: 0.5rem;
    }

    .preview-controls .btn {
      width: 100%;
    }

    .time-input-group {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .time-input-group label {
      min-width: auto;
    }

    .crop-info {
      grid-template-columns: 1fr;
    }

    .crop-presets {
      flex-direction: column;
    }

    .crop-presets .btn {
      width: 100%;
    }

    .editor-actions {
      flex-direction: column;
    }

    .editor-actions .btn {
      width: 100%;
      min-width: auto;
    }

    .help-items {
      grid-template-columns: 1fr;
    }
  }
</style>
