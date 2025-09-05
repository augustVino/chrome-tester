use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub mod error;
pub mod launch_params;
pub use error::*;
pub use launch_params::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BrowserInfo {
    pub id: String,
    pub browser_type: BrowserType,
    pub version: String,
    pub platform: String,
    #[serde(serialize_with = "serialize_path", deserialize_with = "deserialize_path")]
    pub install_path: PathBuf,
    #[serde(serialize_with = "serialize_path", deserialize_with = "deserialize_path")]
    pub executable_path: PathBuf,
    pub download_date: DateTime<Utc>,
    pub file_size: u64,
    pub is_running: bool,
}

fn serialize_path<S>(path: &PathBuf, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&path.to_string_lossy())
}

fn deserialize_path<'de, D>(deserializer: D) -> Result<PathBuf, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Ok(PathBuf::from(s))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum BrowserType {
    Chrome,
    Chromium,
    Firefox,
    ChromeDriver,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadTask {
    pub id: String,
    pub browser_info: BrowserInfo,
    pub status: DownloadStatus,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub estimated_time_remaining: Option<u64>,
    pub error_message: Option<String>,
    pub retry_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Completed,
    Failed,
    Retrying,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub available_versions: Vec<ChromeVersion>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChromeVersion {
    pub version: String,
    pub platform: String,
    pub download_url: Option<String>,
    pub file_size: Option<u64>,
    pub release_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub estimated_time_remaining: Option<u64>,
}