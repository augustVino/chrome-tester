use crate::database::Database;
use crate::models::{BrowserLaunchConfig, LaunchParameter, ParameterTemplate, TemplateCategory};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};

pub struct ParameterManager {
    database: Arc<Database>,
    cached_configs: Arc<tokio::sync::RwLock<HashMap<String, BrowserLaunchConfig>>>,
    builtin_templates: Vec<ParameterTemplate>,
}

impl ParameterManager {
    pub fn new(database: Arc<Database>) -> Self {
        Self {
            database,
            cached_configs: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            builtin_templates: ParameterTemplate::get_builtin_templates(),
        }
    }

    /// 获取所有配置
    pub async fn get_all_configs(&self) -> Result<Vec<BrowserLaunchConfig>, String> {
        // 首先尝试从缓存获取
        {
            let cache = self.cached_configs.read().await;
            if !cache.is_empty() {
                return Ok(cache.values().cloned().collect());
            }
        }

        // 如果缓存为空，从数据库加载
        self.load_configs_from_database().await
    }

    /// 根据浏览器ID获取配置
    pub async fn get_configs_for_browser(&self, browser_id: &str) -> Result<Vec<BrowserLaunchConfig>, String> {
        let all_configs = self.get_all_configs().await?;
        
        Ok(all_configs.into_iter().filter(|config| {
            // 全局配置或特定浏览器配置
            config.browser_id.is_none() || 
            config.browser_id.as_ref() == Some(&browser_id.to_string())
        }).collect())
    }

    /// 获取默认配置
    pub async fn get_default_config(&self, browser_id: Option<&str>) -> Result<Option<BrowserLaunchConfig>, String> {
        let configs = if let Some(browser_id) = browser_id {
            self.get_configs_for_browser(browser_id).await?
        } else {
            self.get_all_configs().await?
        };

        Ok(configs.into_iter().find(|config| config.is_default))
    }

    /// 保存配置
    pub async fn save_config(&self, mut config: BrowserLaunchConfig) -> Result<(), String> {
        config.updated_at = chrono::Utc::now();
        
        // 如果设为默认配置，需要清除其他默认配置
        if config.is_default {
            self.clear_default_configs(&config.browser_id).await?;
        }

        // 保存到数据库
        self.save_config_to_database(&config).await?;

        let config_id = config.id.clone();
        
        // 更新缓存
        {
            let mut cache = self.cached_configs.write().await;
            cache.insert(config_id.clone(), config);
        }

        info!("Saved launch parameter configuration: {}", config_id);
        Ok(())
    }

    /// 删除配置
    pub async fn delete_config(&self, config_id: &str) -> Result<(), String> {
        // 从数据库删除
        self.delete_config_from_database(config_id).await?;

        // 从缓存删除
        {
            let mut cache = self.cached_configs.write().await;
            cache.remove(config_id);
        }

        info!("Deleted launch parameter configuration: {}", config_id);
        Ok(())
    }

    /// 创建新配置
    pub async fn create_config(
        &self, 
        name: String, 
        description: String, 
        browser_id: Option<String>
    ) -> Result<BrowserLaunchConfig, String> {
        let mut config = BrowserLaunchConfig::new(name, description);
        config.browser_id = browser_id;
        
        self.save_config(config.clone()).await?;
        Ok(config)
    }

    /// 从模板创建配置
    pub async fn create_config_from_template(
        &self,
        template_id: &str,
        name: String,
        browser_id: Option<String>,
    ) -> Result<BrowserLaunchConfig, String> {
        let template = self.get_template(template_id)?;
        
        let mut config = BrowserLaunchConfig::new(
            name,
            format!("基于模板 '{}' 创建", template.name),
        );
        config.browser_id = browser_id;
        config.parameters = template.parameters;
        
        self.save_config(config.clone()).await?;
        Ok(config)
    }

    /// 复制配置
    pub async fn duplicate_config(&self, config_id: &str, new_name: String) -> Result<BrowserLaunchConfig, String> {
        let original = self.get_config(config_id).await?
            .ok_or_else(|| "Configuration not found".to_string())?;

        let mut duplicated = original.clone();
        duplicated.id = uuid::Uuid::new_v4().to_string();
        duplicated.name = new_name;
        duplicated.is_default = false; // 复制的配置不能是默认配置
        duplicated.created_at = chrono::Utc::now();
        duplicated.updated_at = chrono::Utc::now();

        self.save_config(duplicated.clone()).await?;
        Ok(duplicated)
    }

    /// 获取单个配置
    pub async fn get_config(&self, config_id: &str) -> Result<Option<BrowserLaunchConfig>, String> {
        // 首先检查缓存
        {
            let cache = self.cached_configs.read().await;
            if let Some(config) = cache.get(config_id) {
                return Ok(Some(config.clone()));
            }
        }

        // 从数据库加载所有配置到缓存
        self.load_configs_from_database().await?;

        // 再次检查缓存
        {
            let cache = self.cached_configs.read().await;
            Ok(cache.get(config_id).cloned())
        }
    }

