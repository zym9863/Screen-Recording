use tauri::{AppHandle, Manager, State, Emitter};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tracing::{info, error};

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
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
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
            if let TrayIconEvent::Click { .. } = event {
                if let Some(app) = tray.app_handle().get_webview_window("main") {
                    if app.is_visible().unwrap_or(false) {
                        let _ = app.hide();
                    } else {
                        let _ = app.show();
                        let _ = app.set_focus();
                    }
                }
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
            update_recording_status
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
