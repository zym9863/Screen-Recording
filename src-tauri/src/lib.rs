use tauri::{AppHandle, Manager, State, Emitter};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::process::Command;
use std::path::Path;
use tracing::{info, error, warn};

/// 录制状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingStatus {
    Idle,
    Recording,
    Paused,
}

/// 应用状态
#[derive(Debug)]
pub struct AppState {
    recording_status: Mutex<RecordingStatus>,
    is_recording: Mutex<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            recording_status: Mutex::new(RecordingStatus::Idle),
            is_recording: Mutex::new(false),
        }
    }
}

/// 通知前端开始录制
#[tauri::command]
fn start_recording(app: AppHandle) -> Result<(), String> {
    info!("开始录制命令被调用");
    app.emit("recording:start", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 通知前端停止录制
#[tauri::command]
fn stop_recording(app: AppHandle) -> Result<(), String> {
    info!("停止录制命令被调用");
    app.emit("recording:stop", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 通知前端暂停录制
#[tauri::command]
fn pause_recording(app: AppHandle) -> Result<(), String> {
    info!("暂停录制命令被调用");
    app.emit("recording:pause", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 通知前端继续录制
#[tauri::command]
fn resume_recording(app: AppHandle) -> Result<(), String> {
    info!("继续录制命令被调用");
    app.emit("recording:resume", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 更新录制状态
#[tauri::command]
fn update_recording_status(state: State<AppState>, status: String) -> Result<(), String> {
    let new_status = match status.as_str() {
        "idle" => RecordingStatus::Idle,
        "recording" => RecordingStatus::Recording,
        "paused" => RecordingStatus::Paused,
        _ => return Err("无效的状态".to_string()),
    };

    let mut recording_status = state.recording_status.lock()
        .map_err(|e| e.to_string())?;
    *recording_status = new_status.clone();

    let mut is_recording = state.is_recording.lock()
        .map_err(|e| e.to_string())?;
    *is_recording = matches!(new_status, RecordingStatus::Recording | RecordingStatus::Paused);

    info!("录制状态更新为: {:?}", new_status);
    Ok(())
}

/// 退出应用
#[tauri::command]
fn exit_app(app: AppHandle) -> Result<(), String> {
    info!("收到退出应用的请求");
    app.exit(0);
    Ok(())
}

/// 将WebM文件转换为MP4格式
#[tauri::command]
async fn convert_to_mp4(input_path: String, output_path: String) -> Result<String, String> {
    info!("开始转换 {} 到 {}", input_path, output_path);
    
    // 检查输入文件是否存在
    if !Path::new(&input_path).exists() {
        return Err(format!("输入文件不存在: {}", input_path));
    }

    // 尝试使用系统的FFmpeg
    let result = tokio::task::spawn_blocking(move || {
        // 首先尝试使用ffmpeg命令
        let output = Command::new("ffmpeg")
            .args([
                "-i", &input_path,
                "-c:v", "libx264",       // H.264视频编码
                "-c:a", "aac",           // AAC音频编码  
                "-preset", "fast",       // 编码预设
                "-crf", "23",           // 质量控制
                "-movflags", "+faststart", // 优化Web播放
                "-y",                   // 覆盖输出文件
                &output_path
            ])
            .output();

        match output {
            Ok(output) if output.status.success() => {
                info!("FFmpeg转换成功完成");
                
                // 转换成功后删除原WebM文件
                if let Err(e) = std::fs::remove_file(&input_path) {
                    warn!("删除原WebM文件失败: {}", e);
                }
                
                Ok(output_path.clone())
            },
            Ok(output) => {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                error!("FFmpeg转换失败: {}", error_msg);
                Err(format!("FFmpeg转换失败: {}", error_msg))
            },
            Err(e) => {
                error!("无法执行FFmpeg命令: {}", e);
                // 尝试提供更友好的错误信息
                if e.kind() == std::io::ErrorKind::NotFound {
                    Err("FFmpeg未安装或不在系统PATH中。请安装FFmpeg以支持MP4格式转换。".to_string())
                } else {
                    Err(format!("FFmpeg执行错误: {}", e))
                }
            }
        }
    }).await;

    match result {
        Ok(conversion_result) => conversion_result,
        Err(e) => Err(format!("异步任务错误: {}", e))
    }
}

/// 恢复并激活主窗口
///
/// 功能：
/// - 如果窗口被最小化或不可见，则取消最小化、显示并聚焦。
/// - 同步调整任务栏显示，避免被隐藏后无法在任务栏找到的情况。
///
/// 返回：
/// - Ok(()) 表示已尝试恢复（不保证每一步都成功，但已忽略非关键错误）。
fn restore_main_window(app: &AppHandle) -> Result<(), ()> {
    if let Some(window) = app.get_webview_window("main") {
        // 尽力确保任务栏可见
        let _ = window.set_skip_taskbar(false);

        let is_minimized = window.is_minimized().unwrap_or(false);
        let is_visible = window.is_visible().unwrap_or(false);

        if is_minimized {
            let _ = window.unminimize();
        }

        if !is_visible {
            let _ = window.show();
        }

        // 再次确保显示后获取焦点
        let _ = window.set_focus();
        Ok(())
    } else {
        Err(())
    }
}

/// 初始化系统托盘
fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let tray_menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "start_stop", "开始录制", true, None::<&str>)?,
            &MenuItem::with_id(app, "pause_resume", "暂停录制", false, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "show_window", "显示主窗口", true, None::<&str>)?,
            &MenuItem::with_id(app, "open_folder", "打开保存目录", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&tray_menu)
        .tooltip("屏幕录制工具")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "start_stop" => {
                    let _ = app.emit("tray:start_stop", ());
                }
                "pause_resume" => {
                    let _ = app.emit("tray:pause_resume", ());
                }
                "show_window" => {
                    let _ = restore_main_window(app);
                }
                "open_folder" => {
                    let _ = app.emit("tray:open_folder", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // 左键点击：统一行为为“恢复并激活主窗口”（不再切换隐藏），
            // 避免窗口处于最小化时被误判为可见而进一步 hide()
            if let TrayIconEvent::Click { .. } = event {
                let _ = restore_main_window(&tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// 注册全局快捷键
fn register_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcuts = app.global_shortcut();
    
    // Ctrl+Alt+R: 开始/停止录制
    shortcuts.on_shortcut("Ctrl+Alt+R", move |app, _shortcut, _event| {
        info!("快捷键 Ctrl+Alt+R 被触发");
        let _ = app.emit("shortcut:toggle_recording", ());
    })?;
    
    // Ctrl+Alt+P: 暂停/继续录制
    shortcuts.on_shortcut("Ctrl+Alt+P", move |app, _shortcut, _event| {
        info!("快捷键 Ctrl+Alt+P 被触发");
        let _ = app.emit("shortcut:toggle_pause", ());
    })?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into())
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            pause_recording,
            resume_recording,
            update_recording_status,
            exit_app,
            convert_to_mp4
        ])
        .setup(|app| {
            // 设置托盘
            if let Err(e) = setup_tray(app.handle()) {
                error!("设置托盘失败: {}", e);
            }
            
            // 注册全局快捷键
            if let Err(e) = register_shortcuts(app.handle()) {
                error!("注册快捷键失败: {}", e);
            }
            
            // 处理窗口关闭事件 - 最小化到托盘
            let main_window = app.get_webview_window("main").unwrap();
            main_window.clone().on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // 阻止默认关闭行为
                    api.prevent_close();
                    
                    // 获取应用状态
                    if let Some(app_handle) = main_window.app_handle().try_state::<AppState>() {
                        let is_recording = app_handle.is_recording.lock().unwrap();
                        if *is_recording {
                            // 录制中，隐藏窗口到托盘
                            let _ = main_window.set_skip_taskbar(true);
                            let _ = main_window.hide();
                            info!("录制中，窗口已最小化到托盘");
                        } else {
                            // 未录制，询问是否退出
                            let _ = main_window.emit("window:close_requested", ());
                        }
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
