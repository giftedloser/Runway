use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use rand::RngCore;
use tauri::path::BaseDirectory;
use tauri::Manager;

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
  let runtime_root = normalize_resource_path(app.path().resolve("runtime", BaseDirectory::Resource)?);
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
  writeln!(log_file, "database_path={}", app_data_dir.join("pilotcheck.sqlite").display()).ok();

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
    .invoke_handler(tauri::generate_handler![get_desktop_api_token])
    .setup(|app| {
      app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      } else {
        let child = spawn_backend(&app.handle())?;
        *app
          .state::<BackendState>()
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
