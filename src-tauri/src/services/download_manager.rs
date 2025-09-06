use crate::models::{BrowserInfo, DownloadTask, DownloadStatus, DownloadProgress, DownloadError};
use crate::services::nodejs_runtime::NodejsRuntime;
use crate::services::retry_manager::RetryManager;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use tauri::{AppHandle, Emitter};
use serde_json::json;
use std::future::Future;
use std::pin::Pin;

type CompletionCallback = Arc<dyn Fn(BrowserInfo) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send>> + Send + Sync>;

pub struct DownloadManager {
    active_downloads: Arc<RwLock<HashMap<String, JoinHandle<()>>>>,
    download_tasks: Arc<RwLock<HashMap<String, DownloadTask>>>,
    nodejs_runtime: Arc<NodejsRuntime>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
    retry_manager: Arc<RwLock<RetryManager>>,
    completion_callback: Arc<RwLock<Option<CompletionCallback>>>,
}

impl DownloadManager {
    pub fn new(nodejs_runtime: Arc<NodejsRuntime>) -> Self {
        Self {
            active_downloads: Arc::new(RwLock::new(HashMap::new())),
            download_tasks: Arc::new(RwLock::new(HashMap::new())),
            nodejs_runtime,
            app_handle: Arc::new(RwLock::new(None)),
            retry_manager: Arc::new(RwLock::new(RetryManager::new())),
            completion_callback: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn set_app_handle(&self, app_handle: AppHandle) {
        let mut handle = self.app_handle.write().await;
        *handle = Some(app_handle);
    }

    pub async fn set_completion_callback<F>(&self, callback: F)
    where
        F: Fn(BrowserInfo) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send>> + Send + Sync + 'static,
    {
        let mut cb = self.completion_callback.write().await;
        *cb = Some(Arc::new(callback));
    }


    pub async fn start_download(
        &self,
        task_id: String,
        browser_info: BrowserInfo,
    ) -> Result<(), String> {
        // 创建下载任务
        let download_task = DownloadTask {
            id: task_id.clone(),
            browser_info: browser_info.clone(),
            status: DownloadStatus::Pending,
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            estimated_time_remaining: None,
            error_message: None,
            retry_count: 0,
        };

        // 存储下载任务
        {
            let mut tasks = self.download_tasks.write().await;
            tasks.insert(task_id.clone(), download_task);
        }

        // 启动下载任务
        let download_tasks_clone = self.download_tasks.clone();
        let nodejs_runtime = self.nodejs_runtime.clone();
        let task_id_clone = task_id.clone();
        let app_handle_clone = self.app_handle.clone();
        let retry_manager_clone = self.retry_manager.clone();

        let completion_callback_clone = self.completion_callback.clone();

        let handle = tokio::spawn(async move {
            let result = Self::execute_download(
                nodejs_runtime,
                download_tasks_clone.clone(),
                task_id_clone.clone(),
                browser_info,
                app_handle_clone.clone(),
                retry_manager_clone.clone(),
                completion_callback_clone.clone(),
            )
            .await;

            match result {
                Ok(_) => {
                    // 记录成功
                    let mut retry_mgr = retry_manager_clone.write().await;
                    retry_mgr.record_success(&task_id_clone);
                },
                Err(e) => {
                    // 检查是否应该重试
                    let mut retry_mgr = retry_manager_clone.write().await;
                    if let Some(delay) = retry_mgr.should_retry(&task_id_clone, &e).await {
                        // 设置任务为重试状态
                        {
                            let mut tasks = download_tasks_clone.write().await;
                            if let Some(task) = tasks.get_mut(&task_id_clone) {
                                task.status = DownloadStatus::Retrying;
                                task.retry_count += 1;
                                let error = DownloadError::from_message(&e);
                                task.error_message = Some(error.user_message());
                            }
                        }
                        
                        // 等待重试延迟
                        drop(retry_mgr); // 释放锁
                        sleep(delay).await;
                        
                        // 重新启动下载 (递归调用)
                        // TODO: 这里应该重新调用start_download，但需要避免无限递归
                        tracing::info!("Retrying download for task: {}", task_id_clone);
                    } else {
                        // 不再重试，标记为失败
                        let mut tasks = download_tasks_clone.write().await;
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.status = DownloadStatus::Failed;
                            let error = DownloadError::from_message(&e);
                            task.error_message = Some(error.user_message());
                        }
                    }
                }
            }
        });

        // 存储任务句柄
        {
            let mut downloads = self.active_downloads.write().await;
            downloads.insert(task_id, handle);
        }

        Ok(())
    }

    async fn execute_download(
        nodejs_runtime: Arc<NodejsRuntime>,
        download_tasks: Arc<RwLock<HashMap<String, DownloadTask>>>,
        task_id: String,
        browser_info: BrowserInfo,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
        _retry_manager: Arc<RwLock<RetryManager>>,
        completion_callback: Arc<RwLock<Option<CompletionCallback>>>,
    ) -> Result<(), String> {
        // 更新状态为下载中
        {
            let mut tasks = download_tasks.write().await;
            if let Some(task) = tasks.get_mut(&task_id) {
                task.status = DownloadStatus::Downloading;
            }
        }
        
        // Emit status update event
        if let Some(ref app_handle_ref) = *app_handle.read().await {
            let payload = json!({
                "taskId": task_id,
                "status": "Downloading"
            });
            
            if let Err(e) = app_handle_ref.emit("download-status-update", payload) {
                tracing::error!("Failed to emit download status update: {}", e);
            }
        }

        // 使用 Node.js 运行时下载浏览器
        let browser_type_str = match browser_info.browser_type {
            crate::models::BrowserType::Chrome => "chrome",
            crate::models::BrowserType::Chromium => "chromium", 
            crate::models::BrowserType::Firefox => "firefox",
            crate::models::BrowserType::ChromeDriver => "chromedriver",
        };

        let download_result = nodejs_runtime
            .download_browser(
                browser_type_str,
                &browser_info.version,
                &browser_info.platform,
                Box::new({
                    let download_tasks = download_tasks.clone();
                    let task_id = task_id.clone();
                    let app_handle_clone = app_handle.clone();
                    move |progress: DownloadProgress| {
                        let download_tasks = download_tasks.clone();
                        let task_id = task_id.clone();
                        let app_handle_clone = app_handle_clone.clone();
                        
                        tokio::spawn(async move {
                            let mut tasks = download_tasks.write().await;
                            if let Some(task) = tasks.get_mut(&task_id) {
                                task.progress = progress.progress;
                                task.downloaded_bytes = progress.downloaded_bytes;
                                task.total_bytes = progress.total_bytes;
                                task.estimated_time_remaining = progress.estimated_time_remaining;
                                
                                // Emit progress update event
                                if let Some(ref app_handle_ref) = *app_handle_clone.read().await {
                                    let payload = json!({
                                        "taskId": task_id,
                                        "progress": task.progress,
                                        "downloadedBytes": task.downloaded_bytes,
                                        "totalBytes": task.total_bytes,
                                        "status": task.status,
                                        "estimatedTimeRemaining": task.estimated_time_remaining
                                    });
                                    
                                    if let Err(e) = app_handle_ref.emit("download-progress-update", payload) {
                                        tracing::error!("Failed to emit download progress update: {}", e);
                                    }
                                }
                            }
                        });
                    }
                }),
            )
            .await;

        match download_result {
            Ok((install_path, executable_path, actual_version)) => {
                let install_path: std::path::PathBuf = install_path;
                let actual_version: String = actual_version;
                // 下载完成，更新任务状态和获取完整的浏览器信息
                let completed_browser_info = {
                    let mut tasks = download_tasks.write().await;
                    if let Some(task) = tasks.get_mut(&task_id) {
                        task.status = DownloadStatus::Completed;
                        task.progress = 1.0;
                        task.browser_info.install_path = install_path.clone();
                        task.browser_info.version = actual_version.clone(); // 使用实际版本号
                        
                        // 使用从Node.js脚本获取的可执行文件路径，或者推导一个
                        let exec_path = if let Some(exec_path) = &executable_path {
                            exec_path.clone()
                        } else {
                            Self::find_executable(&install_path, &browser_info.browser_type)
                        };
                        task.browser_info.executable_path = exec_path;
                        
                        // 设置文件大小为下载的总字节数
                        task.browser_info.file_size = task.total_bytes;
                        
                        // 返回完整的浏览器信息用于保存到数据库
                        task.browser_info.clone()
                    } else {
                        // Fallback: 如果找不到任务，创建一个基础的浏览器信息
                        let mut info = browser_info.clone();
                        info.install_path = install_path.clone();
                        info.version = actual_version.clone();
                        let exec_path = if let Some(exec_path) = &executable_path {
                            exec_path.clone()
                        } else {
                            Self::find_executable(&install_path, &browser_info.browser_type)
                        };
                        info.executable_path = exec_path;
                        info
                    }
                };
                
                // 调用完成回调保存到数据库
                if let Some(ref callback) = *completion_callback.read().await {
                    match callback(completed_browser_info.clone()).await {
                        Ok(_) => {
                            tracing::info!("Successfully saved completed browser to database");
                        }
                        Err(e) => {
                            tracing::error!("Failed to save completed browser to database: {}", e);
                        }
                    }
                }
                
                // Emit completion event
                if let Some(ref app_handle_ref) = *app_handle.read().await {
                    let payload = json!({
                        "taskId": task_id,
                        "status": "Completed",
                        "progress": 1.0,
                        "installPath": install_path.to_string_lossy()
                    });
                    
                    if let Err(e) = app_handle_ref.emit("download-status-update", payload) {
                        tracing::error!("Failed to emit download completion event: {}", e);
                    }
                }

                tracing::info!("Browser download completed: {}", task_id);
                Ok(())
            }
            Err(e) => {
                // Emit failure event
                if let Some(ref app_handle_ref) = *app_handle.read().await {
                    let payload = json!({
                        "taskId": task_id,
                        "status": "Failed",
                        "errorMessage": e
                    });
                    
                    if let Err(emit_err) = app_handle_ref.emit("download-status-update", payload) {
                        tracing::error!("Failed to emit download failure event: {}", emit_err);
                    }
                }
                
                tracing::error!("Browser download failed: {}", e);
                Err(e)
            }
        }
    }

    fn find_executable(install_path: &std::path::Path, browser_type: &crate::models::BrowserType) -> std::path::PathBuf {
        // 根据浏览器类型和平台生成可能的可执行文件路径
        let possible_paths = match browser_type {
            crate::models::BrowserType::Chrome => {
                if cfg!(target_os = "windows") {
                    vec!["chrome.exe", "Application/chrome.exe"]
                } else if cfg!(target_os = "macos") {
                    vec![
                        "Google Chrome.app/Contents/MacOS/Google Chrome",
                        "chrome-mac/Google Chrome.app/Contents/MacOS/Google Chrome",
                        "chrome-mac-arm64/Google Chrome.app/Contents/MacOS/Google Chrome",
                        "chrome-mac-x64/Google Chrome.app/Contents/MacOS/Google Chrome",
                    ]
                } else {
                    vec!["chrome", "google-chrome", "chrome-linux/chrome"]
                }
            }
            crate::models::BrowserType::Chromium => {
                if cfg!(target_os = "windows") {
                    vec!["chrome.exe", "Application/chrome.exe"]
                } else if cfg!(target_os = "macos") {
                    vec![
                        "Chromium.app/Contents/MacOS/Chromium",
                        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
                    ]
                } else {
                    vec!["chrome", "chromium", "chrome-linux/chrome"]
                }
            }
            crate::models::BrowserType::Firefox => {
                if cfg!(target_os = "windows") {
                    vec!["firefox.exe", "firefox/firefox.exe"]
                } else if cfg!(target_os = "macos") {
                    vec!["Firefox.app/Contents/MacOS/firefox"]
                } else {
                    vec!["firefox"]
                }
            }
            crate::models::BrowserType::ChromeDriver => {
                if cfg!(target_os = "windows") {
                    vec!["chromedriver.exe"]
                } else {
                    vec!["chromedriver"]
                }
            }
        };

        // 尝试找到存在的可执行文件
        for &relative_path in &possible_paths {
            let full_path = install_path.join(relative_path);
            if full_path.exists() {
                tracing::info!("Found executable at: {:?}", full_path);
                return full_path;
            }
        }

        // 如果没有找到存在的文件，返回第一个作为默认值
        let default_path = install_path.join(possible_paths[0]);
        tracing::warn!("Executable not found, using default path: {:?}", default_path);
        default_path
    }

    pub async fn retry_download(&self, task_id: &str) -> Result<(), String> {
        // 获取任务信息
        let browser_info = {
            let tasks = self.download_tasks.read().await;
            let task = tasks
                .get(task_id)
                .ok_or("Download task not found")?;
            
            if task.retry_count >= 3 {
                return Err("Maximum retry attempts reached".to_string());
            }
            
            task.browser_info.clone()
        };

        // 增加重试次数
        {
            let mut tasks = self.download_tasks.write().await;
            if let Some(task) = tasks.get_mut(task_id) {
                task.retry_count += 1;
                task.status = DownloadStatus::Retrying;
                task.error_message = None;
            }
        }

        // 重新启动下载
        self.start_download(task_id.to_string(), browser_info).await
    }

    pub async fn remove_task(&self, task_id: &str) -> Result<(), String> {
        // 取消正在运行的下载
        {
            let mut downloads = self.active_downloads.write().await;
            if let Some(handle) = downloads.remove(task_id) {
                handle.abort();
            }
        }

        // 删除任务记录
        {
            let mut tasks = self.download_tasks.write().await;
            tasks.remove(task_id);
        }

        Ok(())
    }

    pub async fn get_progress(&self, task_id: &str) -> Option<DownloadTask> {
        let tasks = self.download_tasks.read().await;
        tasks.get(task_id).cloned()
    }

    pub async fn list_download_tasks(&self) -> Vec<DownloadTask> {
        let tasks = self.download_tasks.read().await;
        tasks.values().cloned().collect()
    }
}