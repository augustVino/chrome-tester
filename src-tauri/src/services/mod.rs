use crate::database::Database;
use std::sync::Arc;
use tauri::AppHandle;

pub mod browser_manager;
pub mod download_manager;
pub mod nodejs_runtime;
pub mod retry_manager;
pub mod parameter_manager;

pub use browser_manager::BrowserManager;
pub use download_manager::DownloadManager;
pub use nodejs_runtime::NodejsRuntime;
pub use parameter_manager::ParameterManager;

#[derive(Clone)]
pub struct AppState {
    pub browser_manager: Arc<BrowserManager>,
    pub download_manager: Arc<DownloadManager>,
    pub parameter_manager: Arc<ParameterManager>,
}

impl AppState {
    pub async fn new(database: Arc<Database>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let nodejs_runtime = Arc::new(NodejsRuntime::new().await?);
        let download_manager = Arc::new(DownloadManager::new(nodejs_runtime.clone()));
        let parameter_manager = Arc::new(ParameterManager::new(database.clone()));
        let browser_manager = Arc::new(BrowserManager::new(database, download_manager.clone()));

        // Set up completion callback to save completed browsers to database
        {
            let browser_manager_clone = browser_manager.clone();
            download_manager.set_completion_callback(move |browser_info| {
                let browser_manager_clone = browser_manager_clone.clone();
                Box::pin(async move {
                    browser_manager_clone.save_completed_browser(browser_info).await
                })
            }).await;
        }

        Ok(AppState {
            browser_manager,
            download_manager,
            parameter_manager,
        })
    }
    
    pub async fn set_app_handle(&self, app_handle: AppHandle) {
        self.download_manager.set_app_handle(app_handle).await;
    }
}