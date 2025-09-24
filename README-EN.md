# Screen Recording App

> Current Version: **v0.5.0** (In active iteration; APIs/behavior may change)

[中文版本 (Chinese Version)](README.md)

A modern desktop screen recording application built with **Tauri 2 + SvelteKit 5 + TypeScript**. Supports multiple capture modes, audio sources, high-quality encoding, lightweight in-app trimming/cropping, persistent settings, and configurable global shortcuts. Focused on “start recording fast → lightweight edit → export immediately”.

## ✨ Features

- **Multiple Recording Modes**
   - Full screen (fullscreen)
   - Window (window)
   - (Custom region planned; UI work in progress)

- **Audio Recording**
   - Microphone
   - System audio (must tick “share system audio” in selection dialog)
   - Mixed (Microphone + System)

- **High-Quality Encoding**
   - VP8 / VP9 (WebM)
   - H.264 (MP4 via post FFmpeg conversion)
   - Configurable frame rate / video bitrate / audio bitrate
   - Quality presets: low / medium / high / custom (maps preset → bitrate & fps)

- **Built-in Video Editor**
   - Time trimming (start/end)
   - Spatial crop
   - Thumbnail generation (internal API)
   - Real-time preview + export
   - (Planned: multi-clip merge / text watermark / cursor highlight)

- **Real-time Control**
   - Start / Pause / Resume / Stop
   - Elapsed duration (HH:MM:SS)
   - Auto-save (autoDownload=true) OR enter editor (autoDownload=false)

- **Settings & Persistence**
   - Preferences (codec, folder, format, quality preset, shortcuts) saved to `settings.json`
   - Custom output directory (auto fallback to system Videos folder on permission errors)

- **Global Shortcuts (configurable)**
   - Start/Stop: `Ctrl+Alt+R`
   - Pause/Resume: `Ctrl+Alt+P`

- **Robust Error / Fallbacks**
   - Unified error codes (init failure / permission denied / unsupported mime)
   - MP4 conversion failure → keep WebM
   - Directory invalid → fallback to system videos dir

- **Performance & Monitoring**
   - Optional memory watcher (>85% heap usage warning)
   - 30 / 60 FPS capture (dependent on system & browser capabilities)

- **Security**
   - Uses native browser permission prompts only; no persistent sensitive permission storage
   - Local file write only (Tauri fs plugin)

## 🚀 Installation & Usage

### System Requirements

