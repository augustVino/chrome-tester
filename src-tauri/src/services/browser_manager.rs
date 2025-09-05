use crate::database::Database;
use crate::models::{BrowserInfo, BrowserType};
use crate::services::download_manager::DownloadManager;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::Command;

pub struct BrowserManager {
    database: Arc<Database>,
    download_manager: Arc<DownloadManager>,
}

impl BrowserManager {
    pub fn new(database: Arc<Database>, download_manager: Arc<DownloadManager>) -> Self {
        Self {
            database,
            download_manager,
        }
    }

    pub async fn list_browsers(&self) -> Result<Vec<BrowserInfo>, String> {
        self.database
            .get_browsers()
            .await
            .map_err(|e| format!("Failed to get browsers: {}", e))
    }

    pub async fn install_browser(
        &self,
        browser_type: BrowserType,
        version: &str,
        platform: &str,
    ) -> Result<String, String> {
        // 生成唯一的下载任务ID
        let task_id = uuid::Uuid::new_v4().to_string();

        // 创建浏览器信息
        let browser_info = BrowserInfo {
            id: uuid::Uuid::new_v4().to_string(),
            browser_type,
            version: version.to_string(),
            platform: platform.to_string(),
            install_path: PathBuf::new(), // 将在下载完成后填充
            executable_path: PathBuf::new(), // 将在下载完成后填充
            download_date: chrono::Utc::now(),
            file_size: 0, // 将在下载过程中更新
            is_running: false,
        };

        // 启动下载任务
        self.download_manager
            .start_download(task_id.clone(), browser_info)
            .await?;

        Ok(task_id)
    }

    pub async fn delete_browser(&self, browser_id: &str) -> Result<(), String> {
        // 首先从数据库获取浏览器信息
        let browsers = self.list_browsers().await?;
        let browser = browsers
            .iter()
            .find(|b| b.id == browser_id)
            .ok_or("Browser not found")?;

        // 删除文件系统中的浏览器目录
        if browser.install_path.exists() {
            tokio::fs::remove_dir_all(&browser.install_path)
                .await
                .map_err(|e| format!("Failed to remove browser directory: {}", e))?;
        }

        // 从数据库删除记录
        self.database
            .delete_browser(browser_id)
            .await
            .map_err(|e| format!("Failed to delete browser from database: {}", e))?;

        Ok(())
    }

    pub async fn launch_browser(
        &self,
        browser_id: &str,
        args: Option<Vec<String>>,
    ) -> Result<(), String> {
        // 获取浏览器信息
        let browsers = self.list_browsers().await?;
        let browser = browsers
            .iter()
            .find(|b| b.id == browser_id)
            .ok_or("Browser not found")?;

        // 检查可执行文件是否存在
        if !browser.executable_path.exists() {
            return Err("Browser executable not found".to_string());
        }

        // 构建启动命令
        let mut cmd = Command::new(&browser.executable_path);
        
        // 添加默认参数
        cmd.arg("--no-first-run")
           .arg("--disable-default-apps");

        // 添加用户指定的参数
        if let Some(args) = args {
            for arg in args {
                cmd.arg(arg);
            }
        }

        // 启动浏览器
        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start browser: {}", e))?;

        tracing::info!("Browser {} started with PID: {:?}", browser_id, child.id());

        Ok(())
    }

    pub async fn get_browser_info(&self, browser_id: &str) -> Result<BrowserInfo, String> {
        let browsers = self.list_browsers().await?;
        browsers
            .into_iter()
            .find(|b| b.id == browser_id)
            .ok_or("Browser not found".to_string())
    }

    pub async fn update_browser_running_status(
        &self,
        _browser_id: &str,
        _is_running: bool,
    ) -> Result<(), String> {
        // 这里可以添加更新浏览器运行状态的逻辑
        // 目前简化处理
        Ok(())
    }

    /// 保存已完成下载的浏览器到数据库
    pub async fn save_completed_browser(&self, browser_info: BrowserInfo) -> Result<(), String> {
        tracing::info!("Saving completed browser to database: {} {} {}", 
            format!("{:?}", browser_info.browser_type), 
            browser_info.version,
            browser_info.platform
        );

        self.database
            .save_browser(&browser_info)
            .await
            .map_err(|e| format!("Failed to save browser to database: {}", e))?;

        tracing::info!("Successfully saved browser {} to database", browser_info.id);
        Ok(())
    }

    /// 清理所有浏览器数据
    pub async fn clear_all_browsers(&self) -> Result<(), String> {
        // 获取所有浏览器
        let browsers = self.list_browsers().await?;
        
        // 删除所有浏览器的文件和数据库记录
        for browser in browsers {
            // 删除文件系统中的浏览器目录
            if browser.install_path.exists() && browser.install_path != std::path::PathBuf::new() {
                if let Err(e) = tokio::fs::remove_dir_all(&browser.install_path).await {
                    tracing::warn!("Failed to remove browser directory {:?}: {}", browser.install_path, e);
                }
            }
            
            // 从数据库删除记录
            if let Err(e) = self.database.delete_browser(&browser.id).await {
                tracing::warn!("Failed to delete browser {} from database: {}", browser.id, e);
            }
        }
        
        tracing::info!("Cleared all browser data");
        Ok(())
    }
}