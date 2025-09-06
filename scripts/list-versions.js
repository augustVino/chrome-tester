#!/usr/bin/env node

import { Browser, BrowserPlatform, getInstalledBrowsers } from '@puppeteer/browsers';
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

// 浏览器类型映射
const browserMap = {
  'chrome': Browser.CHROME,
  'chromium': Browser.CHROMIUM,
  'firefox': Browser.FIREFOX,
  'chromedriver': Browser.CHROMEDRIVER
};

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

async function listVersions() {
  try {
    if (config.action === 'installed') {
      // 列出已安装的浏览器
      const appDataDir = getAppDataDir();
      const cacheDir = path.join(appDataDir, 'browsers');
      
      const installed = getInstalledBrowsers(cacheDir);
      console.log(JSON.stringify(installed));
      
    } else {
      // 返回常用的Chrome版本列表（因为@puppeteer/browsers没有提供获取所有可用版本的API）
      const commonVersions = [
        {
          version: 'stable',
          platform: 'auto',
          stable: true,
          release_date: '2025-09-06'
        },
        {
          version: '131',
          platform: 'auto',
          stable: true,
          release_date: '2024-11-01'
        },
        {
          version: '130',
          platform: 'auto',
          stable: true,
          release_date: '2024-10-01'
        },
        {
          version: '129',
          platform: 'auto',
          stable: true,
          release_date: '2024-09-01'
        },
        {
          version: '128',
          platform: 'auto',
          stable: true,
          release_date: '2024-08-01'
        },
        {
          version: '127',
          platform: 'auto',
          stable: true,
          release_date: '2024-07-01'
        },
        {
          version: '126',
          platform: 'auto',
          stable: true,
          release_date: '2024-06-01'
        },
        {
          version: '125',
          platform: 'auto',
          stable: true,
          release_date: '2024-05-01'
        }
      ];
      
      console.log(JSON.stringify(commonVersions));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`ERROR:${error.message}`);
    process.exit(1);
  }
}

listVersions();