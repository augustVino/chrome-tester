use serde::{Deserialize, Serialize};

/// 浏览器启动参数配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserLaunchConfig {
    pub id: String,
    pub name: String,                    // 配置名称
    pub description: String,              // 配置描述
    pub browser_id: Option<String>,       // 关联的浏览器ID，None表示全局配置
    pub parameters: Vec<LaunchParameter>, // 启动参数列表
    pub is_enabled: bool,                // 是否启用
    pub is_default: bool,                // 是否为默认配置
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// 单个启动参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchParameter {
    pub id: String,
    pub name: String,           // 参数名称/显示名
    pub flag: String,          // 实际的命令行标志 (如 "--disable-web-security")
    pub value: Option<String>, // 参数值 (如果有的话)
    pub description: String,   // 参数描述
    pub category: ParameterCategory,
    pub is_enabled: bool,
    pub is_dangerous: bool,    // 是否为危险参数（需要警告用户）
}

/// 参数分类
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParameterCategory {
    Security,      // 安全相关
    Performance,   // 性能优化
    Development,   // 开发调试
    Privacy,       // 隐私设置
    Experimental,  // 实验性功能
    Network,       // 网络设置
    UI,           // 界面设置
    Automation,   // 自动化相关
    Custom,       // 自定义
}

/// 预设参数模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: TemplateCategory,
    pub parameters: Vec<LaunchParameter>,
    pub is_builtin: bool, // 是否为内置模板
}

/// 模板分类
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TemplateCategory {
    Testing,      // 测试用途
    Development,  // 开发用途
    Privacy,      // 隐私保护
    Performance,  // 性能优化
    Automation,   // 自动化测试
    Security,     // 安全测试
}

impl BrowserLaunchConfig {
    pub fn new(name: String, description: String) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            description,
            browser_id: None,
            parameters: Vec::new(),
            is_enabled: true,
            is_default: false,
            created_at: now,
            updated_at: now,
        }
    }

    /// 添加参数
    pub fn add_parameter(&mut self, parameter: LaunchParameter) {
        self.parameters.push(parameter);
        self.updated_at = chrono::Utc::now();
    }

    /// 移除参数
    pub fn remove_parameter(&mut self, parameter_id: &str) -> bool {
        if let Some(pos) = self.parameters.iter().position(|p| p.id == parameter_id) {
            self.parameters.remove(pos);
            self.updated_at = chrono::Utc::now();
            true
        } else {
            false
        }
    }

    /// 获取启用的参数列表
    pub fn get_enabled_parameters(&self) -> Vec<&LaunchParameter> {
        self.parameters.iter().filter(|p| p.is_enabled).collect()
    }

    /// 转换为命令行参数
    pub fn to_command_args(&self) -> Vec<String> {
        self.get_enabled_parameters()
            .into_iter()
            .flat_map(|param| {
                if let Some(value) = &param.value {
                    if value.is_empty() {
                        vec![param.flag.clone()]
                    } else {
                        vec![param.flag.clone(), value.clone()]
                    }
                } else {
                    vec![param.flag.clone()]
                }
            })
            .collect()
    }

    /// 获取危险参数数量
    pub fn dangerous_parameter_count(&self) -> usize {
        self.parameters.iter().filter(|p| p.is_enabled && p.is_dangerous).count()
    }
}

impl LaunchParameter {
    pub fn new(name: String, flag: String, category: ParameterCategory) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            flag,
            value: None,
            description: String::new(),
            category,
            is_enabled: true,
            is_dangerous: false,
        }
    }

    pub fn with_value(mut self, value: String) -> Self {
        self.value = Some(value);
        self
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = description;
        self
    }

    pub fn dangerous(mut self) -> Self {
        self.is_dangerous = true;
        self
    }
}

impl ParameterTemplate {
    /// 获取内置模板列表
    pub fn get_builtin_templates() -> Vec<ParameterTemplate> {
        vec![
            Self::create_testing_template(),
            Self::create_development_template(),
            Self::create_privacy_template(),
            Self::create_performance_template(),
            Self::create_automation_template(),
            Self::create_security_testing_template(),
        ]
    }

