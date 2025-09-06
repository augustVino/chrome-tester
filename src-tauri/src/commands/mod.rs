use crate::models::{BrowserInfo, DownloadTask, SystemInfo, BrowserType, BrowserLaunchConfig, LaunchParameter, ParameterTemplate, TemplateCategory};
use crate::services::{AppState, parameter_manager::SecurityValidation};
use tauri::State;

// 浏览器管理相关命令
#[tauri::command]
pub async fn list_browsers(state: State<'_, AppState>) -> Result<Vec<BrowserInfo>, String> {
    state.browser_manager.list_browsers().await
}

#[tauri::command]
pub async fn download_browser(
    state: State<'_, AppState>,
    browser_type: String,
    version: String,
    platform: String,
) -> Result<String, String> {
    let browser_type_enum = match browser_type.as_str() {
        "chrome" => BrowserType::Chrome,
        "chromium" => BrowserType::Chromium,
        "firefox" => BrowserType::Firefox,
        "chromedriver" => BrowserType::ChromeDriver,
        _ => return Err("Invalid browser type".to_string()),
    };

    state
        .browser_manager
        .install_browser(browser_type_enum, &version, &platform)
        .await
}

#[tauri::command]
pub async fn delete_browser(state: State<'_, AppState>, browser_id: String) -> Result<(), String> {
    state.browser_manager.delete_browser(&browser_id).await
}

#[tauri::command]
pub async fn clear_all_browsers(state: State<'_, AppState>) -> Result<(), String> {
    state.browser_manager.clear_all_browsers().await
}

#[tauri::command]
pub async fn open_browser(
    state: State<'_, AppState>,
    browser_id: String,
    args: Option<Vec<String>>,
) -> Result<(), String> {
    // 首先获取参数管理器中的默认启动参数
    let parameter_args = state
        .parameter_manager
        .build_launch_args(&browser_id, None)
        .await
        .unwrap_or_default();

    // 合并参数管理器的参数和用户指定的参数
    let combined_args = if let Some(user_args) = args {
        parameter_args.into_iter().chain(user_args.into_iter()).collect()
    } else {
        parameter_args
    };

    state
        .browser_manager
        .launch_browser(&browser_id, Some(combined_args))
        .await
}

#[tauri::command]
pub async fn get_browser_info(
    state: State<'_, AppState>,
    browser_id: String,
) -> Result<BrowserInfo, String> {
    state.browser_manager.get_browser_info(&browser_id).await
}

// 下载管理相关命令
#[tauri::command]
pub async fn get_download_progress(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<Option<DownloadTask>, String> {
    Ok(state.download_manager.get_progress(&task_id).await)
}

#[tauri::command]
pub async fn retry_download(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.download_manager.retry_download(&task_id).await
}

#[tauri::command]
pub async fn remove_download_task(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    state.download_manager.remove_task(&task_id).await
}

#[tauri::command]
pub async fn list_download_tasks(state: State<'_, AppState>) -> Result<Vec<DownloadTask>, String> {
    Ok(state.download_manager.list_download_tasks().await)
}

// 系统信息相关命令
#[tauri::command]
pub async fn get_available_versions(
    _state: State<'_, AppState>,
    _browser_type: String,
) -> Result<Vec<String>, String> {
    // 这里可以扩展为从多个源获取版本信息
    // 目前使用 Node.js 运行时获取
    Ok(vec![
        "stable".to_string(),
        "131".to_string(),
        "130".to_string(),
        "129".to_string(),
        "128".to_string(),
        "127".to_string(),
        "126".to_string(),
        "125".to_string(),
    ])
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let platform = if cfg!(target_os = "windows") {
        "win64".to_string()
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "mac_arm".to_string()
        } else {
            "mac_x64".to_string()
        }
    } else if cfg!(target_os = "linux") {
        "linux64".to_string()
    } else {
        "unknown".to_string()
    };

    let arch = std::env::consts::ARCH.to_string();

    Ok(SystemInfo {
        platform,
        arch,
        available_versions: vec![], // 可以在这里填充可用版本
    })
}

