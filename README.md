# 屏幕录制应用 (Screen Recording App)

[English Version](README-EN.md)

一个现代化的桌面屏幕录制应用，基于 Tauri + SvelteKit + TypeScript 构建。支持多种录制模式、音频录制、高质量视频编码、内置视频编辑功能等。

## ✨ 功能特性

- **多种录制模式**
  - 全屏录制
  - 窗口录制
  - 自定义区域录制

- **音频录制**
  - 麦克风音频
  - 系统音频
  - 混合音频（麦克风 + 系统）

- **高质量编码**
  - 支持 VP8/VP9 视频编码
  - 支持 H.264 视频编码（MP4格式）
  - 可配置帧率和比特率
  - WebM 和 MP4 格式输出

- **内置视频编辑器**
  - 基于时间的裁剪（开始/结束时间选择）
  - 基于空间的裁剪（自定义矩形区域）
  - 实时预览编辑效果
  - 直观的可视化控制

- **实时控制**
  - 开始/暂停/恢复/停止录制
  - 实时录制时长显示
  - 自动保存到视频目录

- **用户友好**
  - 现代化的界面设计
  - 直观的录制控制
  - 错误处理和用户提示

## 🚀 安装使用

### 系统要求

- Windows 10/11、macOS 10.15+ 或 Linux
- 支持 WebRTC 的现代浏览器环境
- **MP4格式输出**：需要安装 [FFmpeg](https://ffmpeg.org/download.html) 并添加到系统 PATH

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/zym9863/screen-recording.git
   cd screen-recording
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或者使用 pnpm
   pnpm install
   ```

3. **运行应用**
   ```bash
   # 开发模式
   npm run tauri dev

   # 构建生产版本
   npm run tauri build
   ```

## 📖 使用指南

### 开始录制

1. 启动应用后，点击"开始录制"按钮
2. 选择录制模式：
   - **全屏**：录制整个屏幕
   - **窗口**：选择特定应用程序窗口
   - **区域**：自定义录制区域
3. 配置音频设置（可选）：
   - 无音频
   - 仅麦克风
   - 仅系统音频
   - 麦克风 + 系统音频
4. 选择输出格式：
   - **WebM**：原生支持，无需额外软件
   - **MP4**：需要FFmpeg，质量更好兼容性更强
5. 配置自动下载设置：
   - **自动下载开启**：停止录制时自动保存
   - **自动下载关闭**：录制后进入内置视频编辑器
6. 点击"开始"开始录制

### 录制控制

- **暂停/恢复**：暂停或恢复当前录制
- **停止**：结束录制并处理文件
- **时长显示**：实时显示录制时长

### 视频编辑（当自动下载关闭时）

当自动下载关闭时，停止录制后将进入内置视频编辑器：

1. **视频预览**：使用播放控制查看录制内容
2. **时间裁剪**：使用滑块设置开始和结束时间
3. **空间裁剪**：拖拽定义自定义录制区域
4. **实时预览**：保存前查看编辑效果
5. **保存选项**：处理并保存编辑后的视频

### 输出文件

录制完成后，文件将自动保存到：
- Windows: `视频` 文件夹
- macOS: `Movies` 文件夹  
- Linux: `Videos` 文件夹

支持的输出格式：
- **WebM**: `ScreenRecording_YYYY-MM-DD_HH-MM-SS.webm`
- **MP4**: `ScreenRecording_YYYY-MM-DD_HH-MM-SS.mp4`

> **注意**: MP4格式转换需要FFmpeg。如果FFmpeg未安装或转换失败，将保留WebM格式。

### FFmpeg 安装指南

#### Windows
1. 前往 [FFmpeg官网](https://ffmpeg.org/download.html) 下载Windows版本
2. 解压到任意目录（如 `C:\ffmpeg`）
3. 将 `C:\ffmpeg\bin` 添加到系统PATH环境变量
4. 重启应用即可使用MP4格式

#### macOS
```bash
# 使用 Homebrew 安装
brew install ffmpeg
```

#### Linux (Ubuntu/Debian)
```bash
# 使用包管理器安装
sudo apt update
sudo apt install ffmpeg
```

## 🛠️ 开发说明

### 项目结构

```
src/
├── lib/
│   ├── recorder/
│   │   └── ScreenRecorder.ts    # 核心录制功能
│   ├── stores/
│   │   └── recording.ts         # 录制状态管理
│   └── components/
│       └── VideoEditor.svelte   # 内置视频编辑器
├── routes/
│   └── +page.svelte            # 主界面
└── app.html                     # HTML 模板

src-tauri/
├── src/
│   ├── main.rs                 # Tauri 主入口
│   └── lib.rs                  # Tauri 库文件
└── tauri.conf.json             # Tauri 配置
```

### 开发命令

```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run check

# 构建应用
npm run build

# 运行 Tauri 开发环境
npm run tauri dev
```

### 核心技术栈

- **前端**: SvelteKit 5.0, TypeScript 5.6
- **桌面**: Tauri 2.0 (Rust)
- **构建**: Vite 6.0
- **样式**: 现代化 CSS

## 🤝 贡献指南

欢迎为项目贡献代码！请遵循以下步骤：

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 使用 TypeScript 编写代码
- 遵循现有的代码风格
- 为新功能添加适当的注释
- 确保所有测试通过

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🐛 问题反馈

如果您遇到问题或有建议，请：

1. 查看 [Issues](https://github.com/zym9863/screen-recording/issues) 页面
2. 如果没有相关问题，创建一个新的 Issue
3. 提供详细的错误信息和复现步骤

## 🙏 致谢

感谢以下开源项目的支持：

- [Tauri](https://tauri.app/) - 构建更安全、更快的桌面应用
- [SvelteKit](https://kit.svelte.dev/) - Web 应用框架
- [WebRTC](https://webrtc.org/) - 实时通信技术

---

**注意**: 首次使用时，浏览器可能会请求屏幕录制权限，请确保允许应用访问屏幕和音频。