<script lang="ts">
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { message } from '@tauri-apps/plugin-dialog';
  import { open } from '@tauri-apps/plugin-dialog';
  import { documentDir, videoDir } from '@tauri-apps/api/path';
  import { screenRecorder } from '$lib/recorder/ScreenRecorder';
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
    initializeStore
  } from '$lib/stores/recording';

  // 响应式状态
  let currentStatus = $state($recordingState.status);
  let currentDuration = $state($recordingState.duration);
  let currentMode = $state($recordingSettings.mode);
  let currentAudioSource = $state($recordingSettings.audioSource);
  let currentQuality = $state($recordingSettings.videoQuality);
  let currentSaveDir = $state($recordingSettings.saveDirectory);
  let currentError = $state($recordingState.error);
  
  let isLoading = $state(false);
  let showRegionSelector = $state(false);
  let selectedRegion = $state(null);

  // 订阅 store 变化
  $effect(() => {
    const unsubscribeState = recordingState.subscribe(state => {
      currentStatus = state.status;
      currentDuration = state.duration;
      currentError = state.error;
    });

    const unsubscribeSettings = recordingSettings.subscribe(settings => {
      currentMode = settings.mode;
      currentAudioSource = settings.audioSource;
      currentQuality = settings.videoQuality;
      currentSaveDir = settings.saveDirectory;
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
    
    // 设置默认保存目录
    if (!currentSaveDir) {
      const defaultDir = await videoDir();
      updateSettings({ saveDirectory: defaultDir });
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
      
      // 如果是区域录制，需要先选择区域
      if (currentMode === 'region' && !selectedRegion) {
        // TODO: 实现区域选择器
        await message('区域录制功能开发中', '提示');
        return;
      }

      // 开始录制
      await screenRecorder.startRecording(currentMode, selectedRegion || undefined);
      
      // 通知后端更新状态
      await invoke('update_recording_status', { status: 'recording' });
      
    } catch (error) {
  // 静默处理开始录制失败，不弹出错误提示
  console.warn('开始录制失败(已静默):', error);
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
        
        await message(`录制已保存到: ${outputPath}`, {
          title: '录制完成',
          kind: 'info'
        });
      }
    } catch (error) {
  // 静默处理停止录制失败，不弹出错误提示
  console.warn('停止录制失败(已静默):', error);
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
   * 选择保存目录
   */
  async function selectSaveDirectory() {
    const selected = await open({
      directory: true,
      defaultPath: currentSaveDir || await documentDir(),
      title: '选择保存目录'
    });

    if (selected) {
      updateSettings({ saveDirectory: selected });
    }
  }

  /**
   * 打开保存文件夹
   */
  async function openSaveFolder() {
    const dir = currentSaveDir || await videoDir();
    await invoke('open_folder', { path: dir });
  }

  // 计算状态文本
  let statusText = $derived(currentStatus === 'idle' ? '准备就绪' :
                           currentStatus === 'recording' ? '录制中' :
                           currentStatus === 'paused' ? '已暂停' : '');

  let formattedDuration = $derived(formatDuration(currentDuration));
</script>

<main class="container">
  <div class="header">
    <h1>🎬 屏幕录制工具</h1>
    <div class="status-badge" class:recording={currentStatus === 'recording'}>
      <span class="status-dot"></span>
      {statusText}
    </div>
  </div>

  <!-- 录制控制区 -->
  <div class="control-panel">
    <div class="timer">
      <span class="timer-display">{formattedDuration}</span>
    </div>

    <div class="control-buttons">
      {#if currentStatus === 'idle'}
        <button 
          class="btn btn-primary btn-large"
          onclick={startRecording}
          disabled={isLoading}
        >
          <span class="icon">⏺</span>
          开始录制
        </button>
      {:else}
        <button 
          class="btn btn-danger btn-large"
          onclick={stopRecording}
          disabled={isLoading}
        >
          <span class="icon">⏹</span>
          停止录制
        </button>
        
        {#if currentStatus === 'recording'}
          <button 
            class="btn btn-secondary"
            onclick={togglePause}
          >
            <span class="icon">⏸</span>
            暂停
          </button>
        {:else if currentStatus === 'paused'}
          <button 
            class="btn btn-secondary"
            onclick={togglePause}
          >
            <span class="icon">▶</span>
            继续
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- 设置区 -->
  <div class="settings-section">
    <h3>录制设置</h3>
    
    <div class="setting-group">
      <fieldset>
        <legend>录制模式</legend>
        <div class="radio-group">
          <label class="radio-item">
            <input
              type="radio"
              value="fullscreen"
              bind:group={currentMode}
              disabled={currentStatus !== 'idle'}
              onchange={() => updateSettings({ mode: currentMode })}
            />
            <span>全屏</span>
          </label>
          <label class="radio-item">
            <input
              type="radio"
              value="window"
              bind:group={currentMode}
              disabled={currentStatus !== 'idle'}
              onchange={() => updateSettings({ mode: currentMode })}
            />
            <span>窗口</span>
          </label>
          <label class="radio-item">
            <input
              type="radio"
              value="region"
              bind:group={currentMode}
              disabled={currentStatus !== 'idle'}
              onchange={() => updateSettings({ mode: currentMode })}
            />
            <span>区域</span>
          </label>
        </div>
      </fieldset>
    </div>

    <div class="setting-group">
      <label for="audio-source">音频源</label>
      <select
        id="audio-source"
        bind:value={currentAudioSource}
        disabled={currentStatus !== 'idle'}
        onchange={() => updateSettings({ audioSource: currentAudioSource })}
      >
        <option value="none">无音频</option>
        <option value="microphone">麦克风</option>
        <option value="system">系统声音</option>
        <option value="both">麦克风 + 系统声音</option>
      </select>
    </div>

    <div class="setting-group">
      <label for="video-quality">视频质量</label>
      <select
        id="video-quality"
        bind:value={currentQuality}
        disabled={currentStatus !== 'idle'}
        onchange={() => updateSettings({ videoQuality: currentQuality })}
      >
        <option value="low">低质量 (2Mbps, 15fps)</option>
        <option value="medium">中等质量 (5Mbps, 30fps)</option>
        <option value="high">高质量 (10Mbps, 60fps)</option>
      </select>
    </div>

    <div class="setting-group">
      <label for="save-directory">保存位置</label>
      <div class="path-selector">
        <input
          id="save-directory"
          type="text"
          value={currentSaveDir || '默认视频文件夹'}
          readonly
        />
        <button
          class="btn btn-small"
          onclick={selectSaveDirectory}
          disabled={currentStatus !== 'idle'}
        >
          选择
        </button>
      </div>
    </div>
  </div>

  <!-- 快捷键提示 -->
  <div class="shortcuts-hint">
    <p>快捷键：</p>
    <div class="shortcut-items">
      <span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd> 开始/停止</span>
      <span class="shortcut"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> 暂停/继续</span>
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    margin: 0;
    color: white;
    font-size: 2rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-weight: 500;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #4caf50;
    animation: pulse 2s infinite;
  }

  .status-badge.recording .status-dot {
    background: #f44336;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 currentColor;
      opacity: 1;
    }
    70% {
      box-shadow: 0 0 0 10px transparent;
      opacity: 0.7;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
      opacity: 1;
    }
  }

  .control-panel {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    margin-bottom: 2rem;
  }

  .timer {
    text-align: center;
    margin-bottom: 2rem;
  }

  .timer-display {
    font-size: 3rem;
    font-weight: 200;
    font-variant-numeric: tabular-nums;
    color: #333;
  }

  .control-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  .btn-danger {
    background: linear-gradient(135deg, #f44336 0%, #e91e63 100%);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(244, 67, 54, 0.4);
  }

  .btn-secondary {
    background: #f5f5f5;
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .btn-large {
    padding: 1rem 2rem;
    font-size: 1.1rem;
  }

  .btn-small {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }

  .icon {
    font-size: 1.5rem;
  }

  .settings-section {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    margin-bottom: 2rem;
  }

  .settings-section h3 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: #333;
  }

  .setting-group {
    margin-bottom: 1.5rem;
  }

  .setting-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #666;
    font-weight: 500;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
  }

  .radio-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .radio-item input[type="radio"] {
    cursor: pointer;
  }

  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
    cursor: pointer;
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .path-selector {
    display: flex;
    gap: 0.5rem;
  }

  .path-selector input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    background: #f9f9f9;
  }

  .shortcuts-hint {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 2rem;
  }

  .shortcuts-hint p {
    margin: 0 0 0.5rem 0;
    color: #666;
    font-weight: 500;
  }

  .shortcut-items {
    display: flex;
    justify-content: center;
    gap: 2rem;
  }

  .shortcut {
    color: #333;
  }

  kbd {
    display: inline-block;
    padding: 0.2rem 0.4rem;
    font-size: 0.875rem;
    color: #333;
    background: #f5f5f5;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 0 #ccc;
    font-family: monospace;
  }

  .error-message {
    background: #ffebee;
    border: 1px solid #ffcdd2;
    border-radius: 8px;
    padding: 1rem;
    color: #c62828;
    margin-top: 1rem;
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
    }

    .control-panel,
    .settings-section {
      background: #1e1e1e;
      color: #f5f5f5;
    }

    .timer-display {
      color: #f5f5f5;
    }

    .settings-section h3 {
      color: #f5f5f5;
    }

    .setting-group label {
      color: #aaa;
    }

    select,
    .path-selector input {
      background: #2c2c2c;
      border-color: #444;
      color: #f5f5f5;
    }

    .btn-secondary {
      background: #2c2c2c;
      color: #f5f5f5;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #3c3c3c;
    }

    .shortcuts-hint {
      background: rgba(30, 30, 30, 0.9);
    }

    .shortcuts-hint p {
      color: #aaa;
    }

    .shortcut {
      color: #f5f5f5;
    }

    kbd {
      background: #2c2c2c;
      border-color: #444;
      color: #f5f5f5;
      box-shadow: 0 2px 0 #444;
    }

    .error-message {
      background: #4a1c1c;
      border-color: #8b2c2c;
      color: #ff8a80;
    }
  }
</style>
