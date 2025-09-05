use crate::models::DownloadProgress;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub type ProgressCallback = Box<dyn Fn(DownloadProgress) + Send + Sync>;

pub struct NodejsRuntime {
    node_path: PathBuf,
}

impl NodejsRuntime {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // 检查 Node.js 是否可用
        let node_path = Self::find_nodejs().await?;
        
        Ok(Self { node_path })
    }

    fn get_script_path(&self, script_name: &str) -> Result<PathBuf, String> {
        // 获取项目根目录的脚本路径
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        
        let exe_dir = exe_path.parent()
            .ok_or("Failed to get executable directory")?;
        
        // 在开发模式下，脚本在项目根目录的scripts文件夹中
        // 在生产模式下，脚本应该被打包到resources目录中
        let script_paths = [
            // 开发模式路径（从target/debug回到项目根目录）
            exe_dir.join("../../scripts").join(script_name),
            exe_dir.join("../../../scripts").join(script_name),
            exe_dir.join("../../../../scripts").join(script_name),
            // 生产模式路径
            exe_dir.join("scripts").join(script_name),
            exe_dir.join("resources").join("scripts").join(script_name),
        ];
        
        for path in &script_paths {
            if path.exists() {
                return Ok(path.to_path_buf());
            }
        }
        
        Err(format!("Script {} not found in any expected location", script_name))
    }

    async fn find_nodejs() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        // 尝试找到 Node.js 可执行文件
        let possible_names = ["node", "nodejs"];
        
        for name in &possible_names {
            if let Ok(path) = which::which(name) {
                // 验证 Node.js 版本
                let output = Command::new(&path)
                    .arg("--version")
                    .output()
                    .await?;
                
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("Found Node.js at {:?}, version: {}", path, version.trim());
                    return Ok(path);
                }
            }
        }
        
        Err("Node.js not found in PATH".into())
    }

    pub async fn download_browser(
        &self,
        browser_type: &str,
        version: &str,
        platform: &str,
        progress_callback: ProgressCallback,
    ) -> Result<(PathBuf, String), String> {
        // 使用项目中的下载脚本
        let script_path = self.get_script_path("download-browser.js")?;

        // 执行下载脚本
        let mut cmd = Command::new(&self.node_path)
            .arg(&script_path)
            .arg("--browser")
            .arg(browser_type)
            .arg("--version")
            .arg(version)
            .arg("--platform")
            .arg(platform)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Node.js process: {}", e))?;

        // 读取stdout和stderr输出并解析进度
        let stdout = cmd.stdout.take().unwrap();
        let stderr = cmd.stderr.take().unwrap();
        
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let mut install_path = None;
        let mut actual_version = version.to_string(); // 默认使用输入的版本号

        // 启动一个任务来读取stderr并记录错误
        let stderr_handle = tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                tracing::error!("Node.js stderr: {}", line);
            }
        });

        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if line.starts_with("PROGRESS:") {
                // 解析进度信息
                if let Ok(progress) = self.parse_progress(&line) {
                    progress_callback(progress);
                }
            } else if line.starts_with("COMPLETED:") {
                // 解析完成信息
                let path_str = line.strip_prefix("COMPLETED:").unwrap_or("").trim();
                install_path = Some(PathBuf::from(path_str));
            } else if line.starts_with("VERSION:") {
                // 解析实际版本号
                let version_str = line.strip_prefix("VERSION:").unwrap_or("").trim();
                if !version_str.is_empty() {
                    actual_version = version_str.to_string();
                }
            } else if line.starts_with("ERROR:") {
                return Err(line.strip_prefix("ERROR:").unwrap_or("Unknown error").trim().to_string());
            } else {
                tracing::debug!("Node.js output: {}", line);
            }
        }

        // 确保stderr任务完成
        let _ = stderr_handle.await;

        // 等待进程完成，为大文件下载提供足够的时间 (10分钟)
        let status = tokio::time::timeout(
            tokio::time::Duration::from_secs(600),
            cmd.wait()
        ).await
        .map_err(|_| "Download timeout (10 minutes exceeded)".to_string())?
        .map_err(|e| format!("Node.js process error: {}", e))?;

        if status.success() {
            if let Some(path) = install_path {
                Ok((path, actual_version))
            } else {
                Err("Download completed but install path not found".to_string())
            }
        } else {
            Err(format!("Node.js process failed with exit code: {:?}", status.code()))
        }
    }


    fn parse_progress(&self, line: &str) -> Result<DownloadProgress, String> {
        let json_str = line.strip_prefix("PROGRESS:")
            .ok_or("Invalid progress line")?;
        
        let parsed: serde_json::Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse progress JSON: {}", e))?;

        Ok(DownloadProgress {
            progress: parsed["progress"].as_f64().unwrap_or(0.0),
            downloaded_bytes: parsed["downloaded_bytes"].as_u64().unwrap_or(0),
            total_bytes: parsed["total_bytes"].as_u64().unwrap_or(0),
            estimated_time_remaining: parsed["estimated_time_remaining"].as_u64(),
        })
    }

    pub async fn get_available_versions(&self, browser_type: &str) -> Result<Vec<String>, String> {
        let script_path = self.get_script_path("list-versions.js")?;

        let output = Command::new(&self.node_path)
            .arg(&script_path)
            .arg("--browser")
            .arg(browser_type)
            .output()
            .await
            .map_err(|e| format!("Failed to execute Node.js: {}", e))?;

        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let versions: Vec<String> = serde_json::from_str(&output_str)
                .map_err(|e| format!("Failed to parse versions JSON: {}", e))?;
            Ok(versions)
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(format!("Node.js script failed: {}", error))
        }
    }

    pub async fn check_browser_installed(&self, browser_type: &str, version: &str, platform: &str) -> Result<bool, String> {
        let script_path = self.get_script_path("check-installation.js")?;

        let output = Command::new(&self.node_path)
            .arg(&script_path)
            .arg("--browser")
            .arg(browser_type)
            .arg("--version")
            .arg(version)
            .arg("--platform")
            .arg(platform)
            .output()
            .await
            .map_err(|e| format!("Failed to execute Node.js: {}", e))?;

        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let result: serde_json::Value = serde_json::from_str(&output_str)
                .map_err(|e| format!("Failed to parse check result JSON: {}", e))?;
            
            Ok(result["installed"].as_bool().unwrap_or(false))
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(format!("Node.js script failed: {}", error))
        }
    }

    pub async fn uninstall_browser(&self, browser_type: &str, version: &str, platform: &str) -> Result<(), String> {
        let script_path = self.get_script_path("uninstall-browser.js")?;

        let output = Command::new(&self.node_path)
            .arg(&script_path)
            .arg("--browser")
            .arg(browser_type)
            .arg("--version")
            .arg(version)
            .arg("--platform")
            .arg(platform)
            .output()
            .await
            .map_err(|e| format!("Failed to execute Node.js: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(format!("Uninstall failed: {}", error))
        }
    }
}