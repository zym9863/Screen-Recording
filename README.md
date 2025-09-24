# 屏幕录制应用 (Screen Recording App)

> 当前版本: **v0.5.0** （迭代中，接口与行为可能仍会有调整）

[English Version](README-EN.md)

一个现代化的桌面屏幕录制应用，基于 **Tauri 2 + SvelteKit 5 + TypeScript** 构建。支持多种录制模式、音频录制、高质量编码、内置视频剪辑与裁剪、持久化设置与快捷键。专注“快速开始录制 + 轻量编辑 + 即时导出”。

## ✨ 功能特性

- **多种录制模式**
   - 全屏录制 (fullscreen)
   - 窗口录制 (window)
   - （区域录制 roadmap 中，前端 UI 准备中）

- **音频录制**
   - 麦克风音频
   - 系统音频（需在浏览器/系统选择共享系统音频）
   - 混合音频（麦克风 + 系统）

- **高质量编码**
   - VP8 / VP9（WebM）
   - H.264（MP4，需 FFmpeg 二次转换）
   - 可配置帧率 / 视频比特率 / 音频比特率
   - 质量预设：low / medium / high / custom（自动匹配帧率与码率）

- **内置视频编辑器**
   - 时间裁剪（Trim）
   - 空间裁剪（Crop）
   - 截图 / 生成缩略图（内部 API 支撑）
   - 实时预览 + 二次导出
   - （后续：多段拼接 / 文本水印 / 光标高亮）

- **实时控制**
   - 开始 / 暂停 / 恢复 / 停止
   - 实时时长显示（HH:MM:SS）
   - 自动保存（autoDownload=true）或进入编辑器（autoDownload=false）

- **设置与持久化**
   - 设置（编码、目录、格式、质量预设、快捷键）自动保存到 `settings.json`
   - 自定义保存目录（不可用时自动回退到系统视频目录）

- **快捷键 (可配置)**
   - 开始/停止录制：默认 `Ctrl+Alt+R`
   - 暂停/恢复：默认 `Ctrl+Alt+P`

- **错误处理与回退**
   - 统一错误码（初始化失败 / 权限拒绝 / 不支持的编码等）
   - MP4 转换失败自动保留 WebM
   - 目录无权限自动回退默认视频目录

- **性能与监控**
   - 可选内存监控（>85% 提醒）
   - 30 / 60 FPS 捕获（取决于系统与浏览器支持）

- **安全性**
   - 基于浏览器原生权限弹窗 / 不持久化敏感媒体权限
   - 仅本地文件写入（Tauri 插件 fs）

## 🚀 安装使用

### 系统要求