    /// 更新配置参数
    pub async fn update_config_parameters(
        &self, 
        config_id: &str, 
        parameters: Vec<LaunchParameter>
    ) -> Result<(), String> {
        let mut config = self.get_config(config_id).await?
            .ok_or_else(|| "Configuration not found".to_string())?;
        
        config.parameters = parameters;
        self.save_config(config).await
    }

    /// 设置默认配置
    pub async fn set_as_default(&self, config_id: &str) -> Result<(), String> {
        let mut config = self.get_config(config_id).await?
            .ok_or_else(|| "Configuration not found".to_string())?;

        // 清除其他默认配置
        self.clear_default_configs(&config.browser_id).await?;

        // 设置为默认
        config.is_default = true;
        self.save_config(config).await
    }

    /// 获取所有模板
    pub fn get_all_templates(&self) -> Vec<ParameterTemplate> {
        self.builtin_templates.clone()
    }

    /// 根据分类获取模板
    pub fn get_templates_by_category(&self, category: TemplateCategory) -> Vec<ParameterTemplate> {
        self.builtin_templates
            .iter()
            .filter(|t| t.category == category)
            .cloned()
            .collect()
    }

    /// 获取单个模板
    pub fn get_template(&self, template_id: &str) -> Result<ParameterTemplate, String> {
        self.builtin_templates
            .iter()
            .find(|t| t.id == template_id)
            .cloned()
            .ok_or_else(|| "Template not found".to_string())
    }

    /// 组合多个配置的参数为命令行参数
    pub async fn build_launch_args(
        &self, 
        browser_id: &str, 
        config_ids: Option<Vec<String>>
    ) -> Result<Vec<String>, String> {
        let configs = if let Some(ids) = config_ids {
            // 使用指定的配置
            let mut configs = Vec::new();
            for id in ids {
                if let Some(config) = self.get_config(&id).await? {
                    if config.is_enabled {
                        configs.push(config);
                    }
                }
            }
            configs
        } else {
            // 使用默认配置
            if let Some(default_config) = self.get_default_config(Some(browser_id)).await? {
                vec![default_config]
            } else {
                // 如果没有默认配置，使用全局默认配置
                if let Some(global_default) = self.get_default_config(None).await? {
                    vec![global_default]
                } else {
                    Vec::new()
                }
            }
        };

        // 收集所有启用的参数
        let mut all_args = Vec::new();
        for config in configs {
            if config.is_enabled {
                let args = config.to_command_args();
                all_args.extend(args);
            }
        }

        // 去重（保留最后一个重复的参数）
        let mut unique_args = Vec::new();
        let mut seen_flags = std::collections::HashSet::new();
        
        for arg in all_args.iter().rev() {
            if arg.starts_with("--") {
                if !seen_flags.contains(arg) {
                    seen_flags.insert(arg.clone());
                    unique_args.insert(0, arg.clone());
                }
            } else {
                unique_args.insert(0, arg.clone());
            }
        }

        info!("Built launch arguments for browser {}: {:?}", browser_id, unique_args);
        Ok(unique_args)
    }

    /// 验证配置安全性
    pub async fn validate_config_security(&self, config_id: &str) -> Result<SecurityValidation, String> {
        let config = self.get_config(config_id).await?
            .ok_or_else(|| "Configuration not found".to_string())?;

        let dangerous_params: Vec<&LaunchParameter> = config
            .get_enabled_parameters()
            .into_iter()
            .filter(|p| p.is_dangerous)
            .collect();

        let validation = SecurityValidation {
            is_safe: dangerous_params.is_empty(),
            dangerous_parameter_count: dangerous_params.len(),
            warnings: dangerous_params
                .into_iter()
                .map(|p| format!("危险参数: {} - {}", p.name, p.description))
                .collect(),
        };

        Ok(validation)
    }

    // 私有方法

    async fn load_configs_from_database(&self) -> Result<Vec<BrowserLaunchConfig>, String> {
        // TODO: 实现从数据库加载配置
        // 目前返回空列表，实际实现需要添加数据库表和查询
        warn!("Loading launch configurations from database not yet implemented");
        Ok(Vec::new())
    }

    async fn save_config_to_database(&self, _config: &BrowserLaunchConfig) -> Result<(), String> {
        // TODO: 实现保存配置到数据库
        warn!("Saving launch configurations to database not yet implemented");
        Ok(())
    }

    async fn delete_config_from_database(&self, _config_id: &str) -> Result<(), String> {
        // TODO: 实现从数据库删除配置
        warn!("Deleting launch configurations from database not yet implemented");
        Ok(())
    }

    async fn clear_default_configs(&self, browser_id: &Option<String>) -> Result<(), String> {
        let all_configs = self.get_all_configs().await?;
        
        for mut config in all_configs {
            if config.is_default && config.browser_id == *browser_id {
                config.is_default = false;
                self.save_config_to_database(&config).await?;
                
                // 更新缓存
                let mut cache = self.cached_configs.write().await;
                cache.insert(config.id.clone(), config);
            }
        }
        
        Ok(())
    }
}

/// 安全性验证结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SecurityValidation {
    pub is_safe: bool,
    pub dangerous_parameter_count: usize,
    pub warnings: Vec<String>,
}

impl SecurityValidation {
    pub fn has_critical_warnings(&self) -> bool {
        self.dangerous_parameter_count > 3
    }
}