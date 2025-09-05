use std::path::PathBuf;

/// 获取当前平台标识符
pub fn get_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        if cfg!(target_arch = "x86_64") {
            "win64"
        } else if cfg!(target_arch = "x86") {
            "win32"
        } else {
            "windows"
        }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "mac_arm"
        } else {
            "mac_x64"
        }
    } else if cfg!(target_os = "linux") {
        if cfg!(target_arch = "x86_64") {
            "linux64"
        } else {
            "linux"
        }
    } else {
        "unknown"
    }
}

/// 获取当前架构
pub fn get_arch() -> &'static str {
    std::env::consts::ARCH
}

/// 获取操作系统名称
pub fn get_os_name() -> &'static str {
    std::env::consts::OS
}

/// 检查是否为 Windows 系统
pub fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

/// 检查是否为 macOS 系统
pub fn is_macos() -> bool {
    cfg!(target_os = "macos")
}

/// 检查是否为 Linux 系统
pub fn is_linux() -> bool {
    cfg!(target_os = "linux")
}

/// 获取可执行文件扩展名
pub fn get_executable_extension() -> &'static str {
    if is_windows() {
        ".exe"
    } else {
        ""
    }
}

/// 获取平台特定的浏览器可执行文件名
pub fn get_browser_executable_name(browser_type: &crate::models::BrowserType) -> &'static str {
    match browser_type {
        crate::models::BrowserType::Chrome => {
            if is_windows() {
                "chrome.exe"
            } else if is_macos() {
                "Google Chrome.app/Contents/MacOS/Google Chrome"
            } else {
                "google-chrome"
            }
        }
        crate::models::BrowserType::Chromium => {
            if is_windows() {
                "chrome.exe"
            } else if is_macos() {
                "Chromium.app/Contents/MacOS/Chromium"
            } else {
                "chromium-browser"
            }
        }
        crate::models::BrowserType::Firefox => {
            if is_windows() {
                "firefox.exe"
            } else if is_macos() {
                "Firefox.app/Contents/MacOS/firefox"
            } else {
                "firefox"
            }
        }
        crate::models::BrowserType::ChromeDriver => {
            if is_windows() {
                "chromedriver.exe"
            } else {
                "chromedriver"
            }
        }
    }
}

/// 获取平台特定的应用程序目录
pub fn get_app_dir() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Unable to determine home directory")?;

    let app_dir = if is_windows() {
        PathBuf::from(&home_dir)
            .join("AppData")
            .join("Roaming")
            .join("chrome-tester")
    } else if is_macos() {
        PathBuf::from(&home_dir)
            .join("Library")
            .join("Application Support")
            .join("chrome-tester")
    } else {
        // Linux
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(&home_dir).join(".local").join("share"))
            .join("chrome-tester")
    };

    Ok(app_dir)
}

/// 获取临时目录
pub fn get_temp_dir() -> PathBuf {
    std::env::temp_dir().join("chrome-tester")
}

/// 获取默认的浏览器安装目录
pub fn get_default_browsers_dir() -> Result<PathBuf, String> {
    Ok(get_app_dir()?.join("browsers"))
}

/// 检查系统是否支持给定的浏览器类型
pub fn is_browser_supported(browser_type: &crate::models::BrowserType) -> bool {
    match browser_type {
        crate::models::BrowserType::Chrome | crate::models::BrowserType::Chromium => true,
        crate::models::BrowserType::Firefox => true,
        crate::models::BrowserType::ChromeDriver => true,
    }
}

/// 获取系统信息字符串
pub fn get_system_info() -> String {
    format!(
        "{} {} ({})",
        get_os_name(),
        get_platform(),
        get_arch()
    )
}

/// 检查是否有足够的磁盘空间
pub async fn has_enough_disk_space(_path: &PathBuf, _required_bytes: u64) -> Result<bool, String> {
    // 这里简化处理，实际应该检查磁盘空间
    // 可以使用系统调用或第三方库来实现
    Ok(true)
}

/// 获取环境变量
pub fn get_env_var(key: &str) -> Option<String> {
    std::env::var(key).ok()
}

/// 设置环境变量
pub fn set_env_var(key: &str, value: &str) {
    std::env::set_var(key, value);
}

/// 获取 PATH 环境变量中的所有目录
pub fn get_path_dirs() -> Vec<PathBuf> {
    std::env::var("PATH")
        .map(|path| {
            path.split(if is_windows() { ';' } else { ':' })
                .map(PathBuf::from)
                .collect()
        })
        .unwrap_or_default()
}

/// 在 PATH 中查找可执行文件
pub async fn find_in_path(executable_name: &str) -> Option<PathBuf> {
    let exe_name = if is_windows() && !executable_name.ends_with(".exe") {
        format!("{}.exe", executable_name)
    } else {
        executable_name.to_string()
    };

    for dir in get_path_dirs() {
        let exe_path = dir.join(&exe_name);
        if exe_path.is_file() {
            return Some(exe_path);
        }
    }

    None
}