- Windows 10/11、macOS 10.15+ 或主流 Linux 发行版
- 支持 WebRTC 的运行环境（Tauri 内嵌 WebView2 / WKWebView / WebKit）
- **MP4 输出**：安装 [FFmpeg](https://ffmpeg.org/download.html) 并加入 PATH
- 推荐显卡驱动更新（提升捕获流稳定性）

### 安装步骤（开发环境）

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
   # 启动前端 + Tauri (开发调试)
   npm run tauri dev

   # 单独前端预览（仅 Web，不含桌面特性）
   npm run dev
   npm run preview

   # 构建生产安装包
   npm run tauri build
   ```

### 发行版（打包）

打包完成后，安装包与二进制位于 `src-tauri/target/release/`（不同平台结构不同）。

## 📖 使用指南

### 开始录制

1. 启动应用后，点击"开始录制"按钮
2. 选择录制模式：
   - **全屏**：录制整个屏幕
   - **窗口**：选择特定窗口
   - **区域**：即将支持（当前 UI 隐藏 / 若已启用可能为实验性）
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
3. **空间裁剪**：拖拽定义矩形裁剪区域（不会改变原始文件，导出生成新文件）
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

> **注意**: MP4 转换在前端录制完成后由 Tauri 后端调用 FFmpeg 进行。失败将回退原始 WebM。

#### 文件命名策略

- 基于 ISO 时间戳（去除冒号与毫秒），示例：`ScreenRecording_2025-09-24_10-21-33.webm`
- 若用户手动编辑后导出，可复用原文件名或追加后缀（未来将支持 `-edited` 规则）

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

### 项目结构（简化）

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

### 脚本与开发命令

```bash
# 运行前端开发（纯网页）
npm run dev

# 运行类型检查（包含 svelte-kit sync）
npm run check

# 运行单元测试
npm test
# 或交互 UI 模式
npm run test:ui

# 打包前端（静态产物输出到 build/）
npm run build

# 启动 Tauri 桌面开发（含前端）
npm run tauri dev

# 构建桌面安装包
npm run tauri build
```

### 单元测试

使用 `vitest + jsdom`。当前主要覆盖基础逻辑（例如 `ScreenRecorder` 行为）。

快速运行：

```bash
npm test
```

生成覆盖率：

```bash
npm run test -- --coverage
```

### 核心技术栈

- **前端**: SvelteKit 5, Svelte 5, TypeScript 5.6
- **桌面**: Tauri 2 (Rust)
- **构建**: Vite 6
- **测试**: Vitest + jsdom
- **持久化**: @tauri-apps/plugin-store
- **文件/目录**: @tauri-apps/plugin-fs
- **快捷键**: @tauri-apps/plugin-global-shortcut
- **其他**: WebRTC / MediaRecorder / Canvas

### 已知限制 / 注意事项

- 区域录制目前为规划功能，代码中主要支持全屏 / 窗口
- 某些 Linux 发行版对系统音频捕获不稳定（需 PipeWire / PulseAudio 正确配置）
- macOS 初次录制需在 系统偏好设置 > 隐私 与安全性 中授予“屏幕录制”权限
- 高分辨率 + 高帧率 + VP9 时 CPU 占用会显著上升
- 空间裁剪/时间裁剪采用二次转码（Canvas + MediaRecorder），长视频会增加处理时间
- MP4 输出依赖 FFmpeg 重编码（额外耗时）
- 目前不内置硬件加速开关（后续评估集成 GPU 加速/FFmpeg 自定义参数）

### 性能优化建议

| 场景 | 建议 |
| ---- | ---- |
| CPU 占用高 | 降低帧率 (60 -> 30) 或改用 VP8 |
| 文件过大 | 降低 videoBitrate 或使用时间裁剪后导出 |
| 音画不同步 | 关闭混合音频测试单一来源；确保系统音频在共享弹窗中启用 |
| 转换慢 | 避免立即转 MP4，先使用 WebM；批量转换由外部脚本完成 |

### Roadmap

- [ ] 区域录制 UI（拖拽遮罩）
- [ ] 多段拼接 / 片段删除
- [ ] 光标高亮 / 点击涟漪效果
- [ ] 文本 / 形状 / 水印叠加
- [ ] 自定义 FFmpeg 参数（硬件编码）
- [ ] 托盘菜单快速控制
- [ ] Crash 日志与问题收集（可选开关）
- [ ] i18n 多语言完善（当前：中/英）

### FAQ

**Q: 为什么没有 MP4 直接录制？**  
MediaRecorder 在多数桌面环境下对 `video/mp4` 支持有限，因此采取 “录制 WebM -> 可选 FFmpeg 转换 H.264 MP4” 方案。

**Q: 系统音频捕获失败？**  
请在屏幕共享选择框中勾选“共享系统音频”。部分平台（尤其 Linux）可能暂不支持或需要额外权限。

**Q: 录制结束后没有进入编辑器？**  
检查设置：`autoDownload` 是否为 true。关闭后才会进入内置编辑流程。

**Q: 导出后文件损坏？**  
可能是浏览器或内存不足导致裁剪二次编码中断，尝试降低分辨率/时长或关闭其他高负载应用。

**Q: 如何自定义快捷键？**  
后续将在设置面板中暴露快捷键表单；当前可在 `recording.ts` 默认值中修改并重新构建。

**Q: 可以做延时录制/定时开始吗？**  
暂不支持，计划在后续版本加入定时与倒计时模块。

## 🤝 贡献指南

欢迎为项目贡献代码！请遵循以下步骤：

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 使用 TypeScript 编写代码（前端 + Rust 侧命令保持最小接口面）
- 遵循现有 ESLint / 格式配置（若后续添加）
- 公共 API / 类（例如 `ScreenRecorder`）添加函数级注释
- 添加或更新 Vitest 测试（最少 1 个 happy path）
- 提供变更说明（PR 描述 + 截图/GIF）
- 新增依赖需说明理由与体积/安全影响

### 安全 & 隐私

- 不上传录制数据到远程（设计保持本地优先）
- 不采集用户隐私指标（未来若添加需可关闭）
- 审核外部贡献的依赖来源与许可证

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

**注意**: 首次使用时，系统/浏览器可能会请求屏幕录制 & 麦克风权限，请确保允许。macOS 需到 系统设置 > 隐私与安全性 中勾选应用。

---

如果这个项目对你有帮助，欢迎 Star ⭐ / Issue / PR！