    fn create_testing_template() -> ParameterTemplate {
        ParameterTemplate {
            id: "testing".to_string(),
            name: "测试模式".to_string(),
            description: "适用于网站测试的浏览器配置".to_string(),
            category: TemplateCategory::Testing,
            is_builtin: true,
            parameters: vec![
                LaunchParameter::new(
                    "禁用Web安全".to_string(),
                    "--disable-web-security".to_string(),
                    ParameterCategory::Security,
                ).with_description("禁用同源策略，允许跨域请求".to_string()).dangerous(),
                
                LaunchParameter::new(
                    "允许运行不安全内容".to_string(),
                    "--allow-running-insecure-content".to_string(),
                    ParameterCategory::Security,
                ).with_description("允许HTTPS页面加载HTTP资源".to_string()).dangerous(),
                
                LaunchParameter::new(
                    "禁用扩展".to_string(),
                    "--disable-extensions".to_string(),
                    ParameterCategory::Performance,
                ).with_description("禁用所有浏览器扩展".to_string()),
                
                LaunchParameter::new(
                    "忽略证书错误".to_string(),
                    "--ignore-certificate-errors".to_string(),
                    ParameterCategory::Security,
                ).with_description("忽略SSL证书错误".to_string()).dangerous(),
            ],
        }
    }

    fn create_development_template() -> ParameterTemplate {
        ParameterTemplate {
            id: "development".to_string(),
            name: "开发调试".to_string(),
            description: "适用于Web开发的浏览器配置".to_string(),
            category: TemplateCategory::Development,
            is_builtin: true,
            parameters: vec![
                LaunchParameter::new(
                    "开启开发者工具".to_string(),
                    "--auto-open-devtools-for-tabs".to_string(),
                    ParameterCategory::Development,
                ).with_description("自动为所有标签页打开开发者工具".to_string()),
                
                LaunchParameter::new(
                    "禁用缓存".to_string(),
                    "--disable-application-cache".to_string(),
                    ParameterCategory::Development,
                ).with_description("禁用应用程序缓存".to_string()),
                
                LaunchParameter::new(
                    "启用实验性Web功能".to_string(),
                    "--enable-experimental-web-platform-features".to_string(),
                    ParameterCategory::Experimental,
                ).with_description("启用实验性的Web平台功能".to_string()),
                
                LaunchParameter::new(
                    "详细日志".to_string(),
                    "--enable-logging".to_string(),
                    ParameterCategory::Development,
                ).with_description("启用详细的浏览器日志".to_string()),
            ],
        }
    }

    fn create_privacy_template() -> ParameterTemplate {
        ParameterTemplate {
            id: "privacy".to_string(),
            name: "隐私保护".to_string(),
            description: "注重隐私保护的浏览器配置".to_string(),
            category: TemplateCategory::Privacy,
            is_builtin: true,
            parameters: vec![
                LaunchParameter::new(
                    "隐身模式".to_string(),
                    "--incognito".to_string(),
                    ParameterCategory::Privacy,
                ).with_description("以隐身模式启动浏览器".to_string()),
                
                LaunchParameter::new(
                    "禁用地理位置".to_string(),
                    "--disable-geolocation".to_string(),
                    ParameterCategory::Privacy,
                ).with_description("禁用地理位置API".to_string()),
                
                LaunchParameter::new(
                    "禁用通知".to_string(),
                    "--disable-notifications".to_string(),
                    ParameterCategory::Privacy,
                ).with_description("禁用桌面通知".to_string()),
                
                LaunchParameter::new(
                    "不发送使用统计".to_string(),
                    "--disable-background-networking".to_string(),
                    ParameterCategory::Privacy,
                ).with_description("禁用后台网络连接".to_string()),
            ],
        }
    }

    fn create_performance_template() -> ParameterTemplate {
        ParameterTemplate {
            id: "performance".to_string(),
            name: "性能优化".to_string(),
            description: "优化浏览器性能的配置".to_string(),
            category: TemplateCategory::Performance,
            is_builtin: true,
            parameters: vec![
                LaunchParameter::new(
                    "禁用图片".to_string(),
                    "--disable-images".to_string(),
                    ParameterCategory::Performance,
                ).with_description("禁用图片加载以提高性能".to_string()),
                
                LaunchParameter::new(
                    "最大内存使用".to_string(),
                    "--max_old_space_size".to_string(),
                    ParameterCategory::Performance,
                ).with_value("1024".to_string()).with_description("设置最大内存使用量(MB)".to_string()),
                
                LaunchParameter::new(
                    "禁用插件".to_string(),
                    "--disable-plugins".to_string(),
                    ParameterCategory::Performance,
                ).with_description("禁用所有插件".to_string()),
                
                LaunchParameter::new(
                    "GPU加速".to_string(),
                    "--enable-gpu-rasterization".to_string(),
                    ParameterCategory::Performance,
                ).with_description("启用GPU光栅化加速".to_string()),
            ],
        }
    }

