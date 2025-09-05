import { useMemo, useState } from 'react';
import { Grid, List, SortAsc, SortDesc } from 'lucide-react';
import type { BrowserInfo } from '../../types';
import { BrowserCard } from './BrowserCard';
import { Button } from '../ui';

interface BrowserListProps {
  browsers: BrowserInfo[];
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onBrowserAction: (action: string, browserId: string) => void;
}

export function BrowserList({
  browsers,
  searchQuery,
  sortBy,
  sortOrder,
  onBrowserAction
}: BrowserListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 过滤和排序浏览器列表
  const filteredAndSortedBrowsers = useMemo(() => {
    let filtered = browsers;

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = browsers.filter(browser =>
        browser.version.toLowerCase().includes(query) ||
        browser.browser_type.toLowerCase().includes(query) ||
        browser.platform.toLowerCase().includes(query)
      );
    }

    // 排序
    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'version':
          aValue = a.version;
          bValue = b.version;
          break;
        case 'date':
          aValue = new Date(a.download_date).getTime();
          bValue = new Date(b.download_date).getTime();
          break;
        case 'name':
          aValue = a.browser_type;
          bValue = b.browser_type;
          break;
        default:
          aValue = new Date(a.download_date).getTime();
          bValue = new Date(b.download_date).getTime();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [browsers, searchQuery, sortBy, sortOrder]);

  const handleBrowserOpen = (id: string) => {
    onBrowserAction('open', id);
  };

  const handleBrowserDelete = (id: string) => {
    onBrowserAction('delete', id);
  };

  const handleBrowserDetails = (id: string) => {
    onBrowserAction('details', id);
  };

  const handleSortToggle = () => {
    onBrowserAction('sort', sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">
              已安装版本 ({filteredAndSortedBrowsers.length})
            </h2>
            
            {searchQuery && (
              <span className="text-sm text-gray-500">
                搜索 "{searchQuery}" 的结果
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* 排序按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSortToggle}
              className="flex items-center space-x-1"
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
              <span>排序</span>
            </Button>

            {/* 视图切换 */}
            <div className="flex items-center border border-gray-300 rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none border-r border-gray-300"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 浏览器列表内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAndSortedBrowsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? '未找到匹配的浏览器版本' : '暂无已安装的浏览器版本'}
              </h3>
              <p className="text-sm">
                {searchQuery 
                  ? '尝试调整搜索条件'
                  : '点击上方的"下载"按钮开始下载浏览器版本'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
          }>
            {filteredAndSortedBrowsers.map((browser) => (
              <BrowserCard
                key={browser.id}
                browser={browser}
                onOpen={handleBrowserOpen}
                onDelete={handleBrowserDelete}
                onShowDetails={handleBrowserDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}