// 配置管理命令
#[tauri::command]
pub async fn get_app_config(
    _state: State<'_, AppState>,
    _key: String,
) -> Result<Option<String>, String> {
    // 这里需要访问数据库，暂时返回空值
    Ok(None)
}

#[tauri::command]
pub async fn set_app_config(
    _state: State<'_, AppState>,
    _key: String,
    _value: String,
) -> Result<(), String> {
    // 这里需要访问数据库，暂时不做处理
    Ok(())
}

// 启动参数管理命令
#[tauri::command]
pub async fn list_launch_configs(
    state: State<'_, AppState>
) -> Result<Vec<BrowserLaunchConfig>, String> {
    state.parameter_manager.get_all_configs().await
}

#[tauri::command]
pub async fn get_launch_configs_for_browser(
    state: State<'_, AppState>,
    browser_id: String,
) -> Result<Vec<BrowserLaunchConfig>, String> {
    state.parameter_manager.get_configs_for_browser(&browser_id).await
}

#[tauri::command]
pub async fn get_launch_config(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<Option<BrowserLaunchConfig>, String> {
    state.parameter_manager.get_config(&config_id).await
}

#[tauri::command]
pub async fn save_launch_config(
    state: State<'_, AppState>,
    config: BrowserLaunchConfig,
) -> Result<(), String> {
    state.parameter_manager.save_config(config).await
}

#[tauri::command]
pub async fn delete_launch_config(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<(), String> {
    state.parameter_manager.delete_config(&config_id).await
}

#[tauri::command]
pub async fn create_launch_config(
    state: State<'_, AppState>,
    name: String,
    description: String,
    browser_id: Option<String>,
) -> Result<BrowserLaunchConfig, String> {
    state.parameter_manager.create_config(name, description, browser_id).await
}

#[tauri::command]
pub async fn create_config_from_template(
    state: State<'_, AppState>,
    template_id: String,
    name: String,
    browser_id: Option<String>,
) -> Result<BrowserLaunchConfig, String> {
    state.parameter_manager
        .create_config_from_template(&template_id, name, browser_id)
        .await
}

#[tauri::command]
pub async fn duplicate_launch_config(
    state: State<'_, AppState>,
    config_id: String,
    new_name: String,
) -> Result<BrowserLaunchConfig, String> {
    state.parameter_manager.duplicate_config(&config_id, new_name).await
}

#[tauri::command]
pub async fn set_default_launch_config(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<(), String> {
    state.parameter_manager.set_as_default(&config_id).await
}

#[tauri::command]
pub async fn get_launch_templates() -> Result<Vec<ParameterTemplate>, String> {
    Ok(ParameterTemplate::get_builtin_templates())
}

#[tauri::command]
pub async fn get_launch_templates_by_category(
    category: TemplateCategory,
) -> Result<Vec<ParameterTemplate>, String> {
    Ok(ParameterTemplate::get_builtin_templates()
        .into_iter()
        .filter(|t| t.category == category)
        .collect())
}

#[tauri::command]
pub async fn build_browser_launch_args(
    state: State<'_, AppState>,
    browser_id: String,
    config_ids: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    state.parameter_manager
        .build_launch_args(&browser_id, config_ids)
        .await
}

#[tauri::command]
pub async fn validate_config_security(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<SecurityValidation, String> {
    state.parameter_manager.validate_config_security(&config_id).await
}

#[tauri::command]
pub async fn update_config_parameters(
    state: State<'_, AppState>,
    config_id: String,
    parameters: Vec<LaunchParameter>,
) -> Result<(), String> {
    state.parameter_manager
        .update_config_parameters(&config_id, parameters)
        .await
}

// 健康检查命令
#[tauri::command]
pub async fn health_check() -> Result<String, String> {
    Ok("OK".to_string())
}