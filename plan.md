# Chrome版本管理工具 - 技术实现计划

## 技术架构设计

### 整体架构
```
┌─────────────────┐    IPC     ┌─────────────────┐
│   React前端     │ ←─────────→ │   Rust后端      │
│                 │            │                 │
│ - 组件层        │            │ - Tauri Commands│
│ - 状态管理层    │            │ - 业务逻辑层    │
│ - UI展示层      │            │ - 数据存储层    │
└─────────────────┘            └─────────────────┘
                                        │
                               ┌────────┴────────┐
                               │                 │
                          ┌─────────┐    ┌─────────────┐
                          │文件系统 │    │@puppeteer/  │
                          │管理     │    │browsers API │
                          └─────────┘    └─────────────┘
```

### 技术栈选型

#### 前端技术栈
- **框架**：React 19 + TypeScript
- **构建工具**：Vite 7
- **状态管理**：Zustand + Immer（轻量、易用、类型安全）
- **UI库**：自定义组件 + Tailwind CSS（保证简洁设计）
- **图标库**：Lucide React（统一现代图标风格）
- **工具库**：date-fns（日期处理）、clsx（类名处理）

#### 后端技术栈  
- **框架**：Tauri 2.8+
- **语言**：Rust 1.77+
- **数据存储**：SQLite + sqlx（结构化数据存储）
- **Node.js集成**：通过子进程调用@puppeteer/browsers API
- **JSON处理**：serde + serde_json
- **日志系统**：tracing + tracing-subscriber
- **文件处理**：tokio（异步文件操作）
- **进程管理**：tokio::process（管理Node.js子进程）

#### 第三方集成
- **浏览器管理**：@puppeteer/browsers v2.10.8+（核心下载引擎）
- **Node.js运行时**：通过Rust子进程调用Node.js脚本
- **进度通信**：通过stdout/stdin与Node.js进程通信
- **文件系统**：基于@puppeteer/browsers自动解压安装

## 数据模型设计

### 核心数据结构