- Windows 10/11, macOS 10.15+, or mainstream Linux
- WebRTC capable runtime (Tauri embedded WebView2 / WKWebView / WebKit)
- **MP4 output**: Install [FFmpeg](https://ffmpeg.org/download.html) and add to PATH
- Up-to-date GPU drivers recommended for stable capture

### Installation Steps (Development)

1. **Clone the project**
   ```bash
   git clone https://github.com/zym9863/screen-recording.git
   cd screen-recording
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or use pnpm
   pnpm install
   ```

3. **Run the application**
   ```bash
   # Launch desktop (frontend + Tauri)
   npm run tauri dev

   # Frontend only (web) dev & preview
   npm run dev
   npm run preview

   # Build production desktop bundles
   npm run tauri build
   ```

### Distribution (Packaging)

Artifacts located under `src-tauri/target/release/` after build (platform dependent structure).

## 📖 User Guide

### Starting Recording

1. After launching the app, click the "Start Recording" button
2. Select recording mode:
   - **Full Screen**: Entire screen
   - **Window**: Specific window
   - **Area**: Coming soon (currently hidden or experimental)
3. Configure audio settings (optional):
   - No audio
   - Microphone only
   - System audio only
   - Microphone + System audio
4. Select output format:
   - **WebM**: Native support, no additional software required
   - **MP4**: Requires FFmpeg, better quality and compatibility
5. Configure auto-download setting:
   - **Auto-download ON**: Recording automatically saves when stopped
   - **Auto-download OFF**: Access built-in video editor after recording
6. Click "Start" to begin recording

### Recording Controls

- **Pause/Resume**: Pause or resume current recording
- **Stop**: End recording and process file
- **Duration Display**: Real-time recording duration display

### Video Editing (When Auto-download is OFF)

When auto-download is disabled, you'll access the built-in video editor after stopping a recording:

1. **Video Preview**: Review your recording with playback controls
2. **Time Trimming**: Use sliders to set start and end times
3. **Spatial Cropping**: Drag rectangle (non-destructive; export creates a new file)
4. **Real-time Preview**: See effects before saving
5. **Save Options**: Process and save edited video

### Output Files

After recording completion, files will be automatically saved to:
- Windows: `Videos` folder
- macOS: `Movies` folder
- Linux: `Videos` folder

Supported output formats:
- **WebM**: `ScreenRecording_YYYY-MM-DD_HH-MM-SS.webm`
- **MP4**: `ScreenRecording_YYYY-MM-DD_HH-MM-SS.mp4`

> **Note**: MP4 conversion occurs post-recording via a Tauri backend FFmpeg call. Failure keeps original WebM.

#### Naming Strategy

- Based on ISO timestamp (colons & ms removed), e.g. `ScreenRecording_2025-09-24_10-21-33.webm`
- Edited exports may reuse name; future enhancement: append `-edited`

### FFmpeg Installation Guide

#### Windows
1. Go to the [FFmpeg official website](https://ffmpeg.org/download.html) to download the Windows version
2. Extract to any directory (e.g., `C:\ffmpeg`)
3. Add `C:\ffmpeg\bin` to the system PATH environment variable
4. Restart the application to use MP4 format

#### macOS
```bash
# Install using Homebrew
brew install ffmpeg
```

#### Linux (Ubuntu/Debian)
```bash
# Install using package manager
sudo apt update
sudo apt install ffmpeg
```

## 🛠️ Development Notes

### Project Structure (Simplified)

```
src/
├── lib/
│   ├── recorder/
│   │   └── ScreenRecorder.ts    # Core recording functionality
│   ├── stores/
│   │   └── recording.ts         # Recording state management
│   └── components/
│       └── VideoEditor.svelte   # Built-in video editor
├── routes/
│   └── +page.svelte            # Main interface
└── app.html                     # HTML template

src-tauri/
├── src/
│   ├── main.rs                 # Tauri main entry
│   └── lib.rs                  # Tauri library file
└── tauri.conf.json             # Tauri configuration
```

### Scripts & Commands

```bash
# Frontend (web) only dev
npm run dev

# Type checking (includes svelte-kit sync)
npm run check

# Run unit tests
npm test
# Interactive/UI mode
npm run test:ui

# Build static frontend (output to build/)
npm run build

# Desktop dev (Tauri + frontend)
npm run tauri dev

# Package desktop installers
npm run tauri build
```

### Unit Testing

Powered by `vitest + jsdom`. Current coverage focuses on core logic (e.g., `ScreenRecorder`).

Run tests:

```bash
npm test
```

Coverage:

```bash
npm run test -- --coverage
```

### Core Technology Stack

- **Frontend**: SvelteKit 5, Svelte 5, TypeScript 5.6
- **Desktop**: Tauri 2 (Rust)
- **Build**: Vite 6
- **Testing**: Vitest + jsdom
- **Persistence**: @tauri-apps/plugin-store
- **File/Dir Access**: @tauri-apps/plugin-fs
- **Shortcuts**: @tauri-apps/plugin-global-shortcut
- **Other**: WebRTC / MediaRecorder / Canvas

### Known Limitations

- Region capture UI pending (currently fullscreen/window only)
- System audio capture stability varies (Linux may need PipeWire / PulseAudio config)
- macOS: first run requires Screen Recording permission in System Settings
- High resolution + 60 FPS + VP9 can be CPU intensive
- Trimming/Cropping re-encodes via Canvas + MediaRecorder (long videos take extra time)
- MP4 export depends on FFmpeg (adds post-processing time)
- No explicit hardware acceleration toggle yet (future: custom FFmpeg params / GPU encode)

### Performance Tips

| Scenario | Recommendation |
| -------- | -------------- |
| High CPU usage | Lower FPS (60 → 30) or switch to VP8 |
| Large file size | Lower videoBitrate or trim before export |
| A/V desync | Record single audio source first; ensure system audio enabled in share dialog |
| Slow MP4 conversion | Stick with WebM first; batch convert externally later |

### Roadmap

- [ ] Region capture overlay
- [ ] Multi-clip merge / segment delete
- [ ] Cursor highlight / click ripple
- [ ] Text / shape / watermark overlay
- [ ] Custom FFmpeg params (HW acceleration)
- [ ] Tray quick controls
- [ ] Crash logs & opt-in telemetry
- [ ] Extended i18n (current: en / zh)

### FAQ

**Q: Why not record MP4 directly?**  
`MediaRecorder` MP4 support is limited across desktop stacks; strategy: record WebM → optional FFmpeg H.264 conversion.

**Q: System audio not captured?**  
Ensure “share system audio” checkbox was selected. Some platforms (esp. Linux) may not support or need extra config.

**Q: Editor didn’t appear after stopping?**  
Check setting: `autoDownload` must be false to enter editing workflow.

**Q: Exported file corrupted?**  
Likely memory or long re-encode interruption—try shorter duration or lower resolution.

**Q: How to change shortcuts?**  
Will expose UI soon; currently edit defaults in `recording.ts` then rebuild.

**Q: Timed / scheduled recording?**  
Not yet; planned (countdown & schedule module).

## 🤝 Contribution Guide

Welcome to contribute code to the project! Please follow these steps:

1. Fork the project repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

### Development Standards

- Use TypeScript (frontend) & minimal Rust surface
- Follow existing style (future lint config may enforce)
- Add function-level comments for public APIs (e.g., `ScreenRecorder` methods)
- Add / update Vitest tests (≥1 happy path)
- Provide PR description + screenshot/GIF of UI changes
- Justify new dependencies (size/security impact)

### Security & Privacy

- No upload of recordings (local-first design)
- No telemetry by default (future telemetry will be opt-in)
- Review licenses & sources for added dependencies

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issue Reporting

If you encounter problems or have suggestions, please:

1. Check the [Issues](https://github.com/zym9863/screen-recording/issues) page
2. If no related issue exists, create a new Issue
3. Provide detailed error information and reproduction steps

## 🙏 Acknowledgments

Thanks to the following open-source projects for their support:

- [Tauri](https://tauri.app/) - Build safer, faster desktop applications
- [SvelteKit](https://kit.svelte.dev/) - Web application framework
- [WebRTC](https://webrtc.org/) - Real-time communication technology

---

**Note**: First launch may trigger OS / browser prompts for Screen & Microphone permissions. On macOS grant via System Settings > Privacy & Security.

---

If this project helps you, consider starring ⭐ / filing Issues / sending PRs!