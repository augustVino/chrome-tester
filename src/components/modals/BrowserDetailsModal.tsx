import { useState, useEffect } from 'react';
import { 
  Folder, 
  Calendar, 
  HardDrive, 
  Monitor, 
  Tag, 
  Play, 
  Trash2, 
  Copy, 
  ExternalLink,
  Chrome
} from 'lucide-react';
import { format } from 'date-fns';
import { Modal, Button, ConfirmModal } from '../ui';
import type { BrowserInfo, BrowserType } from '../../types';
import { useBrowserStore, useUIStore } from '../../stores';

interface BrowserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  browserId?: string;
}

export function BrowserDetailsModal({ isOpen, onClose, browserId }: BrowserDetailsModalProps) {
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const browsers = useBrowserStore(state => state.browsers);
  const deleteBrowser = useBrowserStore(state => state.deleteBrowser);
  const openBrowser = useBrowserStore(state => state.openBrowser);
  const addNotification = useUIStore(state => state.addNotification);

  // 当模态框打开且有浏览器ID时，查找浏览器信息
  useEffect(() => {
    if (isOpen && browserId) {
      const foundBrowser = browsers.find(b => b.id === browserId);
      setBrowser(foundBrowser || null);
    } else {
      setBrowser(null);
    }
  }, [isOpen, browserId, browsers]);

  if (!browser) {
    return null;
  }

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy年MM月dd日 HH:mm');
    } catch {
      return '未知';
    }
  };

  const getBrowserIcon = (browserType: BrowserType) => {
    switch (browserType) {
      case 'Chrome':
      case 'Chromium':
      case 'ChromeDriver':
        return <Chrome className="h-8 w-8 text-blue-500" />;
      case 'Firefox':
        return <Chrome className="h-8 w-8 text-orange-500" />;
      default:
        return <Chrome className="h-8 w-8 text-gray-500" />;
    }
  };

  const getBrowserDescription = (browserType: BrowserType) => {
    switch (browserType) {
      case 'Chrome':
        return 'Google Chrome 浏览器';
      case 'Chromium':
        return 'Chromium 开源浏览器';
      case 'Firefox':
        return 'Mozilla Firefox 浏览器';
      case 'ChromeDriver':
        return 'Chrome WebDriver 自动化工具';
      default:
        return '浏览器';
    }
  };

  const handleOpenBrowser = async () => {
    try {
      await openBrowser(browser.id);
      addNotification({
        type: 'success',
        title: '启动成功',
        message: '浏览器已在后台运行'
      });
      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '启动失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  const handleDeleteBrowser = async () => {
    try {
      await deleteBrowser(browser.id);
      addNotification({
        type: 'success',
        title: '删除成功',
        message: '浏览器已从系统中移除'
      });
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '删除失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addNotification({
        type: 'success',
        title: '复制成功',
        message: `已复制${label}到剪贴板`
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: '复制失败',
        message: '无法复制到剪贴板'
      });
    }
  };

  const openInExplorer = () => {
    // TODO: 实现在文件管理器中打开功能
    addNotification({
      type: 'info',
      title: '功能开发中',
      message: '在文件管理器中打开功能即将推出'
    });
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="浏览器详情"
        className="max-w-2xl"
      >
        <div className="space-y-6">
          {/* 浏览器基本信息 */}
          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {getBrowserIcon(browser.browser_type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {browser.browser_type} {browser.version}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {getBrowserDescription(browser.browser_type)}
              </p>
              <div className="mt-2 flex items-center space-x-4 text-sm">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  browser.is_running 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {browser.is_running ? '运行中' : '未运行'}
                </span>
                <span className="text-gray-500">
                  平台: {browser.platform}
                </span>
              </div>
            </div>
          </div>

          {/* 详细信息 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">详细信息</h4>
            
            <div className="grid grid-cols-1 gap-4">
              {/* 版本信息 */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Tag className="h-4 w-4" />
                  <span>版本号</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-mono text-gray-900">{browser.version}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(browser.version, '版本号')}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* 平台信息 */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Monitor className="h-4 w-4" />
                  <span>平台架构</span>
                </div>
                <span className="text-sm text-gray-900">{browser.platform}</span>
              </div>

              {/* 文件大小 */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <HardDrive className="h-4 w-4" />
                  <span>文件大小</span>
                </div>
                <span className="text-sm text-gray-900">{formatFileSize(browser.file_size)}</span>
              </div>

              {/* 安装日期 */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>安装日期</span>
                </div>
                <span className="text-sm text-gray-900">{formatDate(browser.download_date)}</span>
              </div>

              {/* 安装路径 */}
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Folder className="h-4 w-4" />
                    <span>安装路径</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(browser.install_path, '安装路径')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={openInExplorer}
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-700 break-all">
                  {browser.install_path}
                </div>
              </div>

              {/* 可执行文件路径 */}
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Play className="h-4 w-4" />
                    <span>可执行文件</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(browser.executable_path, '可执行文件路径')}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-700 break-all">
                  {browser.executable_path}
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={browser.is_running}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              <Trash2 className="h-4 w-4" />
              <span>删除浏览器</span>
            </Button>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                关闭
              </Button>
              <Button
                variant="primary"
                onClick={handleOpenBrowser}
                disabled={browser.is_running}
                className="flex items-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>启动浏览器</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认对话框 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteBrowser}
        title="删除浏览器"
        message={`确定要删除 ${browser.browser_type} ${browser.version} 吗？此操作将删除所有相关文件，无法撤销。`}
        confirmText="确认删除"
        cancelText="取消"
        variant="danger"
      />
    </>
  );
}