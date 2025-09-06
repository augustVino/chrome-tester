import { useState, useEffect } from 'react';
import { 
  Folder, 
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
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [form, setForm] = useState<SettingsForm>({
    downloadPath: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  const config = useAppStore(state => state.config);
  const updateConfig = useAppStore(state => state.updateConfig);
  const addNotification = useUIStore(state => state.addNotification);
  const clearAllBrowsers = useBrowserStore(state => state.clearAllBrowsers);

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      setForm({
        downloadPath: config.downloadPath || ''
      });
    }
  }, [isOpen, config]);

  // 实时保存功能
  const saveConfig = async (newConfig: Partial<SettingsForm>) => {
    try {
      await updateConfig({
        downloadPath: newConfig.downloadPath ?? form.downloadPath
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: error instanceof Error ? error.message : '保存设置时发生错误'
      });
    }
  };

  // 更新表单并实时保存
  const updateFormField = async (field: keyof SettingsForm, value: any) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    await saveConfig({ [field]: value } as Partial<SettingsForm>);
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


  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="应用设置"
      className="max-w-2xl"
    >
      <div className="space-y-6 max-h-96 overflow-y-auto">

        {/* 下载设置 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">下载设置</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              下载目录
            </label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="选择下载目录..."
                value={form.downloadPath}
                onChange={(e) => updateFormField('downloadPath', e.target.value)}
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

        </div>

        {/* 数据管理 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">数据管理</h3>
          
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
      </div>
    </Modal>
  );
}