import { useCallback } from 'react';
import { Layout } from './components/layout';
import { DownloadModal, BrowserDetailsModal, SettingsModal } from './components/modals';
import { NotificationContainer } from './components/ui';
import { useBrowserStore, useDownloadStore, useUIStore } from './stores';
import { useAppInit, useDownloadEvents } from './hooks';

function App() {
  const { isInitialized } = useAppInit();
  useDownloadEvents(); // Set up real-time download event listeners
  
  // Browser store
  const browsers = useBrowserStore(state => state.browsers);
  const deleteBrowser = useBrowserStore(state => state.deleteBrowser);
  const openBrowser = useBrowserStore(state => state.openBrowser);
  const fetchBrowsers = useBrowserStore(state => state.fetchBrowsers);
  const browserLoading = useBrowserStore(state => state.isLoading);
  
  // Download store
  const downloadTasks = useDownloadStore(state => state.downloadTasks);
  const retryDownload = useDownloadStore(state => state.retryDownload);
  const removeDownloadTask = useDownloadStore(state => state.removeDownloadTask);
  
  // UI store
  const searchQuery = useUIStore(state => state.searchQuery);
  const sortBy = useUIStore(state => state.sortBy);
  const sortOrder = useUIStore(state => state.sortOrder);
  const setSearchQuery = useUIStore(state => state.setSearchQuery);
  const openModal = useUIStore(state => state.openModal);
  const addNotification = useUIStore(state => state.addNotification);
  const downloadModalOpen = useUIStore(state => state.modals.downloadModal);
  const browserDetailsModalOpen = useUIStore(state => state.modals.browserDetailsModal);
  const settingsModalOpen = useUIStore(state => state.modals.settingsModal);
  const selectedBrowserForDetails = useUIStore(state => state.selectedBrowserForDetails);
  const setSelectedBrowserForDetails = useUIStore(state => state.setSelectedBrowserForDetails);
  const closeModal = useUIStore(state => state.closeModal);
  const notifications = useUIStore(state => state.notifications);
  const removeNotification = useUIStore(state => state.removeNotification);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  const handleDownload = useCallback(() => {
    openModal('downloadModal');
  }, [openModal]);

  const handleRefresh = useCallback(async () => {
    try {
      await fetchBrowsers();
      addNotification({
        type: 'success',
        title: '刷新成功',
        message: '浏览器列表已更新'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: '刷新失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  }, [fetchBrowsers, addNotification]);

  const handleSettings = useCallback(() => {
    openModal('settingsModal');
  }, [openModal]);

  const handleBrowserAction = useCallback(async (action: string, browserId: string) => {
    try {
      switch (action) {
        case 'open':
          await openBrowser(browserId);
          addNotification({
            type: 'success',
            title: '浏览器启动成功',
            message: '浏览器已在后台运行'
          });
          break;
        case 'delete':
          await deleteBrowser(browserId);
          addNotification({
            type: 'success',
            title: '删除成功',
            message: '浏览器已从系统中移除'
          });
          break;
        case 'details':
          setSelectedBrowserForDetails(browserId);
          openModal('browserDetailsModal');
          break;
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  }, [openBrowser, deleteBrowser, openModal, addNotification]);

  const handleDownloadAction = useCallback(async (action: string, taskId: string) => {
    try {
      switch (action) {
        case 'retry':
          await retryDownload(taskId);
          addNotification({
            type: 'info',
            title: '重试下载',
            message: '正在重新开始下载任务'
          });
          break;
        case 'remove':
          await removeDownloadTask(taskId);
          break;
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  }, [retryDownload, removeDownloadTask, addNotification]);

  // 显示加载屏幕直到应用初始化完成
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在初始化应用...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Layout
        browsers={browsers}
        downloadTasks={downloadTasks}
        searchQuery={searchQuery}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={browserLoading}
        onSearchChange={handleSearchChange}
        onDownload={handleDownload}
        onRefresh={handleRefresh}
        onSettings={handleSettings}
        onBrowserAction={handleBrowserAction}
        onDownloadAction={handleDownloadAction}
      />
      
      {/* 模态框 */}
      <DownloadModal
        isOpen={downloadModalOpen}
        onClose={() => closeModal('downloadModal')}
      />
      
      <BrowserDetailsModal
        isOpen={browserDetailsModalOpen}
        onClose={() => {
          setSelectedBrowserForDetails(null);
          closeModal('browserDetailsModal');
        }}
        browserId={selectedBrowserForDetails || undefined}
      />
      
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => closeModal('settingsModal')}
      />

      {/* 通知系统 */}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
        position="top-center"
      />
    </div>
  );
}

export default App;
