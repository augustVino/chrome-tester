use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DownloadError {
    // 网络相关错误 (可重试)
    NetworkTimeout,
    NetworkUnreachable,
    NetworkConnRefused,
    NetworkSlowConnection,
    
    // HTTP相关错误 (部分可重试)
    HttpServerError(u16), // 5xx errors - 可重试
    HttpClientError(u16), // 4xx errors - 一般不可重试
    HttpRedirectLoop,
    
    // 文件系统错误 (部分可重试)
    FileSystemInsufficientSpace,
    FileSystemPermissionDenied,
    FileSystemCorruptedDownload,
    FileSystemIoError(String),
    
    // 应用逻辑错误 (一般不可重试)
    InvalidBrowserType,
    InvalidVersion,
    InvalidPlatform,
    DownloadUrlNotFound,
    
    // 系统资源错误 (可重试)
    SystemResourceExhausted,
    SystemProcessError,
    
    // 其他未知错误
    Unknown(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Low,    // 警告级别，可以继续操作
    Medium, // 中等级别，需要用户关注
    High,   // 高级别，需要立即处理
    Critical, // 严重级别，可能影响系统稳定性
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RetryStrategy {
    NoRetry,                                // 不重试
    Immediate { max_attempts: u32 },        // 立即重试
    ExponentialBackoff {                    // 指数退避重试
        max_attempts: u32,
        initial_delay_ms: u64,
        max_delay_ms: u64,
        backoff_factor: f64,
    },
    LinearBackoff {                         // 线性退避重试
        max_attempts: u32,
        delay_increment_ms: u64,
    },
}

impl DownloadError {
    /// 判断错误是否可重试
    pub fn is_retryable(&self) -> bool {
        match self {
            // 网络错误通常可重试
            DownloadError::NetworkTimeout
            | DownloadError::NetworkUnreachable
            | DownloadError::NetworkConnRefused
            | DownloadError::NetworkSlowConnection => true,
            
            // HTTP 5xx 错误可重试, 4xx 一般不可重试
            DownloadError::HttpServerError(_) => true,
            DownloadError::HttpClientError(code) => *code == 429, // 429 Too Many Requests 可重试
            
            // 部分文件系统错误可重试
            DownloadError::FileSystemCorruptedDownload
            | DownloadError::FileSystemIoError(_) => true,
            DownloadError::FileSystemInsufficientSpace
            | DownloadError::FileSystemPermissionDenied => false,
            
            // 系统资源错误可重试
            DownloadError::SystemResourceExhausted
            | DownloadError::SystemProcessError => true,
            
            // 逻辑错误不可重试
            DownloadError::InvalidBrowserType
            | DownloadError::InvalidVersion
            | DownloadError::InvalidPlatform
            | DownloadError::DownloadUrlNotFound => false,
            
            // 其他错误和重定向循环不可重试
            DownloadError::HttpRedirectLoop
            | DownloadError::Unknown(_) => false,
        }
    }
    
    /// 获取错误的严重程度
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            DownloadError::NetworkSlowConnection => ErrorSeverity::Low,
            
            DownloadError::NetworkTimeout
            | DownloadError::NetworkUnreachable
            | DownloadError::NetworkConnRefused
            | DownloadError::HttpServerError(_)
            | DownloadError::FileSystemCorruptedDownload => ErrorSeverity::Medium,
            
            DownloadError::FileSystemInsufficientSpace
            | DownloadError::FileSystemPermissionDenied
            | DownloadError::SystemResourceExhausted
            | DownloadError::HttpRedirectLoop => ErrorSeverity::High,
            
            DownloadError::SystemProcessError => ErrorSeverity::Critical,
            
            _ => ErrorSeverity::Medium,
        }
    }
    
    /// 获取推荐的重试策略
    pub fn retry_strategy(&self) -> RetryStrategy {
        match self {
            // 网络错误使用指数退避
            DownloadError::NetworkTimeout
            | DownloadError::NetworkUnreachable
            | DownloadError::NetworkConnRefused => RetryStrategy::ExponentialBackoff {
                max_attempts: 5,
                initial_delay_ms: 1000,
                max_delay_ms: 30000,
                backoff_factor: 2.0,
            },
            
            // 慢连接使用更少的重试次数
            DownloadError::NetworkSlowConnection => RetryStrategy::LinearBackoff {
                max_attempts: 2,
                delay_increment_ms: 5000,
            },
            
            // HTTP 5xx 错误使用指数退避
            DownloadError::HttpServerError(_) => RetryStrategy::ExponentialBackoff {
                max_attempts: 3,
                initial_delay_ms: 2000,
                max_delay_ms: 15000,
                backoff_factor: 1.5,
            },
            
            // 429 错误使用更长的退避时间
            DownloadError::HttpClientError(429) => RetryStrategy::LinearBackoff {
                max_attempts: 3,
                delay_increment_ms: 10000,
            },
            
            // 文件系统 IO 错误使用较少重试
            DownloadError::FileSystemCorruptedDownload
            | DownloadError::FileSystemIoError(_) => RetryStrategy::ExponentialBackoff {
                max_attempts: 2,
                initial_delay_ms: 1000,
                max_delay_ms: 5000,
                backoff_factor: 2.0,
            },
            
            // 系统资源错误使用线性退避
            DownloadError::SystemResourceExhausted
            | DownloadError::SystemProcessError => RetryStrategy::LinearBackoff {
                max_attempts: 3,
                delay_increment_ms: 3000,
            },
            
            // 其他错误不重试
            _ => RetryStrategy::NoRetry,
        }
    }
    
    /// 获取用户友好的错误消息
    pub fn user_message(&self) -> String {
        match self {
            DownloadError::NetworkTimeout => "网络连接超时，请检查网络连接".to_string(),
            DownloadError::NetworkUnreachable => "无法访问下载服务器，请检查网络设置".to_string(),
            DownloadError::NetworkConnRefused => "下载服务器拒绝连接，可能服务器暂时不可用".to_string(),
            DownloadError::NetworkSlowConnection => "网络连接缓慢，正在重试下载".to_string(),
            
            DownloadError::HttpServerError(code) => format!("服务器错误 ({}), 正在重试", code),
            DownloadError::HttpClientError(code) => format!("请求错误 ({}), 请检查下载链接", code),
            DownloadError::HttpRedirectLoop => "下载链接重定向过多，请联系技术支持".to_string(),
            
            DownloadError::FileSystemInsufficientSpace => "磁盘空间不足，请清理磁盘空间后重试".to_string(),
            DownloadError::FileSystemPermissionDenied => "文件权限不足，请以管理员权限运行程序".to_string(),
            DownloadError::FileSystemCorruptedDownload => "下载文件损坏，正在重新下载".to_string(),
            DownloadError::FileSystemIoError(msg) => format!("文件操作失败: {}", msg),
            
            DownloadError::InvalidBrowserType => "不支持的浏览器类型".to_string(),
            DownloadError::InvalidVersion => "无效的浏览器版本号".to_string(),
            DownloadError::InvalidPlatform => "不支持的操作系统平台".to_string(),
            DownloadError::DownloadUrlNotFound => "找不到下载链接，该版本可能不存在".to_string(),
            
            DownloadError::SystemResourceExhausted => "系统资源不足，正在重试".to_string(),
            DownloadError::SystemProcessError => "系统进程错误，请重启应用程序".to_string(),
            
            DownloadError::Unknown(msg) => format!("未知错误: {}", msg),
        }
    }
    
    /// 获取技术详细信息 (用于日志)
    pub fn technical_details(&self) -> String {
        format!("{:?}", self)
    }
    
    /// 从字符串解析错误类型 (用于从 Node.js 输出解析)
    pub fn from_message(message: &str) -> Self {
        let lower_msg = message.to_lowercase();
        
        if lower_msg.contains("timeout") || lower_msg.contains("timed out") {
            DownloadError::NetworkTimeout
        } else if lower_msg.contains("network unreachable") || lower_msg.contains("no route to host") {
            DownloadError::NetworkUnreachable
        } else if lower_msg.contains("connection refused") || lower_msg.contains("econnrefused") {
            DownloadError::NetworkConnRefused
        } else if lower_msg.contains("slow") || lower_msg.contains("bandwidth") {
            DownloadError::NetworkSlowConnection
        } else if lower_msg.contains("http") {
            // 尝试解析HTTP状态码
            if let Some(code) = extract_http_status_code(&lower_msg) {
                if code >= 500 {
                    DownloadError::HttpServerError(code)
                } else if code >= 400 {
                    DownloadError::HttpClientError(code)
                } else {
                    DownloadError::Unknown(message.to_string())
                }
            } else {
                DownloadError::Unknown(message.to_string())
            }
        } else if lower_msg.contains("no space") || lower_msg.contains("disk full") {
            DownloadError::FileSystemInsufficientSpace
        } else if lower_msg.contains("permission denied") || lower_msg.contains("access denied") {
            DownloadError::FileSystemPermissionDenied
        } else if lower_msg.contains("corrupted") || lower_msg.contains("checksum") {
            DownloadError::FileSystemCorruptedDownload
        } else if lower_msg.contains("invalid browser") {
            DownloadError::InvalidBrowserType
        } else if lower_msg.contains("invalid version") || lower_msg.contains("version not found") {
            DownloadError::InvalidVersion
        } else if lower_msg.contains("platform not supported") || lower_msg.contains("invalid platform") {
            DownloadError::InvalidPlatform
        } else if lower_msg.contains("url not found") || lower_msg.contains("download not available") {
            DownloadError::DownloadUrlNotFound
        } else if lower_msg.contains("resource exhausted") || lower_msg.contains("out of memory") {
            DownloadError::SystemResourceExhausted
        } else if lower_msg.contains("process") {
            DownloadError::SystemProcessError
        } else {
            DownloadError::Unknown(message.to_string())
        }
    }
}

impl fmt::Display for DownloadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for DownloadError {}

/// 从错误消息中提取HTTP状态码
fn extract_http_status_code(message: &str) -> Option<u16> {
    // 查找类似 "HTTP 404" 或 "status: 500" 的模式
    let patterns = [r"http\s+(\d{3})", r"status\s*:\s*(\d{3})", r"error\s+(\d{3})"];
    
    for pattern in &patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(captures) = re.captures(message) {
                if let Some(code_match) = captures.get(1) {
                    if let Ok(code) = code_match.as_str().parse::<u16>() {
                        return Some(code);
                    }
                }
            }
        }
    }
    
    None
}