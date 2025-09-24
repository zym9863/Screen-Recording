<script lang="ts">
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { message } from '@tauri-apps/plugin-dialog';
  import { open } from '@tauri-apps/plugin-dialog';
  import { documentDir, videoDir, join } from '@tauri-apps/api/path';
  import { screenRecorder } from '$lib/recorder/ScreenRecorder';
  import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';
  import VideoEditor from '$lib/components/VideoEditor.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import { t, translate } from '$lib/i18n';
  import {
    recordingState,
    recordingSettings,
    isRecording,
    isPaused,
    canRecord,
    canPause,
    canResume,
    canStop,
    formatDuration,
    updateSettings,
    initializeStore,
    clearRecordedBlob
  } from '$lib/stores/recording';

  // 响应式状态
  let currentStatus = $state($recordingState.status);
  let currentDuration = $state($recordingState.duration);
  let currentMode = $state($recordingSettings.mode);
  let currentAudioSource = $state($recordingSettings.audioSource);
  let currentQuality = $state($recordingSettings.videoQuality);
  let currentFileFormat = $state($recordingSettings.fileFormat);
  let currentSaveDir = $state($recordingSettings.saveDirectory);
  let currentAutoDownload = $state($recordingSettings.autoDownload);
  let currentError = $state($recordingState.error);
  let currentRecordedBlob = $state($recordingState.recordedBlob);
  let currentRecordedFileName = $state($recordingState.recordedFileName);

  let isLoading = $state(false);
  let showVideoEditor = $state(false);

  // 订阅 store 变化
  $effect(() => {
    const unsubscribeState = recordingState.subscribe(state => {
      currentStatus = state.status;
      currentDuration = state.duration;
      currentError = state.error;
      currentRecordedBlob = state.recordedBlob;
      currentRecordedFileName = state.recordedFileName;
    });

    const unsubscribeSettings = recordingSettings.subscribe(settings => {
      currentMode = settings.mode;
      currentAudioSource = settings.audioSource;
      currentQuality = settings.videoQuality;
      currentFileFormat = settings.fileFormat;
      currentSaveDir = settings.saveDirectory;
      currentAutoDownload = settings.autoDownload;
    });

    return () => {
      unsubscribeState();
      unsubscribeSettings();
    };
  });

  // 初始化
  onMount(async () => {
    // 初始化存储
    await initializeStore();
    
    // 仅在未设置时填充默认保存目录；已设置则尝试确保目录存在（失败也不覆盖设置）
    try {
      const saved = $recordingSettings.saveDirectory || currentSaveDir;
      if (!saved) {
        const def = await videoDir();
        try { await mkdir(def, { recursive: true }); } catch (_) {}
        updateSettings({ saveDirectory: def });
      } else {
        try {
          const ok = await exists(saved);
          if (!ok) {
            try { await mkdir(saved, { recursive: true }); } catch (_) {}
          }
        } catch (e) {
          console.warn(translate('messages.folderCreationWarning'), e);
        }
      }
    } catch (e) {
      console.warn(translate('messages.initializationError'), e);
    }

    // 监听后端事件
    setupEventListeners();
  });

  /**
   * 设置事件监听器
   */
  async function setupEventListeners() {
    // 托盘事件
    await listen('tray:start_stop', () => {
      toggleRecording();
    });

    await listen('tray:pause_resume', () => {
      togglePause();
    });

    await listen('tray:open_folder', async () => {
      await openSaveFolder();
    });

    // 快捷键事件
    await listen('shortcut:toggle_recording', () => {
      toggleRecording();
    });

    await listen('shortcut:toggle_pause', () => {
      togglePause();
    });

    // 窗口关闭事件 - 直接退出应用
    await listen('window:close_requested', async () => {
      await invoke('exit_app');
    });
  }

  /**
   * 开始/停止录制
   */
  async function toggleRecording() {
    if (currentStatus === 'idle') {
      await startRecording();
    } else {
      await stopRecording();
    }
  }

  /**
   * 开始录制
   */
  async function startRecording() {
    try {
      isLoading = true;

      // 开始录制
      await screenRecorder.startRecording(currentMode);
      
      // 通知后端更新状态
      await invoke('update_recording_status', { status: 'recording' });
      
    } catch (error) {
  // 静默处理开始录制失败，不弹出错误提示
  console.warn(translate('messages.recordingStartFailed'), error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * 停止录制
   */
  async function stopRecording() {
    try {
      isLoading = true;
      
      const outputPath = await screenRecorder.stopRecording();
      
      // 通知后端更新状态
      await invoke('update_recording_status', { status: 'idle' });
      
      if (outputPath) {
        // 根据设置执行录制后操作
        const settings = $recordingSettings;
        if (settings.afterRecording === 'openFolder') {
          await openSaveFolder();
        } else if (settings.afterRecording === 'openFile') {
          // TODO: 打开文件
        }
        
        await message(`${$t('download.messages.saved')}: ${outputPath}`, {
          title: $t('messages.recordingComplete'),
          kind: 'info'
        });
      }
    } catch (error) {
  // 静默处理停止录制失败，不弹出错误提示
  console.warn(translate('messages.recordingStopFailed'), error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * 暂停/恢复录制
   */
  function togglePause() {
    if (currentStatus === 'recording') {
      screenRecorder.pauseRecording();
      invoke('update_recording_status', { status: 'paused' });
    } else if (currentStatus === 'paused') {
      screenRecorder.resumeRecording();
      invoke('update_recording_status', { status: 'recording' });
    }
  }

  /**
   * 手动下载录制文件
   */
  async function handleManualDownload() {
    try {
      isLoading = true;
      const outputPath = await screenRecorder.downloadRecording();
      
      if (outputPath) {
        // 根据设置执行录制后操作
        const settings = $recordingSettings;
        if (settings.afterRecording === 'openFolder') {
          await openSaveFolder();
        } else if (settings.afterRecording === 'openFile') {
          // TODO: 打开文件
        }
        
        await message(`${$t('download.messages.saved')}: ${outputPath}`, {
          title: $t('messages.downloadComplete'),
          kind: 'info'
        });
      }
    } catch (error) {
      console.warn('手动下载失败:', error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * 取消下载（清除待下载数据）
   */
  function handleCancelDownload() {
    clearRecordedBlob();
    showVideoEditor = false;
  }

  /**
   * 开始视频编辑
   */
  function startVideoEdit() {
    showVideoEditor = true;
  }

  /**
   * 处理视频编辑保存
   */
  async function handleVideoSave(event: CustomEvent) {
    try {
      isLoading = true;
      const { processedBlob, cropOptions } = event.detail;

      // 使用处理后的视频Blob保存文件
      const outputPath = await saveProcessedVideo(processedBlob, cropOptions);

      if (outputPath) {
        // 根据设置执行录制后操作
        const settings = $recordingSettings;
        if (settings.afterRecording === 'openFolder') {
          await openSaveFolder();
        } else if (settings.afterRecording === 'openFile') {
          // TODO: 打开文件
        }

        showVideoEditor = false;
        clearRecordedBlob();
      }
    } catch (error) {
      // 静默处理保存失败，不显示错误提示框
      console.warn(translate('messages.videoSaveFailed'), error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * 处理视频编辑错误
   */
  async function handleVideoError(event: CustomEvent) {
    const { message: errorMessage } = event.detail;
    // 静默处理编辑错误，不显示错误提示框
    console.warn(translate('messages.videoEditFailed'), errorMessage);
  }

  /**
   * 保存处理后的视频
   */
  async function saveProcessedVideo(processedBlob: Blob, cropOptions: any): Promise<string | null> {
    const settings = $recordingSettings;

    // 确定保存路径
    let saveDir = settings.saveDirectory;
    if (!saveDir) {
      saveDir = await videoDir();
    }

    // 根据原始文件名和Blob类型生成合适的文件名
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5);

    // 检测输出格式
    const isMP4 = processedBlob.type && processedBlob.type.includes('mp4');
    const extension = isMP4 ? 'mp4' : 'webm';
    const fileName = `ScreenRecording_Edited_${timestamp}.${extension}`;

    try {
      // 确保目录存在
      const dirExists = await exists(saveDir);
      if (!dirExists) {
        await mkdir(saveDir, { recursive: true });
      }

      const filePath = await join(saveDir, fileName);

      // 将Blob转换为Uint8Array
      const arrayBuffer = await processedBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 写入文件
      await writeFile(filePath, uint8Array);
      console.log('编辑后的视频已保存到:', filePath);

      return filePath;
    } catch (e: any) {
      // 若权限/范围限制，回退到默认视频目录
      const errMsg = e?.message || String(e);
      if (/forbidden|scope|permission|denied|not\s*permitted/i.test(errMsg)) {
        const fallbackDir = await videoDir();
        const fallbackPath = await join(fallbackDir, fileName);
        try {
          const existsFallback = await exists(fallbackDir);
          if (!existsFallback) {
            await mkdir(fallbackDir, { recursive: true });
          }

          const arrayBuffer = await processedBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await writeFile(fallbackPath, uint8Array);
          console.warn('原保存目录不可用，本次已回退到默认视频目录:', fallbackDir);
          return fallbackPath;
        } catch (_) {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  /**
   * 取消视频编辑
   */
  function handleVideoCancel() {
    showVideoEditor = false;
  }

  /**
   * 选择保存目录
   */
  async function selectSaveDirectory() {
    const selected = await open({
      directory: true,
      defaultPath: currentSaveDir || await documentDir(),
      title: $t('recording.settings.saveDir.title')
    });

    if (selected) {
      updateSettings({ saveDirectory: selected });
    }
  }

  /**
   * 打开保存文件夹
   */
  async function openSaveFolder() {
    try {
      const dir = currentSaveDir || await videoDir();
      await invoke('open_folder', { path: dir });
    } catch (e: any) {
      console.warn('打开保存目录失败:', e);
      const msg = typeof e === 'string' ? e : (e?.message || translate('common.error'));
      // 尽量给出可读提示
      await message(`${$t('messages.openFolderFailed')}: ${msg}` , {
        title: $t('messages.openFolderFailed'),
        kind: 'error'
      });
    }
  }

  // 计算状态文本
  let statusText = $derived(currentStatus === 'idle' ? $t('app.status.ready') :
                           currentStatus === 'recording' ? $t('app.status.recording') :
                           currentStatus === 'paused' ? $t('app.status.paused') : '');

  let formattedDuration = $derived(formatDuration(currentDuration));
</script>

<main class="container">
  <div class="header">
    <h1>{$t('app.title')}</h1>
    <div class="header-right">
      <LanguageSwitcher />
      <div class="status-badge" class:recording={currentStatus === 'recording'}>
        <span class="status-dot"></span>
        {statusText}
      </div>
    </div>
  </div>

  <!-- 录制控制区 -->
  <div class="control-panel" class:recording={currentStatus === 'recording'}>
    <div class="timer">
      <span class="timer-display">{formattedDuration}</span>
    </div>

    <div class="control-buttons">
      {#if currentStatus === 'idle'}
        <button 
          class="btn btn-primary btn-large"
          class:loading={isLoading}
          onclick={startRecording}
          disabled={isLoading}
        >
          <span class="icon icon-record"></span>
          {isLoading ? $t('recording.controls.preparing') : $t('recording.controls.start')}
        </button>
      {:else}
        <button 
          class="btn btn-danger btn-large"
          class:loading={isLoading}
          onclick={stopRecording}
          disabled={isLoading}
        >
          <span class="icon icon-stop"></span>
          {isLoading ? $t('recording.controls.stopping') : $t('recording.controls.stop')}
        </button>
        
        {#if currentStatus === 'recording'}
          <button 
            class="btn btn-secondary"
            onclick={togglePause}
          >
            <span class="icon icon-pause"></span>
            {$t('recording.controls.pause')}
          </button>
        {:else if currentStatus === 'paused'}
          <button 
            class="btn btn-secondary"
            onclick={togglePause}
          >
            <span class="icon icon-play"></span>
            {$t('recording.controls.resume')}
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- 设置区 -->
  <div class="settings-section">
    <h3>{$t('recording.settings.title')}</h3>
    
    <div class="setting-group">
      <fieldset>
        <legend>{$t('recording.settings.mode.title')}</legend>
        <div class="radio-group">
          <label class="radio-item">
            <input
              type="radio"
              value="fullscreen"
              bind:group={currentMode}
              disabled={currentStatus !== 'idle'}
              onchange={() => updateSettings({ mode: currentMode })}
            />
            <span>{$t('recording.settings.mode.fullscreen')}</span>
          </label>
          <label class="radio-item">
            <input
              type="radio"
              value="window"
              bind:group={currentMode}
              disabled={currentStatus !== 'idle'}
              onchange={() => updateSettings({ mode: currentMode })}
            />
            <span>{$t('recording.settings.mode.window')}</span>
          </label>
          
        </div>
      </fieldset>
    </div>

    <div class="setting-group">
      <label for="audio-source">{$t('recording.settings.audio.title')}</label>
      <select
        id="audio-source"
        bind:value={currentAudioSource}
        disabled={currentStatus !== 'idle'}
        onchange={() => updateSettings({ audioSource: currentAudioSource })}
      >
        <option value="none">{$t('recording.settings.audio.none')}</option>
        <option value="microphone">{$t('recording.settings.audio.microphone')}</option>
        <option value="system">{$t('recording.settings.audio.system')}</option>
        <option value="both">{$t('recording.settings.audio.both')}</option>
      </select>
    </div>

    <div class="setting-group">
      <label for="video-quality">{$t('recording.settings.quality.title')}</label>
      <select
        id="video-quality"
        bind:value={currentQuality}
        disabled={currentStatus !== 'idle'}
        onchange={() => updateSettings({ videoQuality: currentQuality })}
      >
        <option value="low">{$t('recording.settings.quality.low')}</option>
        <option value="medium">{$t('recording.settings.quality.medium')}</option>
        <option value="high">{$t('recording.settings.quality.high')}</option>
      </select>
    </div>

    <div class="setting-group">
      <label for="file-format">{$t('recording.settings.format.title')}</label>
      <select
        id="file-format"
        bind:value={currentFileFormat}
        disabled={currentStatus !== 'idle'}
        onchange={() => updateSettings({ fileFormat: currentFileFormat })}
      >
        <option value="webm">{$t('recording.settings.format.webm')}</option>
        <option value="mp4">{$t('recording.settings.format.mp4')}</option>
      </select>
      {#if currentFileFormat === 'mp4'}
        <small class="format-hint">
          {$t('recording.settings.format.hint')}
        </small>
      {/if}
    </div>

    <div class="setting-group">
      <label for="save-directory">{$t('recording.settings.saveDir.title')}</label>
      <div class="path-selector">
        <input
          id="save-directory"
          type="text"
          value={currentSaveDir || $t('recording.settings.saveDir.default')}
          readonly
        />
        <button
          class="btn btn-small"
          onclick={selectSaveDirectory}
          disabled={currentStatus !== 'idle'}
        >
          {$t('recording.settings.saveDir.select')}
        </button>
      </div>
    </div>

    <div class="setting-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          bind:checked={currentAutoDownload}
          disabled={currentStatus !== 'idle'}
          onchange={() => updateSettings({ autoDownload: currentAutoDownload })}
        />
        <span class="checkbox-text">{$t('recording.settings.autoDownload.title')}</span>
      </label>
      <small class="setting-hint">
        {$t('recording.settings.autoDownload.hint')}
      </small>
    </div>
  </div>

  <!-- 视频编辑区域 -->
  {#if currentRecordedBlob && !currentAutoDownload}
    {#if showVideoEditor}
      <VideoEditor
        videoBlob={currentRecordedBlob}
        {isLoading}
        on:save={handleVideoSave}
        on:cancel={handleVideoCancel}
        on:error={handleVideoError}
      />
    {:else}
      <div class="download-section">
        <h3>{$t('download.title')}</h3>
        <div class="download-info">
          <div class="file-info">
            <span class="file-name">{currentRecordedFileName || '未命名录制.webm'}</span>
            <span class="file-size">
              {currentRecordedBlob ? `${(currentRecordedBlob.size / 1024 / 1024).toFixed(1)} MB` : ''}
            </span>
          </div>
          <div class="download-actions">
            <button
              class="btn btn-primary"
              onclick={startVideoEdit}
              disabled={isLoading}
            >
              <span class="icon icon-edit"></span>
              {$t('download.actions.edit')}
            </button>
            <button
              class="btn btn-secondary"
              class:loading={isLoading}
              onclick={handleManualDownload}
              disabled={isLoading}
            >
              <span class="icon icon-download"></span>
              {isLoading ? $t('download.actions.downloading') : $t('download.actions.download')}
            </button>
            <button
              class="btn btn-secondary"
              onclick={handleCancelDownload}
              disabled={isLoading}
            >
              <span class="icon icon-cancel"></span>
              {$t('download.actions.cancel')}
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- 快捷键提示 -->
  <div class="shortcuts-hint">
    <p>{$t('shortcuts.title')}</p>
    <div class="shortcut-items">
      <span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd> {$t('shortcuts.startStop')}</span>
      <span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> {$t('shortcuts.pauseResume')}</span>
    </div>
  </div>

  <!-- 错误提示 -->
  {#if currentError}
    <div class="error-message">
      ⚠️ {currentError}
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
    background-size: 400% 400%;
    animation: gradient-shift 15s ease infinite;
    min-height: 100vh;
    overflow-x: hidden;
  }

  @keyframes gradient-shift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  :global(*) {
    box-sizing: border-box;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    gap: 1rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header h1 {
    margin: 0;
    color: white;
    font-size: 2.5rem;
    font-weight: 700;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    letter-spacing: -0.5px;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    border-radius: 50px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #10b981;
    position: relative;
    animation: pulse-subtle 3s infinite;
  }

  .status-dot::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 50%;
    background: inherit;
    opacity: 0.3;
    animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .status-badge.recording .status-dot {
    background: #ef4444;
    animation: pulse-recording 1.5s infinite;
  }

  @keyframes pulse-subtle {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.05);
    }
  }

  @keyframes pulse-recording {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  .control-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 3rem 2rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .control-panel:hover {
    transform: translateY(-2px);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .timer {
    text-align: center;
    margin-bottom: 3rem;
    position: relative;
  }

  .timer-display {
    font-size: 4rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    color: #1f2937;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    line-height: 1.1;
    position: relative;
  }

  .timer-display::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120%;
    height: 120%;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
    border-radius: 50%;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .control-panel.recording .timer-display::before {
    opacity: 1;
    animation: timer-glow 2s ease-in-out infinite alternate;
  }

  @keyframes timer-glow {
    0% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0.8;
      transform: translate(-50%, -50%) scale(1.05);
    }
  }

  .control-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 1rem 2rem;
    border: none;
    border-radius: 16px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    position: relative;
    overflow: hidden;
    min-width: 140px;
    text-decoration: none;
    border: 2px solid transparent;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .btn:disabled::before {
    display: none;
  }

  .btn.loading {
    pointer-events: none;
    position: relative;
  }

  .btn.loading::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 8px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .btn:hover:not(:disabled)::before {
    left: 100%;
  }

  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px rgba(99, 102, 241, 0.4);
    background: linear-gradient(135deg, #5b5ff5 0%, #8152f3 100%);
  }

  .btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px rgba(239, 68, 68, 0.4);
    background: linear-gradient(135deg, #e63946 0%, #c53030 100%);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.9);
    color: #374151;
    border: 2px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    border-color: rgba(0, 0, 0, 0.2);
  }

  .btn-large {
    padding: 1.25rem 2.5rem;
    font-size: 1.2rem;
    min-width: 180px;
  }

  .btn-small {
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
    min-width: 100px;
  }

  .icon {
    font-size: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
  }

  /* CSS Icons instead of Unicode */
  .icon-record {
    background: currentColor;
    border-radius: 50%;
    width: 1rem;
    height: 1rem;
  }

  .icon-stop {
    background: currentColor;
    width: 1rem;
    height: 1rem;
    border-radius: 2px;
  }

  .icon-pause {
    position: relative;
  }

  .icon-pause::before,
  .icon-pause::after {
    content: '';
    position: absolute;
    background: currentColor;
    width: 3px;
    height: 1rem;
    border-radius: 1px;
  }

  .icon-pause::before {
    left: 3px;
  }

  .icon-pause::after {
    right: 3px;
  }

  .icon-play {
    width: 0;
    height: 0;
    border-left: 8px solid currentColor;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    margin-left: 2px;
  }

  .settings-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .settings-section:hover {
    transform: translateY(-1px);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .settings-section h3 {
    margin-top: 0;
    margin-bottom: 2rem;
    color: #1f2937;
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .settings-section h3::before {
    content: '⚙️';
    font-size: 1.25rem;
  }

  .setting-group {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }

  .setting-group:hover {
    background: rgba(255, 255, 255, 0.7);
    border-color: rgba(99, 102, 241, 0.2);
  }

  .setting-group:last-child {
    margin-bottom: 0;
  }

  .setting-group label {
    display: block;
    margin-bottom: 0.75rem;
    color: #374151;
    font-weight: 600;
    font-size: 0.95rem;
  }

  /* 复选框样式 */
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    margin-bottom: 0 !important;
  }

  .checkbox-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: #6366f1;
    cursor: pointer;
  }

  .checkbox-text {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .setting-hint {
    display: block;
    margin-top: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* 下载区域样式 */
  .download-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    transition: all 0.3s ease;
  }

  .download-section:hover {
    transform: translateY(-1px);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(34, 197, 94, 0.3);
  }

  .download-section h3 {
    margin-top: 0;
    margin-bottom: 2rem;
    color: #059669;
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .download-section h3::before {
    content: '✅';
    font-size: 1.25rem;
  }

  .download-info {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.5rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .file-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: #065f46;
  }

  .file-size {
    font-size: 0.9rem;
    color: #6b7280;
    font-weight: 500;
  }

  .download-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* 下载和取消图标 */
  .icon-download {
    position: relative;
  }

  .icon-download::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 4px;
    right: 4px;
    height: 8px;
    background: currentColor;
    border-radius: 1px;
  }

  .icon-download::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 6px solid currentColor;
  }

  .icon-cancel {
    position: relative;
  }

  .icon-cancel::before,
  .icon-cancel::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
  }

  .icon-cancel::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .icon-cancel::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .icon-edit {
    position: relative;
  }

  .icon-edit::before {
    content: '';
    position: absolute;
    top: 1px;
    left: 1px;
    right: 1px;
    bottom: 1px;
    border: 2px solid currentColor;
    border-radius: 3px;
    background: transparent;
  }

  .icon-edit::after {
    content: '';
    position: absolute;
    top: -2px;
    right: -2px;
    width: 6px;
    height: 6px;
    border: 2px solid currentColor;
    border-left: none;
    border-bottom: none;
    transform: rotate(45deg);
    background: transparent;
  }

  .radio-group {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .radio-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.7);
    border: 2px solid transparent;
    transition: all 0.2s ease;
    min-width: 100px;
    justify-content: center;
  }

  .radio-item:hover {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .radio-item input[type="radio"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
    accent-color: #6366f1;
  }

  .radio-item input[type="radio"]:checked + span {
    color: #6366f1;
    font-weight: 600;
  }

  .radio-item:has(input:checked) {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  legend {
    font-weight: 600;
    color: #374151;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }

  select {
    width: 100%;
    padding: 1rem;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    font-size: 1rem;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
    color: #374151;
    font-weight: 500;
  }

  select:hover {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(255, 255, 255, 0.9);
  }

  select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: white;
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .path-selector {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
  }

  .path-selector input {
    flex: 1;
    padding: 1rem;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    font-size: 1rem;
    background: rgba(248, 250, 252, 0.8);
    color: #374151;
    font-weight: 500;
  }

  .path-selector input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: white;
  }

  .shortcuts-hint {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(15px);
    border-radius: 20px;
    padding: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }

  .shortcuts-hint p {
    margin: 0 0 1rem 0;
    color: #374151;
    font-weight: 600;
    font-size: 1rem;
  }

  .shortcut-items {
    display: flex;
    justify-content: center;
    gap: 2.5rem;
    flex-wrap: wrap;
  }

  .shortcut {
    color: #1f2937;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  kbd {
    display: inline-block;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    color: #374151;
    background: linear-gradient(145deg, #f8fafc, #e2e8f0);
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-weight: 600;
  }

  .error-message {
    background: linear-gradient(135deg, #fef2f2, #fee2e2);
    border: 2px solid #fca5a5;
    border-radius: 16px;
    padding: 1.5rem;
    color: #dc2626;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
  }

  .error-message::before {
    content: '⚠️';
    font-size: 1.25rem;
  }

  .format-hint {
    display: block;
    margin-top: 0.75rem;
    color: #d97706;
    font-size: 0.875rem;
    line-height: 1.5;
    padding: 0.75rem;
    background: rgba(251, 191, 36, 0.1);
    border-radius: 8px;
    border-left: 3px solid #d97706;
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #581c87 100%);
    }

    .control-panel,
    .settings-section {
      background: rgba(30, 41, 59, 0.95);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .timer-display {
      color: #f1f5f9;
    }

    .settings-section h3 {
      color: #f1f5f9;
    }

    .setting-group {
      background: rgba(51, 65, 85, 0.5);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .setting-group:hover {
      background: rgba(51, 65, 85, 0.7);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .setting-group label,
    legend {
      color: #cbd5e1;
    }

    .radio-item {
      background: rgba(51, 65, 85, 0.7);
      color: #e2e8f0;
    }

    .radio-item:hover {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.4);
    }

    .radio-item:has(input:checked) {
      background: rgba(99, 102, 241, 0.25);
      border-color: #6366f1;
    }

    select,
    .path-selector input {
      background: rgba(51, 65, 85, 0.8);
      border-color: rgba(255, 255, 255, 0.2);
      color: #f1f5f9;
    }

    select:hover,
    .path-selector input:hover {
      background: rgba(51, 65, 85, 0.9);
      border-color: rgba(99, 102, 241, 0.4);
    }

    select:focus,
    .path-selector input:focus {
      background: rgba(51, 65, 85, 1);
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
    }

    .btn-secondary {
      background: rgba(51, 65, 85, 0.9);
      color: #f1f5f9;
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-secondary:hover:not(:disabled) {
      background: rgba(71, 85, 105, 1);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .shortcuts-hint {
      background: rgba(30, 41, 59, 0.9);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .shortcuts-hint p {
      color: #cbd5e1;
    }

    .shortcut {
      color: #f1f5f9;
    }

    kbd {
      background: linear-gradient(145deg, #374151, #1f2937);
      border-color: #4b5563;
      color: #f9fafb;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .error-message {
      background: linear-gradient(135deg, #450a0a, #7f1d1d);
      border-color: #dc2626;
      color: #fca5a5;
    }

    .format-hint {
      background: rgba(217, 119, 6, 0.2);
      color: #fbbf24;
      border-color: #d97706;
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
      gap: 1rem;
    }

    .header {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .header h1 {
      font-size: 2rem;
    }

    .control-panel,
    .settings-section {
      padding: 1.5rem;
    }

    .timer-display {
      font-size: 3rem;
    }

    .control-buttons {
      flex-direction: column;
      gap: 1rem;
    }

    .btn {
      width: 100%;
      min-width: auto;
    }

    .radio-group {
      flex-direction: column;
      gap: 0.75rem;
    }

    .radio-item {
      min-width: auto;
      width: 100%;
    }

    .shortcut-items {
      flex-direction: column;
      gap: 1rem;
    }
  }
</style>
