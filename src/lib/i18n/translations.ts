/**
 * 国际化翻译文本
 */

// 定义翻译类型
export interface Translations {
  common: {
    loading: string;
    cancel: string;
    confirm: string;
    error: string;
    success: string;
    save: string;
    edit: string;
    download: string;
    ready: string;
    close: string;
  };
  app: {
    title: string;
    status: {
      ready: string;
      recording: string;
      paused: string;
    };
  };
  recording: {
    controls: {
      start: string;
      stop: string;
      pause: string;
      resume: string;
      preparing: string;
      stopping: string;
    };
    settings: {
      title: string;
      mode: {
        title: string;
        fullscreen: string;
        window: string;
      };
      audio: {
        title: string;
        none: string;
        microphone: string;
        system: string;
        both: string;
      };
      quality: {
        title: string;
        low: string;
        medium: string;
        high: string;
      };
      format: {
        title: string;
        webm: string;
        mp4: string;
        hint: string;
      };
      saveDir: {
        title: string;
        select: string;
        default: string;
      };
      autoDownload: {
        title: string;
        hint: string;
      };
    };
  };
  download: {
    title: string;
    actions: {
      edit: string;
      download: string;
      cancel: string;
      downloading: string;
    };
    messages: {
      completed: string;
      saved: string;
    };
  };
  editor: {
    title: string;
    preview: {
      original: string;
      cropped: string;
    };
    timeCrop: {
      title: string;
      start: string;
      end: string;
      duration: string;
    };
    spaceCrop: {
      title: string;
      x: string;
      y: string;
      width: string;
      height: string;
      size: string;
      resetFull: string;
      centerSquare: string;
    };
    processing: {
      analyzing: string;
      processing: string;
      cropping: string;
      trimming: string;
      croppingTime: string;
      croppingSpace: string;
      saving: string;
      failed: string;
    };
    actions: {
      save: string;
      cancel: string;
    };
    help: {
      title: string;
      playPause: string;
      seek: string;
      save: string;
      cancel: string;
      note: string;
    };
  };
  shortcuts: {
    title: string;
    startStop: string;
    pauseResume: string;
  };
  messages: {
    recordingComplete: string;
    downloadComplete: string;
    openFolderFailed: string;
    recordingStartFailed: string;
    recordingStopFailed: string;
    videoSaveFailed: string;
    videoEditFailed: string;
    folderCreationWarning: string;
    initializationError: string;
  };
}

// 中文翻译
export const zhCN: Translations = {
  common: {
    loading: '加载中...',
    cancel: '取消',
    confirm: '确认',
    error: '错误',
    success: '成功',
    save: '保存',
    edit: '编辑',
    download: '下载',
    ready: '准备就绪',
    close: '关闭',
  },
  app: {
    title: '🎬 屏幕录制工具',
    status: {
      ready: '准备就绪',
      recording: '录制中',
      paused: '已暂停',
    },
  },
  recording: {
    controls: {
      start: '开始录制',
      stop: '停止录制',
      pause: '暂停',
      resume: '继续',
      preparing: '准备中...',
      stopping: '正在停止...',
    },
    settings: {
      title: '录制设置',
      mode: {
        title: '录制模式',
        fullscreen: '全屏',
        window: '窗口',
      },
      audio: {
        title: '音频源',
        none: '无音频',
        microphone: '麦克风',
        system: '系统声音',
        both: '麦克风 + 系统声音',
      },
      quality: {
        title: '视频质量',
        low: '低质量 (2Mbps, 15fps)',
        medium: '中等质量 (5Mbps, 30fps)',
        high: '高质量 (10Mbps, 60fps)',
      },
      format: {
        title: '输出格式',
        webm: 'WebM (原生支持)',
        mp4: 'MP4 (需要FFmpeg转换)',
        hint: '⚠️ MP4格式需要系统安装FFmpeg。如果转换失败，将保留WebM格式。',
      },
      saveDir: {
        title: '保存位置',
        select: '选择',
        default: '默认视频文件夹',
      },
      autoDownload: {
        title: '自动下载录制文件',
        hint: '关闭后录制完成时不会自动保存文件，而是提供手动下载按钮',
      },
    },
  },
  download: {
    title: '录制完成',
    actions: {
      edit: '编辑视频',
      download: '直接下载',
      cancel: '取消',
      downloading: '下载中...',
    },
    messages: {
      completed: '录制完成',
      saved: '录制已保存到',
    },
  },
  editor: {
    title: '视频编辑',
    preview: {
      original: '原始视频',
      cropped: '裁剪预览',
    },
    timeCrop: {
      title: '时间裁剪',
      start: '开始时间',
      end: '结束时间',
      duration: '裁剪后时长',
    },
    spaceCrop: {
      title: '空间裁剪',
      x: 'X坐标',
      y: 'Y坐标',
      width: '宽度',
      height: '高度',
      size: '裁剪尺寸',
      resetFull: '重置为全屏',
      centerSquare: '居中正方形',
    },
    processing: {
      analyzing: '正在分析视频...',
      processing: '正在处理视频...',
      cropping: '正在裁剪视频...',
      trimming: '正在裁剪时间...',
      croppingTime: '正在裁剪时间...',
      croppingSpace: '正在裁剪区域...',
      saving: '正在保存文件...',
      failed: '处理失败',
    },
    actions: {
      save: '保存视频',
      cancel: '取消',
    },
    help: {
      title: '操作提示',
      playPause: '播放/暂停',
      seek: '快进/快退5秒',
      save: '保存视频',
      cancel: '取消编辑',
      note: '💡 在原始视频模式下，可以拖拽裁剪框调整裁剪区域',
    },
  },
  shortcuts: {
    title: '快捷键：',
    startStop: '开始/停止',
    pauseResume: '暂停/继续',
  },
  messages: {
    recordingComplete: '录制完成',
    downloadComplete: '下载完成',
    openFolderFailed: '打开目录失败',
    recordingStartFailed: '开始录制失败(已静默)',
    recordingStopFailed: '停止录制失败(已静默)',
    videoSaveFailed: '视频保存失败(已静默)',
    videoEditFailed: '视频处理失败(已静默)',
    folderCreationWarning: '无法验证/创建保存目录，录制时将尝试保存并必要时回退至视频文件夹',
    initializationError: '初始化保存目录时出现问题',
  },
};

