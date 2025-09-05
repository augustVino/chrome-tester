#!/usr/bin/env node

import { Browser, BrowserPlatform, getInstalledBrowsers, computeExecutablePath } from '@puppeteer/browsers';
import { promises as fs } from 'fs';
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
  console.error('Usage: node check-installation.js --browser chrome --version 120.0.6099.109 --platform win64');
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

async function checkInstallation() {
  try {
    const appDataDir = getAppDataDir();
    const cacheDir = path.join(appDataDir, 'browsers');
    
    // 获取已安装的浏览器列表
    const installed = getInstalledBrowsers(cacheDir);
    
    // 检查指定的浏览器版本是否已安装
    const isInstalled = installed.some(installedBrowser => 
      installedBrowser.browser === browser && 
      installedBrowser.buildId === config.version &&
      installedBrowser.platform === platform
    );
    
    if (isInstalled) {
      // 获取执行文件路径
      const executablePath = computeExecutablePath({
        browser,
        buildId: config.version,
        platform,
        cacheDir
      });
      
      // 检查文件是否确实存在
      try {
        await fs.access(executablePath);
        
        const result = {
          installed: true,
          executablePath,
          installPath: path.dirname(executablePath),
          version: config.version,
          platform: config.platform,
          browser: config.browser
        };
        
        console.log(JSON.stringify(result));
      } catch {
        // 文件不存在，可能安装损坏
        console.log(JSON.stringify({
          installed: false,
          error: 'Executable not found'
        }));
      }
    } else {
      console.log(JSON.stringify({
        installed: false
      }));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`ERROR:${error.message}`);
    process.exit(1);
  }
}

checkInstallation();