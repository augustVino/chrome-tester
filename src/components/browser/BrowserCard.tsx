import { Play, Trash2, Info, Chrome } from 'lucide-react';
import { format } from 'date-fns';
import type { BrowserInfo } from '../../types';
import { Button } from '../ui';

interface BrowserCardProps {
  browser: BrowserInfo;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onShowDetails: (id: string) => void;
}

export function BrowserCard({ 
  browser, 
  onOpen, 
  onDelete, 
  onShowDetails 
}: BrowserCardProps) {
  const getBrowserIcon = (browserType: string) => {
    switch (browserType) {
      case 'Chrome':
      case 'Chromium':
        return <Chrome className="h-8 w-8 text-blue-500" />;
      default:
        return <Chrome className="h-8 w-8 text-gray-500" />;
    }
  };

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
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
    } catch {
      return '未知';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-200">
      {/* 头部信息 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getBrowserIcon(browser.browser_type)}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {browser.browser_type}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              v{browser.version}
            </p>
          </div>
        </div>
        
      </div>

      {/* 详细信息 */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">平台:</span>
          <span className="text-gray-900 dark:text-gray-100">{browser.platform}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">大小:</span>
          <span className="text-gray-900 dark:text-gray-100">{formatFileSize(browser.file_size)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">安装时间:</span>
          <span className="text-gray-900 dark:text-gray-100">{formatDate(browser.download_date)}</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => onOpen(browser.id)}
            className="flex items-center space-x-1"
          >
            <Play className="h-3 w-3" />
            <span>启动</span>
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onShowDetails(browser.id)}
            className="flex items-center space-x-1"
          >
            <Info className="h-3 w-3" />
            <span>详情</span>
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(browser.id)}
          className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
          <span>删除</span>
        </Button>
      </div>
    </div>
  );
}