#### 浏览器信息模型
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BrowserInfo {
    pub id: String,                    // 唯一标识符
    pub browser_type: BrowserType,     // 浏览器类型
    pub version: String,               // 版本号
    pub platform: String,              // 平台架构
    pub install_path: PathBuf,         // 安装路径
    pub executable_path: PathBuf,      // 可执行文件路径
    pub download_date: DateTime<Utc>,  // 下载日期
    pub file_size: u64,                // 文件大小
    pub is_running: bool,              // 是否正在运行
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum BrowserType {
    Chrome,
    Chromium,
    // 预留扩展：Firefox, Edge
}
```

#### 下载任务模型
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadTask {
    pub id: String,
    pub browser_info: BrowserInfo,
    pub status: DownloadStatus,
    pub progress: f64,              // 0.0 - 1.0 (基于@puppeteer/browsers进度回调)
    pub downloaded_bytes: u64,      // 已下载字节数
    pub total_bytes: u64,           // 总文件大小
    pub estimated_time_remaining: Option<u64>, // 估算剩余时间（秒）
    pub error_message: Option<String>,
    pub retry_count: u32,           // 重试次数
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Completed,
    Failed,
    Retrying,                       // 重试中
}
```

### 数据库设计
```sql
-- 浏览器信息表
CREATE TABLE browsers (
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
);

-- 下载任务表
CREATE TABLE download_tasks (
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
);

-- 应用配置表
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 前端架构设计

### 组件层次结构
```
App
├── Layout
│   ├── Header (搜索栏、操作按钮)
│   ├── Sidebar (可选：分类导航)
│   └── MainContent
│       ├── DownloadManager (下载管理区域)
│       │   ├── DownloadQueue
│       │   └── DownloadProgress
│       └── BrowserList (浏览器列表区域)
│           ├── BrowserGrid
│           └── BrowserCard
└── Modals
    ├── BrowserDetailModal
    ├── DownloadModal
    └── SettingsModal
```

### 状态管理设计
```typescript
// 主状态结构
interface AppState {
  browsers: BrowserInfo[];
  downloadTasks: DownloadTask[];
  ui: {
    selectedBrowser: string | null;
    searchQuery: string;
    sortBy: 'version' | 'date' | 'name';
    sortOrder: 'asc' | 'desc';
    viewMode: 'grid' | 'list';
    theme: 'light' | 'dark';
  };
  app: {
    isLoading: boolean;
    error: string | null;
    notifications: Notification[];
  };
}

// Zustand Store切片
interface BrowserStore {
  browsers: BrowserInfo[];
  actions: {
    fetchBrowsers: () => Promise<void>;
    addBrowser: (browser: BrowserInfo) => void;
    deleteBrowser: (id: string) => Promise<void>;
    openBrowser: (id: string) => Promise<void>;
  };
}

interface DownloadStore {
  downloadTasks: DownloadTask[];
  actions: {
    startDownload: (version: string, browserType?: string) => Promise<void>;
    retryDownload: (id: string) => Promise<void>;
    updateProgress: (id: string, progress: DownloadProgress) => void;
    removeCompletedTask: (id: string) => void;
  };
}

interface DownloadProgress {
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  estimatedTimeRemaining?: number;
}
```

### 组件接口设计
```typescript
// 核心组件Props类型
interface BrowserCardProps {
  browser: BrowserInfo;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onShowDetails: (id: string) => void;
}

interface DownloadProgressProps {
  task: DownloadTask;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

interface BrowserListProps {
  browsers: BrowserInfo[];
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

## 后端架构设计

### Tauri Commands结构
```rust
// 浏览器管理相关命令
#[tauri::command]
async fn list_browsers() -> Result<Vec<BrowserInfo>, String>;

#[tauri::command] 
async fn download_browser(version: String, platform: String) -> Result<String, String>;

#[tauri::command]
async fn delete_browser(browser_id: String) -> Result<(), String>;

#[tauri::command]
async fn open_browser(browser_id: String, args: Option<Vec<String>>) -> Result<(), String>;

#[tauri::command]
async fn get_download_progress(task_id: String) -> Result<DownloadTask, String>;

#[tauri::command]
async fn retry_download(task_id: String) -> Result<(), String>;

#[tauri::command]
async fn remove_download_task(task_id: String) -> Result<(), String>;

// 系统信息相关命令
#[tauri::command]
async fn get_available_versions() -> Result<Vec<ChromeVersion>, String>;

#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String>;
```

### 服务层设计
```rust
// 浏览器管理服务
pub struct BrowserManager {
    db: Database,
    download_manager: Arc<DownloadManager>,
}

impl BrowserManager {
    pub async fn list_browsers(&self) -> Result<Vec<BrowserInfo>>;
    pub async fn install_browser(&self, version: &str) -> Result<BrowserInfo>;
    pub async fn delete_browser(&self, id: &str) -> Result<()>;
    pub async fn launch_browser(&self, id: &str, args: Option<Vec<String>>) -> Result<()>;
}

// 下载管理服务（基于@puppeteer/browsers）
pub struct DownloadManager {
    active_downloads: Arc<Mutex<HashMap<String, JoinHandle<()>>>>,
    progress_store: Arc<Mutex<HashMap<String, DownloadProgress>>>,
    nodejs_runtime: Arc<NodejsRuntime>,  // 运行@puppeteer/browsers的Node.js环境
}

impl DownloadManager {
    pub async fn start_download(&self, task: DownloadTask) -> Result<String>;
    pub async fn retry_download(&self, task_id: &str) -> Result<()>;
    pub async fn remove_task(&self, task_id: &str) -> Result<()>;
    pub fn get_progress(&self, task_id: &str) -> Option<DownloadProgress>;
    pub async fn install_browser_via_puppeteer(&self, browser_type: &str, version: &str, progress_callback: ProgressCallback) -> Result<()>;
}

// 数据库服务
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn save_browser(&self, browser: &BrowserInfo) -> Result<()>;
    pub async fn get_browsers(&self) -> Result<Vec<BrowserInfo>>;
    pub async fn delete_browser(&self, id: &str) -> Result<()>;
    pub async fn update_download_progress(&self, task_id: &str, progress: f64) -> Result<()>;
}
```

## 实现步骤规划

### 第一阶段：基础架构搭建（1-2周）

#### 后端基础设施
1. **项目结构重构**
   - 创建模块化的Rust项目结构
   - 设置数据库连接和迁移
   - 配置日志系统和错误处理

2. **核心数据模型**
   - 实现BrowserInfo和DownloadTask结构
   - 创建数据库Schema和迁移脚本
   - 实现基础的数据库CRUD操作

3. **Tauri命令框架**
   - 实现基础的Tauri命令结构
   - 设置命令错误处理和序列化
   - 配置前后端通信接口

#### 前端基础设施
1. **项目依赖安装**
   - 安装Zustand、Tailwind CSS、Lucide React等依赖
   - 配置TypeScript严格模式
   - 设置ESLint和Prettier规则

2. **基础组件开发**
   - 创建Layout组件和基础UI组件
   - 实现响应式布局框架
   - 设置主题切换基础架构

3. **状态管理设置**
   - 配置Zustand Store结构
   - 实现基础的状态切片
   - 设置前后端数据同步逻辑

### 第二阶段：核心功能开发（2-3周）

#### 浏览器列表功能
1. **后端实现**
   - 实现`list_browsers`命令
   - 集成@puppeteer/browsers API
   - 实现浏览器元数据收集

2. **前端实现**
   - 开发BrowserList和BrowserCard组件
   - 实现搜索和排序功能
   - 添加加载状态和错误处理

#### 浏览器下载功能
1. **Node.js脚本开发**
   - 创建调用@puppeteer/browsers API的Node.js脚本
   - 实现进度回调和状态通信
   - 处理下载错误和重试逻辑

2. **后端实现**
   - 实现`download_browser`命令（通过Node.js子进程）
   - 集成下载进度追踪（基于@puppeteer/browsers回调）
   - 实现重试机制和错误处理

3. **前端实现**
   - 开发DownloadManager组件
   - 实现实时进度条显示（百分比+剩余时间）
   - 添加重试和移除任务功能

#### 浏览器操作功能
1. **后端实现**
   - 实现`open_browser`和`delete_browser`命令
   - 添加进程管理和文件清理
   - 实现安全检查和权限验证

2. **前端实现**
   - 添加操作按钮和确认对话框
   - 实现操作状态反馈
   - 添加批量操作支持

### 第三阶段：用户体验优化（1-2周）

#### UI/UX改进
1. **视觉设计优化**
   - 实现现代化的卡片设计
   - 添加微交互和动画效果
   - 优化色彩搭配和间距

2. **交互体验提升**
   - 添加键盘快捷键支持
   - 实现拖拽排序功能
   - 优化加载和错误状态

#### 性能优化
1. **前端性能**
   - 实现虚拟列表优化大量数据
   - 添加图片懒加载
   - 优化状态更新频率

2. **后端性能**
   - 实现并发下载管理
   - 添加下载缓存机制
   - 优化数据库查询

### 第四阶段：高级功能和测试（1-2周）

#### 高级功能
1. **配置管理**
   - 实现应用设置界面
   - 添加启动参数配置
   - 支持代理设置

2. **系统集成**
   - 实现系统通知
   - 添加开机自启选项
   - 支持文件关联

#### 测试和打包
1. **功能测试**
   - 编写单元测试用例
   - 进行集成测试
   - 执行用户验收测试

2. **多平台打包**
   - 配置Windows、macOS、Linux打包
   - 创建安装程序
   - 设置自动更新机制

## 风险评估与应对

### 技术风险
1. **@puppeteer/browsers API限制**
   - 风险：不支持暂停/恢复、断点续传功能
   - 应对：实现完整重试机制，优化用户体验反馈

2. **Node.js进程通信复杂性**
   - 风险：Rust与Node.js进程间通信可能不稳定
   - 应对：实现健壮的进程管理和错误恢复机制

3. **文件系统权限问题**
   - 风险：不同平台的权限控制差异
   - 应对：实现权限检查和用户提示

4. **网络下载稳定性**
   - 风险：下载中断或失败（无法断点续传）
   - 应对：实现智能重试机制和网络状态检测

### 性能风险
1. **大文件下载内存占用**
   - 风险：内存泄漏或占用过高
   - 应对：流式下载和内存监控

2. **UI渲染性能**
   - 风险：大量浏览器版本导致界面卡顿
   - 应对：虚拟化列表和懒加载

### 用户体验风险
1. **操作复杂度**
   - 风险：功能过多导致界面复杂
   - 应对：渐进式界面设计和操作引导

2. **错误处理不当**
   - 风险：错误信息不明确
   - 应对：友好的错误提示和操作建议

## 成功指标

### 功能指标
- 支持Chrome 70+、Firefox、ChromeDriver版本下载（基于@puppeteer/browsers）
- 下载成功率 > 95%（含重试机制）
- 下载进度更新实时性 < 2秒延迟
- 应用启动时间 < 3秒

### 性能指标
- 内存占用 < 150MB（10个浏览器版本）
- UI响应时间 < 300ms
- 大列表滚动帧率 > 60fps
- 数据库查询时间 < 100ms

### 用户体验指标
- 新用户完成首次下载时间 < 5分钟
- 界面操作学习成本 < 10分钟
- 用户满意度评分 > 4.5/5
- 应用崩溃率 < 0.1%