# Screen Recording App

[中文版本 (Chinese Version)](README.md)

A modern desktop screen recording application built with Tauri + SvelteKit + TypeScript. Supports multiple recording modes, audio recording, high-quality video encoding, and more.

## ✨ Features

- **Multiple Recording Modes**
  - Full screen recording
  - Window recording
  - Custom area recording

- **Audio Recording**
  - Microphone audio
  - System audio
  - Mixed audio (Microphone + System)

- **High-Quality Encoding**
  - Support for VP8/VP9 video encoding
  - Configurable frame rate and bitrate
  - WebM format output

- **Real-time Control**
  - Start/Pause/Resume/Stop recording
  - Real-time recording duration display
  - Auto-save to video directory

- **User-Friendly**
  - Modern interface design
  - Intuitive recording controls
  - Error handling and user prompts

## 🚀 Installation & Usage

### System Requirements

- Windows 10/11, macOS 10.15+ or Linux
- Modern browser environment with WebRTC support

### Installation Steps

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
   # Development mode
   npm run tauri dev

   # Build production version
   npm run tauri build
   ```

## 📖 User Guide

### Starting Recording

1. After launching the app, click the "Start Recording" button
2. Select recording mode:
   - **Full Screen**: Record the entire screen
   - **Window**: Select a specific application window
   - **Area**: Custom recording area
3. Configure audio settings (optional):
   - No audio
   - Microphone only
   - System audio only
   - Microphone + System audio
4. Click "Start" to begin recording

### Recording Controls

- **Pause/Resume**: Pause or resume current recording
- **Stop**: End recording and auto-save file
- **Duration Display**: Real-time recording duration display

### Output Files

After recording completion, files will be automatically saved to:
- Windows: `Videos` folder
- macOS: `Movies` folder
- Linux: `Videos` folder

File name format: `ScreenRecording_YYYY-MM-DD_HH-MM-SS.webm`

## 🛠️ Development Notes

### Project Structure

```
src/
├── lib/
│   ├── recorder/
│   │   └── ScreenRecorder.ts    # Core recording functionality
│   └── stores/
│       └── recording.ts         # Recording state management
├── routes/
│   └── +page.svelte            # Main interface
└── app.html                     # HTML template

src-tauri/
├── src/
│   ├── main.rs                 # Tauri main entry
│   └── lib.rs                  # Tauri library file
└── tauri.conf.json             # Tauri configuration
```

### Development Commands

```bash
# Start development server
npm run dev

# Type checking
npm run check

# Build application
npm run build

# Run Tauri development environment
npm run tauri dev
```

### Core Technology Stack

- **Frontend**: SvelteKit 5.0, TypeScript 5.6
- **Desktop**: Tauri 2.0 (Rust)
- **Build**: Vite 6.0
- **Styling**: Modern CSS

## 🤝 Contribution Guide

Welcome to contribute code to the project! Please follow these steps:

1. Fork the project repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

### Development Standards

- Write code using TypeScript
- Follow existing code style
- Add appropriate comments for new features
- Ensure all tests pass

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

**Note**: On first use, the browser may request screen recording permissions. Please ensure the application has access to screen and audio.