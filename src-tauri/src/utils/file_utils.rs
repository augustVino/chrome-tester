use std::path::{Path, PathBuf};
use tokio::fs;

/// 复制文件
pub async fn copy_file<P: AsRef<Path>, Q: AsRef<Path>>(
    from: P,
    to: Q,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    fs::copy(from, to).await?;
    Ok(())
}

/// 移动文件
pub async fn move_file<P: AsRef<Path>, Q: AsRef<Path>>(
    from: P,
    to: Q,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    fs::rename(from, to).await?;
    Ok(())
}

/// 删除文件或目录
pub async fn remove_path<P: AsRef<Path>>(
    path: P,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let path = path.as_ref();
    if path.is_file() {
        fs::remove_file(path).await?;
    } else if path.is_dir() {
        fs::remove_dir_all(path).await?;
    }
    Ok(())
}

/// 获取文件大小
pub async fn get_file_size<P: AsRef<Path>>(path: P) -> Result<u64, std::io::Error> {
    let metadata = fs::metadata(path).await?;
    Ok(metadata.len())
}

/// 获取目录大小
pub async fn get_dir_size<P: AsRef<Path>>(path: P) -> Result<u64, std::io::Error> {
    let mut total_size = 0;
    let mut entries = fs::read_dir(path).await?;

    while let Some(entry) = entries.next_entry().await? {
        let metadata = entry.metadata().await?;
        if metadata.is_file() {
            total_size += metadata.len();
        } else if metadata.is_dir() {
            total_size += get_dir_size(entry.path()).await?;
        }
    }

    Ok(total_size)
}

/// 检查路径是否存在
pub async fn path_exists<P: AsRef<Path>>(path: P) -> bool {
    path.as_ref().exists()
}

/// 确保父目录存在
pub async fn ensure_parent_dir<P: AsRef<Path>>(
    file_path: P,
) -> Result<(), std::io::Error> {
    if let Some(parent) = file_path.as_ref().parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).await?;
        }
    }
    Ok(())
}

/// 获取可执行文件路径（根据平台添加扩展名）
pub fn get_executable_path<P: AsRef<Path>>(base_path: P, name: &str) -> PathBuf {
    let path = base_path.as_ref().join(name);
    if cfg!(target_os = "windows") && !name.ends_with(".exe") {
        path.with_extension("exe")
    } else {
        path
    }
}

/// 检查文件是否为可执行文件
pub async fn is_executable<P: AsRef<Path>>(path: P) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&path).await {
            let permissions = metadata.permissions();
            return permissions.mode() & 0o111 != 0;
        }
    }
    
    #[cfg(windows)]
    {
        let path = path.as_ref();
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            return matches!(ext.as_str(), "exe" | "bat" | "cmd" | "com");
        }
    }
    
    false
}

/// 查找目录中的可执行文件
pub async fn find_executables<P: AsRef<Path>>(dir: P) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut executables = Vec::new();
    let mut entries = fs::read_dir(dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.is_file() && is_executable(&path).await {
            executables.push(path);
        }
    }

    Ok(executables)
}

/// 计算文件的校验和（SHA-256）
pub async fn calculate_checksum<P: AsRef<Path>>(path: P) -> Result<String, std::io::Error> {
    use sha2::{Digest, Sha256};
    
    let content = fs::read(path).await?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    let result = hasher.finalize();
    
    Ok(format!("{:x}", result))
}