    fn create_automation_template() -> ParameterTemplate {
        ParameterTemplate {
            id: "automation".to_string(),
            name: "自动化测试".to_string(),
            description: "适用于自动化测试的浏览器配置".to_string(),
            category: TemplateCategory::Automation,
            is_builtin: true,
            parameters: vec![
                LaunchParameter::new(
                    "无头模式".to_string(),
                    "--headless".to_string(),
                    ParameterCategory::Automation,
                ).with_description("以无头模式运行（无界面）".to_string()),
                
                LaunchParameter::new(
                    "禁用GPU".to_string(),
                    "--disable-gpu".to_string(),
                    ParameterCategory::Automation,
                ).with_description("禁用GPU硬件加速".to_string()),
                
                LaunchParameter::new(
                    "远程调试端口".to_string(),
                    "--remote-debugging-port".to_string(),
                    ParameterCategory::Automation,
                ).with_value("9222".to_string()).with_description("设置远程调试端口".to_string()),
                
                LaunchParameter::new(
                    "禁用沙箱".to_string(),
                    "--no-sandbox".to_string(),
                    ParameterCategory::Security,
                ).with_description("禁用沙箱模式（仅限测试环境）".to_string()).dangerous(),
            ],
        }
    }

    fn create_security_testing_template() -> ParameterTemplate {
        ParameterTemplate {
            id: "security_testing".to_string(),
            name: "安全测试".to_string(),
            description: "用于安全测试的浏览器配置".to_string(),
            category: TemplateCategory::Security,
            is_builtin: true,
            parameters: vec![
                LaunchParameter::new(
                    "禁用XSS审计".to_string(),
                    "--disable-xss-auditor".to_string(),
                    ParameterCategory::Security,
                ).with_description("禁用XSS保护机制".to_string()).dangerous(),
                
                LaunchParameter::new(
                    "允许所有来源".to_string(),
                    "--disable-features=VizDisplayCompositor".to_string(),
                    ParameterCategory::Security,
                ).with_description("允许来自所有来源的请求".to_string()).dangerous(),
                
                LaunchParameter::new(
                    "忽略SSL错误".to_string(),
                    "--ignore-ssl-errors".to_string(),
                    ParameterCategory::Security,
                ).with_description("忽略所有SSL错误".to_string()).dangerous(),
                
                LaunchParameter::new(
                    "禁用同源策略".to_string(),
                    "--disable-web-security".to_string(),
                    ParameterCategory::Security,
                ).with_description("禁用Web安全策略".to_string()).dangerous(),
            ],
        }
    }
}

impl ParameterCategory {
    pub fn display_name(&self) -> &'static str {
        match self {
            ParameterCategory::Security => "安全设置",
            ParameterCategory::Performance => "性能优化",
            ParameterCategory::Development => "开发调试",
            ParameterCategory::Privacy => "隐私保护",
            ParameterCategory::Experimental => "实验功能",
            ParameterCategory::Network => "网络设置",
            ParameterCategory::UI => "界面设置",
            ParameterCategory::Automation => "自动化",
            ParameterCategory::Custom => "自定义",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            ParameterCategory::Security => "🔒",
            ParameterCategory::Performance => "⚡",
            ParameterCategory::Development => "🛠️",
            ParameterCategory::Privacy => "👤",
            ParameterCategory::Experimental => "🧪",
            ParameterCategory::Network => "🌐",
            ParameterCategory::UI => "🎨",
            ParameterCategory::Automation => "🤖",
            ParameterCategory::Custom => "⚙️",
        }
    }
}

impl TemplateCategory {
    pub fn display_name(&self) -> &'static str {
        match self {
            TemplateCategory::Testing => "测试用途",
            TemplateCategory::Development => "开发用途", 
            TemplateCategory::Privacy => "隐私保护",
            TemplateCategory::Performance => "性能优化",
            TemplateCategory::Automation => "自动化测试",
            TemplateCategory::Security => "安全测试",
        }
    }
}