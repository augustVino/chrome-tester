import { useState, useEffect } from 'react';
import { Download, Chrome } from 'lucide-react';
import { Modal, Button, Input } from '../ui';
import { useDownloadStore, useUIStore } from '../../stores';
import { invoke } from '@tauri-apps/api/core';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const [customVersion, setCustomVersion] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState('');
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(true);
  
  const startDownload = useDownloadStore(state => state.startDownload);
  const addNotification = useUIStore(state => state.addNotification);
  const closeModal = useUIStore(state => state.closeModal);

  // 获取当前系统平台信息
  useEffect(() => {
    if (isOpen) {
      loadSystemInfo();
    }
  }, [isOpen]);

  const loadSystemInfo = async () => {
    setIsLoadingPlatform(true);
    try {
      const systemInfo = await invoke<{platform: string, arch: string}>('get_system_info');
      setCurrentPlatform(systemInfo.platform);
    } catch (error) {
      console.error('Failed to load system info:', error);
      addNotification({
        type: 'error',
        title: '获取系统信息失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoadingPlatform(false);
    }
  };

  const handleDownload = async () => {
    const version = customVersion.trim();
    
    if (!version || !currentPlatform) {
      addNotification({
        type: 'warning',
        title: '信息不完整',
        message: '请输入版本号'
      });
      return;
    }

    try {
      await startDownload('Chrome', version, currentPlatform);
      
      addNotification({
        type: 'success',
        title: '下载开始',
        message: `正在下载 Google Chrome ${version}`
      });

      // 关闭模态框
      handleClose();
      
    } catch (error) {
      addNotification({
        type: 'error',
        title: '下载失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  const handleClose = () => {
    // 重置状态
    setCustomVersion('');
    closeModal('downloadModal');
    onClose();
  };

  const getPlatformLabel = (platform: string) => {
    const platformLabels: Record<string, string> = {
      'win64': 'Windows 64位',
      'win32': 'Windows 32位',
      'mac_x64': 'macOS Intel',
      'mac_arm': 'macOS Apple Silicon',
      'linux64': 'Linux 64位',
    };
    return platformLabels[platform] || platform;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="下载 Google Chrome"
      className="max-w-lg"
    >
      <div className="space-y-6">
        {/* 浏览器信息展示 */}
        <div className="bg-primary-50 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Chrome className="h-8 w-8 text-primary-600" />
            <div>
              <div className="font-medium text-primary-900">Google Chrome</div>
              <div className="text-sm text-primary-700">
                {isLoadingPlatform ? '检测系统平台中...' : `目标平台: ${getPlatformLabel(currentPlatform)}`}
              </div>
            </div>
          </div>
        </div>

        {/* 版本输入 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            版本号
          </label>
          <Input
            type="text"
            placeholder="例如: 120.0.6099.109"
            value={customVersion}
            onChange={(e) => setCustomVersion(e.target.value)}
            className="text-sm"
            disabled={isLoadingPlatform}
          />
          <p className="mt-2 text-xs text-gray-500">
            请输入版本号，例如：stable、120、119。也可输入具体版本如：140.0.7339.80
          </p>
        </div>

        {/* 下载信息预览 */}
        {customVersion.trim() && currentPlatform && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">下载信息预览</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">浏览器:</span>
                <span className="text-gray-900">Google Chrome</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">版本:</span>
                <span className="text-gray-900">{customVersion.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">平台:</span>
                <span className="text-gray-900">{getPlatformLabel(currentPlatform)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleClose}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={
              !customVersion.trim() || 
              !currentPlatform ||
              isLoadingPlatform
            }
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>开始下载</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}