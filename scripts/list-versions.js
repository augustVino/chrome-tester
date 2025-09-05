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
          version: '121.0.6167.85',
          platform: 'win64',
          stable: true,
          release_date: '2024-01-23'
        },
        {
          version: '120.0.6099.109',
          platform: 'win64',
          stable: true,
          release_date: '2023-12-06'
        },
        {
          version: '119.0.6045.105',
          platform: 'win64',
          stable: true,
          release_date: '2023-10-31'
        },
        {
          version: '118.0.5993.70',
          platform: 'win64',
          stable: true,
          release_date: '2023-10-10'
        },
        {
          version: '117.0.5938.92',
          platform: 'win64',
          stable: true,
          release_date: '2023-09-12'
        },
        {
          version: '116.0.5845.96',
          platform: 'win64',
          stable: true,
          release_date: '2023-08-15'
        },
        {
          version: '115.0.5790.102',
          platform: 'win64',
          stable: true,
          release_date: '2023-07-18'
        },
        {
          version: '114.0.5735.90',
          platform: 'win64',
          stable: true,
          release_date: '2023-05-30'
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