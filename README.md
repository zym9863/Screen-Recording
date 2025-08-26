# 屏幕录制应用 (Screen Recording App)

[English Version](README-EN.md)

一个现代化的桌面屏幕录制应用，基于 Tauri + SvelteKit + TypeScript 构建。支持多种录制模式、音频录制、高质量视频编码等功能。

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
  - 可配置帧率和比特率
  - WebM 格式输出

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
4. 点击"开始"开始录制

### 录制控制

- **暂停/恢复**：暂停或恢复当前录制
- **停止**：结束录制并自动保存文件
- **时长显示**：实时显示录制时长

### 输出文件

录制完成后，文件将自动保存到：
- Windows: `视频` 文件夹
- macOS: `Movies` 文件夹
- Linux: `Videos` 文件夹

文件名格式：`ScreenRecording_YYYY-MM-DD_HH-MM-SS.webm`

## 🛠️ 开发说明

### 项目结构

```
src/
├── lib/
│   ├── recorder/
│   │   └── ScreenRecorder.ts    # 核心录制功能
│   └── stores/
│       └── recording.ts         # 录制状态管理
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