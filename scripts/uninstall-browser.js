#!/usr/bin/env node

import { Browser, BrowserPlatform, uninstall, getInstalledBrowsers } from '@puppeteer/browsers';
import os from 'os';
import path from 'path';

// 从命令行参数获取配置
const args = process.argv.slice(2);
const config = {};

// 解析命令行参数
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  config[key] = value;
}

// 必需参数验证
if (!config.browser || !config.version || !config.platform) {
  console.error('ERROR:Missing required parameters');
  console.error('Usage: node uninstall-browser.js --browser chrome --version 120.0.6099.109 --platform win64');
  process.exit(1);
}

// 浏览器类型映射
const browserMap = {
  'chrome': Browser.CHROME,
  'chromium': Browser.CHROMIUM,
  'firefox': Browser.FIREFOX,
  'chromedriver': Browser.CHROMEDRIVER
};

// 平台映射
const platformMap = {
  'win32': BrowserPlatform.WIN32,
  'win64': BrowserPlatform.WIN64,
  'mac': BrowserPlatform.MAC,
  'mac_arm': BrowserPlatform.MAC_ARM,
  'linux': BrowserPlatform.LINUX,
  'linux64': BrowserPlatform.LINUX
};

const browser = browserMap[config.browser.toLowerCase()];
const platform = platformMap[config.platform.toLowerCase()];

if (!browser) {
  console.error(`ERROR:Unsupported browser: ${config.browser}`);
  process.exit(1);
}

if (!platform) {
  console.error(`ERROR:Unsupported platform: ${config.platform}`);
  process.exit(1);
}

// 获取应用数据目录
function getAppDataDir() {
  const appName = 'chrome-tester';
  
  if (os.platform() === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', appName);
  } else if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  } else {
    return path.join(os.homedir(), '.local', 'share', appName);
  }
}

async function uninstallBrowser() {
  try {
    const appDataDir = getAppDataDir();
    const cacheDir = path.join(appDataDir, 'browsers');
    
    console.log(`INFO:Uninstalling ${config.browser} ${config.version} for ${config.platform}`);
    
    // 检查是否已安装
    const installed = getInstalledBrowsers(cacheDir);
    const isInstalled = installed.some(installedBrowser => 
      installedBrowser.browser === browser && 
      installedBrowser.buildId === config.version &&
      installedBrowser.platform === platform
    );
    
    if (!isInstalled) {
      console.error('ERROR:Browser not installed');
      process.exit(1);
    }
    
    // 执行卸载
    await uninstall({
      browser,
      buildId: config.version,
      platform,
      cacheDir
    });

    console.log(`SUCCESS:Browser uninstalled successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`ERROR:${error.message}`);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error(`ERROR:Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`ERROR:Unhandled rejection: ${reason}`);
  process.exit(1);
});

// 开始卸载
uninstallBrowser();