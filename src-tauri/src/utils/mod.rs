use std::path::{Path, PathBuf};

pub mod file_utils;
pub mod platform_utils;

pub use file_utils::*;
pub use platform_utils::*;

/// 获取应用数据目录
pub fn get_app_data_dir() -> Result<PathBuf, String> {
    let app_name = "chrome-tester";
    
    let base_dir = if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("USERPROFILE").map(|p| PathBuf::from(p).join("AppData").join("Roaming")))
            .map_err(|_| "Unable to determine app data directory")?
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .map(|p| PathBuf::from(p).join("Library").join("Application Support"))
            .map_err(|_| "Unable to determine app data directory")?
    } else {
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("HOME").map(|p| PathBuf::from(p).join(".local").join("share")))
            .map_err(|_| "Unable to determine app data directory")?
    };

    Ok(base_dir.join(app_name))
}

/// 获取浏览器下载目录
pub fn get_browsers_dir() -> Result<PathBuf, String> {
    let app_data_dir = get_app_data_dir()?;
    Ok(app_data_dir.join("browsers"))
}

/// 获取数据库路径
pub fn get_database_path() -> Result<PathBuf, String> {
    let app_data_dir = get_app_data_dir()?;
    Ok(app_data_dir.join("database.sqlite"))
}

/// 确保目录存在
pub async fn ensure_dir_exists<P: AsRef<Path>>(path: P) -> Result<(), String> {
    if !path.as_ref().exists() {
        tokio::fs::create_dir_all(path)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    Ok(())
}

/// 格式化文件大小
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    const THRESHOLD: u64 = 1024;

    if bytes < THRESHOLD {
        return format!("{} B", bytes);
    }

    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= THRESHOLD as f64 && unit_index < UNITS.len() - 1 {
        size /= THRESHOLD as f64;
        unit_index += 1;
    }

    format!("{:.2} {}", size, UNITS[unit_index])
}

/// 格式化持续时间
pub fn format_duration(seconds: u64) -> String {
    if seconds < 60 {
        format!("{}s", seconds)
    } else if seconds < 3600 {
        let minutes = seconds / 60;
        let remaining_seconds = seconds % 60;
        if remaining_seconds == 0 {
            format!("{}m", minutes)
        } else {
            format!("{}m {}s", minutes, remaining_seconds)
        }
    } else {
        let hours = seconds / 3600;
        let remaining_minutes = (seconds % 3600) / 60;
        if remaining_minutes == 0 {
            format!("{}h", hours)
        } else {
            format!("{}h {}m", hours, remaining_minutes)
        }
    }
}

/// 生成唯一ID
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}