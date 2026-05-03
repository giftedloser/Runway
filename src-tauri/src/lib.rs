use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use rand::RngCore;
use tauri::path::BaseDirectory;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const API_HOST: &str = "127.0.0.1";
const API_PORT: &str = "3001";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct BackendState(Mutex<Option<Child>>);
struct DesktopApiToken(String);

fn create_desktop_api_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[tauri::command]
fn get_desktop_api_token(token: tauri::State<'_, DesktopApiToken>) -> String {
    token.0.clone()
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://"))
        || url.chars().any(|character| character.is_control())
    {
        return Err("Only http and https URLs can be opened externally.".to_string());
    }

    let mut command = if cfg!(target_os = "windows") {
        let mut command = Command::new("rundll32");
        command.arg("url.dll,FileProtocolHandler").arg(&url);
        command
    } else if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(&url);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(&url);
        command
    };

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open external URL: {error}"))
}

// Open the Microsoft sign-in URL inside a *new Tauri webview window* so
// that the resulting localhost:3001 session cookie lives in the same
// WebView2 user-data dir as the main window. Opening sign-in via the
// system browser would set the cookie there instead, leaving the main
// app's session untouched.
//
// We only allow https URLs from login.microsoftonline.com so this
// command cannot be repurposed by a compromised renderer to open a new
// app-privileged window pointed at arbitrary content.
#[tauri::command]
fn open_auth_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|error| format!("Invalid URL: {error}"))?;
    if parsed.scheme() != "https" {
        return Err("Sign-in URLs must use https.".to_string());
    }
    let host = parsed.host_str().unwrap_or("");
    let host_allowed =
        host == "login.microsoftonline.com" || host.ends_with(".login.microsoftonline.com");
    if !host_allowed {
        return Err(format!(
            "Only login.microsoftonline.com is allowed for sign-in windows (got {host})."
        ));
    }

    let label = "runway-auth";
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.close();
    }

    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title("Microsoft sign-in")
        .inner_size(640.0, 760.0)
        .resizable(true)
        .center()
        .focused(true)
        .build()
        .map(|_| ())
        .map_err(|error| format!("Could not open sign-in window: {error}"))
}

// Reveal a directory in the OS file explorer so an operator can see the
// .env Runway is actually reading. The .env path comes from the server
// (resolveEnvPath) and is rendered in the Graph wizard; we whitelist
// here to absolute paths under known Runway data roots.
#[tauri::command]
fn reveal_path_in_explorer(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.is_absolute() {
        return Err("Path must be absolute.".to_string());
    }

    // Allow only paths inside known Runway-managed roots so a hostile
    // renderer cannot use this to launch Explorer at arbitrary
    // locations on disk.
    let allowed_roots: Vec<PathBuf> = [
        app.path().app_local_data_dir().ok(),
        app.path().app_data_dir().ok(),
        app.path().app_config_dir().ok(),
    ]
    .into_iter()
    .flatten()
    .collect();

    let canonical = target
        .canonicalize()
        .or_else(|_| {
            // If target doesn't exist yet (first-run), at least its
            // parent should — verify against that.
            target
                .parent()
                .ok_or_else(|| std::io::Error::other("No parent dir"))
                .and_then(|parent| parent.canonicalize())
                .map(|parent| parent.join(target.file_name().unwrap_or_default()))
        })
        .map_err(|error| format!("Could not resolve path: {error}"))?;

    let in_allowed_root = allowed_roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .any(|root| canonical.starts_with(&root));
    if !in_allowed_root {
        return Err("Path is outside known Runway data directories.".to_string());
    }

    let dir: &Path = if canonical.is_dir() {
        canonical.as_path()
    } else {
        canonical.parent().unwrap_or(canonical.as_path())
    };

    let mut command = if cfg!(target_os = "windows") {
        let mut command = Command::new("explorer");
        command.arg(dir);
        command
    } else if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(dir);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(dir);
        command
    };

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open file browser: {error}"))
}

#[cfg(target_os = "windows")]
fn normalize_resource_path(path: PathBuf) -> PathBuf {
    let raw = path.to_string_lossy();
    if let Some(without_prefix) = raw.strip_prefix(r"\\?\") {
        PathBuf::from(without_prefix)
    } else {
        path
    }
}

#[cfg(not(target_os = "windows"))]
fn normalize_resource_path(path: PathBuf) -> PathBuf {
    path
}

fn spawn_backend(app: &tauri::AppHandle) -> tauri::Result<Child> {
    let runtime_root =
        normalize_resource_path(app.path().resolve("runtime", BaseDirectory::Resource)?);
    let app_root = runtime_root.join("app");
    let desktop_api_token = app.state::<DesktopApiToken>().0.clone();
    let node_binary = runtime_root.join(if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    });
    let server_entry = app_root.join("dist").join("server").join("index.js");
    let app_data_dir = app.path().app_local_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    let log_path = app_data_dir.join("backend-launch.log");
    let mut log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;
    writeln!(log_file, "=== backend launch ===").ok();
    writeln!(log_file, "runtime_root={}", runtime_root.display()).ok();
    writeln!(log_file, "app_root={}", app_root.display()).ok();
    writeln!(log_file, "node_binary={}", node_binary.display()).ok();
    writeln!(log_file, "server_entry={}", server_entry.display()).ok();
    writeln!(
        log_file,
        "database_path={}",
        app_data_dir.join("pilotcheck.sqlite").display()
    )
    .ok();

    let mut command = Command::new(node_binary);
    command
        .arg(server_entry)
        .current_dir(app_root)
        .env("NODE_ENV", "production")
        .env("HOST", API_HOST)
        .env("PORT", API_PORT)
        .env("RUNWAY_DESKTOP_TOKEN", desktop_api_token)
        .env("PILOTCHECK_APP_DATA_DIR", &app_data_dir)
        .env("DATABASE_PATH", app_data_dir.join("pilotcheck.sqlite"))
        .stdout(Stdio::from(log_file.try_clone()?))
        .stderr(Stdio::from(log_file.try_clone()?));

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = command.spawn()?;
    writeln!(log_file, "spawned_pid={}", child.id()).ok();
    Ok(child)
}

fn stop_backend(app: &tauri::AppHandle) {
    if let Some(mut child) = app
        .state::<BackendState>()
        .0
        .lock()
        .expect("backend state lock poisoned")
        .take()
    {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(BackendState(Mutex::new(None)))
        .manage(DesktopApiToken(create_desktop_api_token()))
        .invoke_handler(tauri::generate_handler![
            get_desktop_api_token,
            open_external_url,
            open_auth_window,
            reveal_path_in_explorer
        ])
        .setup(|app| {
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else {
                let child = spawn_backend(app.handle())?;
                *app.state::<BackendState>()
                    .0
                    .lock()
                    .expect("backend state lock poisoned") = Some(child);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_backend(app_handle);
        }
    });
}