// 英文翻译
export const enUS: Translations = {
  common: {
    loading: 'Loading...',
    cancel: 'Cancel',
    confirm: 'Confirm',
    error: 'Error',
    success: 'Success',
    save: 'Save',
    edit: 'Edit',
    download: 'Download',
    ready: 'Ready',
    close: 'Close',
  },
  app: {
    title: '🎬 Screen Recorder',
    status: {
      ready: 'Ready',
      recording: 'Recording',
      paused: 'Paused',
    },
  },
  recording: {
    controls: {
      start: 'Start Recording',
      stop: 'Stop Recording',
      pause: 'Pause',
      resume: 'Resume',
      preparing: 'Preparing...',
      stopping: 'Stopping...',
    },
    settings: {
      title: 'Recording Settings',
      mode: {
        title: 'Recording Mode',
        fullscreen: 'Fullscreen',
        window: 'Window',
      },
      audio: {
        title: 'Audio Source',
        none: 'No Audio',
        microphone: 'Microphone',
        system: 'System Audio',
        both: 'Microphone + System Audio',
      },
      quality: {
        title: 'Video Quality',
        low: 'Low Quality (2Mbps, 15fps)',
        medium: 'Medium Quality (5Mbps, 30fps)',
        high: 'High Quality (10Mbps, 60fps)',
      },
      format: {
        title: 'Output Format',
        webm: 'WebM (Native Support)',
        mp4: 'MP4 (Requires FFmpeg Conversion)',
        hint: '⚠️ MP4 format requires FFmpeg installed on the system. If conversion fails, WebM format will be kept.',
      },
      saveDir: {
        title: 'Save Location',
        select: 'Select',
        default: 'Default Videos Folder',
      },
      autoDownload: {
        title: 'Auto-download recorded files',
        hint: 'When disabled, manual download button will be provided instead of auto-saving after recording',
      },
    },
  },
  download: {
    title: 'Recording Complete',
    actions: {
      edit: 'Edit Video',
      download: 'Direct Download',
      cancel: 'Cancel',
      downloading: 'Downloading...',
    },
    messages: {
      completed: 'Recording Complete',
      saved: 'Recording saved to',
    },
  },
  editor: {
    title: 'Video Editor',
    preview: {
      original: 'Original Video',
      cropped: 'Cropped Preview',
    },
    timeCrop: {
      title: 'Time Cropping',
      start: 'Start Time',
      end: 'End Time',
      duration: 'Cropped Duration',
    },
    spaceCrop: {
      title: 'Space Cropping',
      x: 'X Coordinate',
      y: 'Y Coordinate',
      width: 'Width',
      height: 'Height',
      size: 'Crop Size',
      resetFull: 'Reset to Fullscreen',
      centerSquare: 'Center Square',
    },
    processing: {
      analyzing: 'Analyzing video...',
      processing: 'Processing video...',
      cropping: 'Cropping video...',
      trimming: 'Trimming time...',
      croppingTime: 'Cropping time...',
      croppingSpace: 'Cropping area...',
      saving: 'Saving file...',
      failed: 'Processing failed',
    },
    actions: {
      save: 'Save Video',
      cancel: 'Cancel',
    },
    help: {
      title: 'Tips',
      playPause: 'Play/Pause',
      seek: 'Seek ±5 seconds',
      save: 'Save video',
      cancel: 'Cancel editing',
      note: '💡 In original video mode, you can drag the crop box to adjust the crop area',
    },
  },
  shortcuts: {
    title: 'Shortcuts:',
    startStop: 'Start/Stop',
    pauseResume: 'Pause/Resume',
  },
  messages: {
    recordingComplete: 'Recording Complete',
    downloadComplete: 'Download Complete',
    openFolderFailed: 'Failed to open folder',
    recordingStartFailed: 'Recording start failed (silenced)',
    recordingStopFailed: 'Recording stop failed (silenced)',
    videoSaveFailed: 'Video save failed (silenced)',
    videoEditFailed: 'Video processing failed (silenced)',
    folderCreationWarning: 'Cannot verify/create save directory, will try to save during recording and fallback to videos folder if necessary',
    initializationError: 'Error occurred during save directory initialization',
  },
};

// 支持的语言列表
export const supportedLanguages = {
  'zh-CN': { name: '中文', translations: zhCN },
  'en-US': { name: 'English', translations: enUS },
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;