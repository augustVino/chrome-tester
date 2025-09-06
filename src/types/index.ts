// 浏览器相关类型
export interface BrowserInfo {
  id: string;
  browser_type: BrowserType;
  version: string;
  platform: string;
  install_path: string;
  executable_path: string;
  download_date: string;
  file_size: number;
  is_running: boolean;
}

export type BrowserType = 'Chrome' | 'Chromium' | 'Firefox' | 'ChromeDriver';

// 下载相关类型
export interface DownloadTask {
  id: string;
  browser_info: BrowserInfo;
  status: DownloadStatus;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  estimated_time_remaining?: number;
  error_message?: string;
  retry_count: number;
}

export type DownloadStatus = 'Pending' | 'Downloading' | 'Completed' | 'Failed' | 'Retrying';

export interface DownloadProgress {
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  estimated_time_remaining?: number;
}

// 系统信息相关类型
export interface SystemInfo {
  platform: string;
  arch: string;
  available_versions: ChromeVersion[];
}

export interface ChromeVersion {
  version: string;
  platform: string;
  download_url?: string;
  file_size?: number;
  release_date?: string;
}

// UI 状态相关类型
export interface AppState {
  browsers: BrowserInfo[];
  downloadTasks: DownloadTask[];
  ui: UIState;
  app: AppConfig;
}

export interface UIState {
  selectedBrowser: string | null;
  searchQuery: string;
  sortBy: 'version' | 'date' | 'name';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
  isLoading: boolean;
  error: string | null;
}

export interface AppConfig {
  downloadPath?: string;
}


// 通知相关类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: NotificationAction;
}

export interface NotificationAction {
  label: string;
  callback: () => void;
}

// 组件 Props 类型
export interface BrowserCardProps {
  browser: BrowserInfo;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onShowDetails: (id: string) => void;
}

export interface DownloadProgressProps {
  task: DownloadTask;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export interface BrowserListProps {
  browsers: BrowserInfo[];
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onBrowserAction: (action: string, browserId: string) => void;
}

// Modal 相关类型
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface DownloadModalProps extends ModalProps {
  onStartDownload: (browserType: BrowserType, version: string) => void;
  availableVersions: ChromeVersion[];
  isLoading?: boolean;
}

// 错误类型
export interface AppError {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
}

// Tauri 命令返回类型
export type TauriResult<T> = Promise<T>;
export type TauriCommand<T = void> = (...args: unknown[]) => TauriResult<T>;

// 事件类型
export interface AppEvent {
  type: string;
  payload?: unknown;
  timestamp: number;
}