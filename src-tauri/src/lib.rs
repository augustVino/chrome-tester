use std::sync::Arc;
use tauri::Manager;

// 模块声明
pub mod commands;
pub mod database;
pub mod models;
pub mod services;
pub mod utils;

use database::Database;
use services::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 异步初始化应用状态
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match initialize_app_state().await {
                    Ok(state) => {
                        // Set the app handle for event emission
                        state.set_app_handle(handle.clone()).await;
                        handle.manage(state);
                        tracing::info!("Application state initialized successfully");
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize application state: {}", e);
                        std::process::exit(1);
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 浏览器管理命令
            commands::list_browsers,
            commands::download_browser,
            commands::delete_browser,
            commands::clear_all_browsers,
            commands::open_browser,
            commands::get_browser_info,
            // 下载管理命令
            commands::get_download_progress,
            commands::retry_download,
            commands::remove_download_task,
            commands::list_download_tasks,
            // 系统信息命令
            commands::get_available_versions,
            commands::get_system_info,
            // 配置管理命令
            commands::get_app_config,
            commands::set_app_config,
            // 启动参数管理命令
            commands::list_launch_configs,
            commands::get_launch_configs_for_browser,
            commands::get_launch_config,
            commands::save_launch_config,
            commands::delete_launch_config,
            commands::create_launch_config,
            commands::create_config_from_template,
            commands::duplicate_launch_config,
            commands::set_default_launch_config,
            commands::get_launch_templates,
            commands::get_launch_templates_by_category,
            commands::build_browser_launch_args,
            commands::validate_config_security,
            commands::update_config_parameters,
            // 健康检查命令
            commands::health_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


/// 初始化应用状态
async fn initialize_app_state() -> Result<AppState, Box<dyn std::error::Error + Send + Sync>> {
    // 确保应用数据目录存在
    let app_data_dir = utils::get_app_data_dir()?;
    utils::ensure_dir_exists(&app_data_dir).await?;

    // 确保浏览器下载目录存在
    let browsers_dir = utils::get_browsers_dir()?;
    utils::ensure_dir_exists(&browsers_dir).await?;

    // 初始化数据库
    let database_path = utils::get_database_path()?;
    let database = Arc::new(Database::new(database_path).await?);

    // 初始化应用状态
    let app_state = AppState::new(database).await?;

    Ok(app_state)
}
