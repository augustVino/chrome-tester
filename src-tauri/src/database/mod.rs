use crate::models::BrowserInfo;
use sqlx::{sqlite::SqlitePool, Row, SqlitePool as Pool};
use std::path::Path;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new<P: AsRef<Path>>(database_url: P) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(
            &format!("sqlite://{}?mode=rwc", database_url.as_ref().display())
        ).await?;

        // 运行迁移
        Self::run_migrations(&pool).await?;

        Ok(Database { pool })
    }

    async fn run_migrations(pool: &Pool) -> Result<(), sqlx::Error> {
        // 创建浏览器信息表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS browsers (
                id TEXT PRIMARY KEY,
                browser_type TEXT NOT NULL,
                version TEXT NOT NULL,
                platform TEXT NOT NULL,
                install_path TEXT NOT NULL,
                executable_path TEXT NOT NULL,
                download_date TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                is_running BOOLEAN DEFAULT FALSE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建下载任务表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS download_tasks (
                id TEXT PRIMARY KEY,
                browser_id TEXT,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0.0,
                downloaded_bytes INTEGER DEFAULT 0,
                total_bytes INTEGER DEFAULT 0,
                estimated_time_remaining INTEGER,
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (browser_id) REFERENCES browsers(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建应用配置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn save_browser(&self, browser: &BrowserInfo) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO browsers 
            (id, browser_type, version, platform, install_path, executable_path, download_date, file_size, is_running)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
        )
        .bind(&browser.id)
        .bind(format!("{:?}", browser.browser_type))
        .bind(&browser.version)
        .bind(&browser.platform)
        .bind(browser.install_path.to_string_lossy().as_ref())
        .bind(browser.executable_path.to_string_lossy().as_ref())
        .bind(browser.download_date.to_rfc3339())
        .bind(browser.file_size as i64)
        .bind(browser.is_running)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_browsers(&self) -> Result<Vec<BrowserInfo>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM browsers ORDER BY download_date DESC")
            .fetch_all(&self.pool)
            .await?;

        let mut browsers = Vec::new();
        for row in rows {
            let browser_type = match row.get::<String, _>("browser_type").as_str() {
                "Chrome" => crate::models::BrowserType::Chrome,
                "Chromium" => crate::models::BrowserType::Chromium,
                "Firefox" => crate::models::BrowserType::Firefox,
                "ChromeDriver" => crate::models::BrowserType::ChromeDriver,
                _ => crate::models::BrowserType::Chrome,
            };

            let browser = BrowserInfo {
                id: row.get("id"),
                browser_type,
                version: row.get("version"),
                platform: row.get("platform"),
                install_path: row.get::<String, _>("install_path").into(),
                executable_path: row.get::<String, _>("executable_path").into(),
                download_date: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("download_date"))
                    .unwrap()
                    .with_timezone(&chrono::Utc),
                file_size: row.get::<i64, _>("file_size") as u64,
                is_running: row.get("is_running"),
            };

            browsers.push(browser);
        }

        Ok(browsers)
    }

    pub async fn delete_browser(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM browsers WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn update_download_progress(
        &self,
        task_id: &str,
        progress: f64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE download_tasks SET progress = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        )
        .bind(progress)
        .bind(task_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_config(&self, key: &str) -> Result<Option<String>, sqlx::Error> {
        let row = sqlx::query("SELECT value FROM app_config WHERE key = ?1")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| r.get("value")))
    }

    pub async fn set_config(&self, key: &str, value: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}