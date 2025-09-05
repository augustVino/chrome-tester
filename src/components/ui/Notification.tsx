import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import type { Notification as NotificationType } from '../../types';

interface NotificationProps {
  notification: NotificationType;
  onRemove: (id: string) => void;
}

export function NotificationItem({ notification, onRemove }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 入场动画
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(notification.id);
    }, 300);
  };

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getColorClasses = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-white border border-green-200';
      case 'error':
        return 'bg-white border border-red-200';
      case 'warning':
        return 'bg-white border border-yellow-200';
      case 'info':
        return 'bg-white border border-blue-200';
      default:
        return 'bg-white border border-gray-200';
    }
  };

  return (
    <div
      className={clsx(
        'transform transition-all duration-300 ease-in-out',
        isVisible && !isLeaving ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
        'max-w-md mx-auto rounded-lg shadow-lg pointer-events-auto',
        getColorClasses()
      )}
    >
      <div className="px-4 py-3">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {notification.title}
            </p>
            
            {notification.message && (
              <p className="mt-1 text-sm text-gray-600 truncate">
                {notification.message}
              </p>
            )}
          </div>
          
          <div className="ml-3 flex-shrink-0 flex">
            <button
              className="rounded-full inline-flex text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 transition-colors focus:outline-none"
              onClick={handleRemove}
            >
              <span className="sr-only">关闭</span>
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        {notification.action && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={notification.action.callback}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              {notification.action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: NotificationType[];
  onRemove: (id: string) => void;
  position?: 'top-center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
}

export function NotificationContainer({ 
  notifications, 
  onRemove, 
  position = 'top-center',
  maxNotifications = 5 
}: NotificationContainerProps) {
  const visibleNotifications = notifications.slice(0, maxNotifications);
  
  const getPositionClasses = () => {
    switch (position) {
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 left-1/2 transform -translate-x-1/2';
    }
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={clsx(
      'fixed z-50 flex flex-col space-y-2 pointer-events-none',
      getPositionClasses()
    )}>
      {visibleNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// 简化的Toast组件（可以直接调用显示通知）
interface ToastOptions {
  type: NotificationType['type'];
  title: string;
  message?: string;
  duration?: number;
  action?: NotificationType['action'];
}

export function createToast(
  options: ToastOptions, 
  addNotification: (notification: Omit<NotificationType, 'id'>) => string
): string {
  return addNotification({
    type: options.type,
    title: options.title,
    message: options.message,
    duration: options.duration ?? 5000, // 默认5秒
    action: options.action,
  });
}

// 预定义的通知类型
export const toast = {
  success: (title: string, message?: string, duration?: number) => ({
    type: 'success' as const,
    title,
    message,
    duration: duration ?? 4000,
  }),
  
  error: (title: string, message?: string, duration?: number) => ({
    type: 'error' as const,
    title,
    message,
    duration: duration ?? 6000, // 错误通知显示更久
  }),
  
  warning: (title: string, message?: string, duration?: number) => ({
    type: 'warning' as const,
    title,
    message,
    duration: duration ?? 5000,
  }),
  
  info: (title: string, message?: string, duration?: number) => ({
    type: 'info' as const,
    title,
    message,
    duration: duration ?? 4000,
  }),
};