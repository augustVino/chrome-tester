import { useState, useEffect } from 'react';
import { 
  Settings, 
  Folder, 
  Globe, 
  Palette, 
  Download,
  Save,
  RotateCcw,
  Monitor,
  Sun,
  Moon,
  Database,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Modal, Button, Input } from '../ui';
import { useAppStore, useUIStore, useBrowserStore } from '../../stores';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsForm {
  // 下载设置
  downloadPath: string;
  maxConcurrentDownloads: number;
  autoCleanup: boolean;
  
  // 界面设置
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  
  // 代理设置
  proxyEnabled: boolean;
  proxyHost: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPassword: string;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [form, setForm] = useState<SettingsForm>({
    downloadPath: '',
    maxConcurrentDownloads: 3,
    autoCleanup: true,
    theme: 'light',
    notifications: true,
    proxyEnabled: false,
    proxyHost: '',
    proxyPort: 8080,
    proxyUsername: '',
    proxyPassword: ''
  });
  
  const [activeTab, setActiveTab] = useState<'general' | 'download' | 'proxy' | 'appearance' | 'data'>('general');
  const [isLoading, setIsLoading] = useState(false);
  
  const config = useAppStore(state => state.config);
  const updateConfig = useAppStore(state => state.updateConfig);
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);
  const addNotification = useUIStore(state => state.addNotification);
  const clearAllBrowsers = useBrowserStore(state => state.clearAllBrowsers);

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      setForm({
        downloadPath: config.downloadPath || '',
        maxConcurrentDownloads: config.maxConcurrentDownloads || 3,
        autoCleanup: config.autoCleanup ?? true,
        theme: theme,
        notifications: config.notifications ?? true,
        proxyEnabled: config.proxySettings?.enabled ?? false,
        proxyHost: config.proxySettings?.host || '',
        proxyPort: config.proxySettings?.port || 8080,
        proxyUsername: config.proxySettings?.username || '',
        proxyPassword: config.proxySettings?.password || ''
      });
    }
  }, [isOpen, config, theme]);

  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      // 更新主题
      if (form.theme !== theme) {
        setTheme(form.theme);
      }

      // 更新应用配置
      await updateConfig({
        downloadPath: form.downloadPath,
        maxConcurrentDownloads: form.maxConcurrentDownloads,
        autoCleanup: form.autoCleanup,
        notifications: form.notifications,
        proxySettings: {
          enabled: form.proxyEnabled,
          host: form.proxyHost,
          port: form.proxyPort,
          username: form.proxyUsername,
          password: form.proxyPassword
        }
      });

      addNotification({
        type: 'success',
        title: '设置已保存',
        message: '所有设置已成功保存'
      });

      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: error instanceof Error ? error.message : '保存设置时发生错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    // 重置为默认值
    setForm({
      downloadPath: '',
      maxConcurrentDownloads: 3,
      autoCleanup: true,
      theme: 'light',
      notifications: true,
      proxyEnabled: false,
      proxyHost: '',
      proxyPort: 8080,
      proxyUsername: '',
      proxyPassword: ''
    });

    addNotification({
      type: 'info',
      title: '设置已重置',
      message: '所有设置已恢复为默认值'
    });
  };

  const selectDownloadPath = () => {
    // TODO: 实现文件夹选择器
    addNotification({
      type: 'info',
      title: '功能开发中',
      message: '文件夹选择器功能即将推出'
    });
  };

  const handleClearAllBrowsers = async () => {
    console.log('清除数据按钮被点击');
    
    try {
      // 使用 Tauri 官方的 confirm 对话框
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await confirm(
        '此操作将删除所有已下载的浏览器版本及其文件，该操作不可撤销。',
        { title: '确认清除数据', kind: 'warning' }
      );
      
      if (!confirmed) {
        console.log('用户取消了清除操作');
        return;
      }
      
      console.log('用户确认清除操作');
      setIsLoading(true);
      
      try {
        console.log('开始清除所有浏览器数据');
        await clearAllBrowsers();
        console.log('清除操作成功完成');
        addNotification({
          type: 'success',
          title: '清除成功',
          message: '所有浏览器数据已被清除，现在可以重新下载浏览器版本'
        });
      } catch (error) {
        console.error('清除操作失败:', error);
        addNotification({
          type: 'error',
          title: '清除失败',
          message: error instanceof Error ? error.message : '清除数据时发生错误'
        });
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('无法显示确认对话框:', error);
      addNotification({
        type: 'error',
        title: '错误',
        message: '无法显示确认对话框，请重试'
      });
    }
  };

  const tabs = [
    { key: 'general', label: '常规设置', icon: Settings },
    { key: 'download', label: '下载设置', icon: Download },
    { key: 'appearance', label: '外观设置', icon: Palette },
    { key: 'data', label: '数据管理', icon: Database },
    { key: 'proxy', label: '代理设置', icon: Globe }
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="应用设置"
      className="max-w-4xl"
    >
      <div className="flex h-96">
        {/* 左侧标签页 */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-700 pr-4">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 右侧设置内容 */}
        <div className="flex-1 pl-6">
          <div className="h-full overflow-y-auto space-y-6">
            
            {/* 常规设置 */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">常规设置</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        桌面通知
                      </label>
                      <p className="text-xs text-gray-500">
                        启用操作完成后的桌面通知
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        form.notifications ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                      onClick={() => setForm(prev => ({ ...prev, notifications: !prev.notifications }))}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          form.notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        自动清理
                      </label>
                      <p className="text-xs text-gray-500">
                        自动清理已完成的下载任务
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        form.autoCleanup ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                      onClick={() => setForm(prev => ({ ...prev, autoCleanup: !prev.autoCleanup }))}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          form.autoCleanup ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 下载设置 */}
            {activeTab === 'download' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">下载设置</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      下载目录
                    </label>
                    <div className="flex space-x-2">
                      <Input
                        type="text"
                        placeholder="选择下载目录..."
                        value={form.downloadPath}
                        onChange={(e) => setForm(prev => ({ ...prev, downloadPath: e.target.value }))}
                        className="flex-1"
                        readOnly
                      />
                      <Button
                        variant="outline"
                        onClick={selectDownloadPath}
                        className="flex items-center space-x-2"
                      >
                        <Folder className="h-4 w-4" />
                        <span>选择</span>
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      最大并发下载数
                    </label>
                    <select
                      value={form.maxConcurrentDownloads}
                      onChange={(e) => setForm(prev => ({ ...prev, maxConcurrentDownloads: parseInt(e.target.value) }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      同时进行的下载任务数量
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 外观设置 */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">外观设置</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    主题模式
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'light', label: '浅色模式', icon: Sun },
                      { value: 'dark', label: '深色模式', icon: Moon },
                      { value: 'system', label: '跟随系统', icon: Monitor }
                    ].map((option) => {
                      const Icon = option.icon;
                      return (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="radio"
                            name="theme"
                            value={option.value}
                            checked={form.theme === option.value}
                            onChange={(e) => setForm(prev => ({ ...prev, theme: e.target.value as any }))}
                            className="mr-3 text-primary-600"
                          />
                          <Icon className="mr-2 h-4 w-4" />
                          <span className="text-sm text-gray-700">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 数据管理 */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">数据管理</h3>
                
                <div className="space-y-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-yellow-800">数据清理工具</h4>
                        <p className="mt-1 text-sm text-yellow-700">
                          如果遇到浏览器路径显示问题或启动失败，可以尝试清除所有数据后重新下载。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">清除所有浏览器数据</h4>
                        <p className="mt-1 text-sm text-gray-500">
                          删除所有已下载的浏览器版本及其相关文件。此操作不可撤销。
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                          • 将删除所有浏览器安装文件<br/>
                          • 将清空数据库中的浏览器记录<br/>
                          • 需要重新下载浏览器版本
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={handleClearAllBrowsers}
                        isLoading={isLoading}
                        className="flex items-center space-x-2 ml-4"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>清除所有数据</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 代理设置 */}
            {activeTab === 'proxy' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">代理设置</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        启用代理
                      </label>
                      <p className="text-xs text-gray-500">
                        通过代理服务器下载浏览器
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        form.proxyEnabled ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                      onClick={() => setForm(prev => ({ ...prev, proxyEnabled: !prev.proxyEnabled }))}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          form.proxyEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {form.proxyEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-gray-100">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3">
                          <Input
                            type="text"
                            label="代理主机"
                            placeholder="proxy.example.com"
                            value={form.proxyHost}
                            onChange={(e) => setForm(prev => ({ ...prev, proxyHost: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            label="端口"
                            placeholder="8080"
                            value={form.proxyPort.toString()}
                            onChange={(e) => setForm(prev => ({ ...prev, proxyPort: parseInt(e.target.value) || 8080 }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          type="text"
                          label="用户名（可选）"
                          placeholder="用户名"
                          value={form.proxyUsername}
                          onChange={(e) => setForm(prev => ({ ...prev, proxyUsername: e.target.value }))}
                        />
                        <Input
                          type="password"
                          label="密码（可选）"
                          placeholder="密码"
                          value={form.proxyPassword}
                          onChange={(e) => setForm(prev => ({ ...prev, proxyPassword: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <Button
          variant="ghost"
          onClick={handleReset}
          className="flex items-center space-x-2 text-gray-600"
        >
          <RotateCcw className="h-4 w-4" />
          <span>重置为默认</span>
        </Button>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isLoading}
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>保存设置</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}