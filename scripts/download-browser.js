#!/usr/bin/env node

import { install, Browser, BrowserPlatform } from '@puppeteer/browsers';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

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
  console.error('Usage: node download-browser.js --browser chrome --version 120.0.6099.109 --platform win64');
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
  'mac_x64': BrowserPlatform.MAC,
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

// 确保目录存在
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function downloadBrowser() {
  try {
    const appDataDir = getAppDataDir();
    const cacheDir = path.join(appDataDir, 'browsers');
    
    // 确保目录存在
    await ensureDir(cacheDir);
    
    console.log(`INFO:Starting download - ${config.browser} ${config.version} for ${config.platform}`);
    console.log(`INFO:Cache directory: ${cacheDir}`);

    // 先解析版本号为具体的build ID
    let buildId;
    try {
      const { resolveBuildId } = await import('@puppeteer/browsers');
      buildId = await resolveBuildId(browser, platform, config.version);
      console.log(`INFO:Resolved version ${config.version} to build ID: ${buildId}`);
    } catch (resolveError) {
      console.log(`INFO:Could not resolve version ${config.version}, using as build ID directly`);
      buildId = config.version;
    }

    const installPath = await install({
      browser,
      buildId,
      platform,
      cacheDir,
      downloadProgressCallback: (downloadedBytes, totalBytes) => {
        const progress = downloadedBytes / totalBytes;
        const progressData = {
          progress,
          downloaded_bytes: downloadedBytes,
          total_bytes: totalBytes,
          estimated_time_remaining: null
        };
        
        // 输出进度信息
        console.log(`PROGRESS:${JSON.stringify(progressData)}`);
      }
    });

    // 从installPath对象获取正确的路径信息
    let installDir = '';
    let executablePath = '';
    
    if (typeof installPath === 'object' && installPath !== null) {
        executablePath = installPath.executablePath || '';
        
        // 从可执行文件路径推导安装目录
        // 例: /path/to/browsers/chrome/mac_arm-120.0.6099.109/chrome-mac-arm64/Google Chrome.app/Contents/MacOS/Google Chrome
        // 安装目录应该是: /path/to/browsers/chrome/mac_arm-120.0.6099.109
        if (executablePath) {
            const parts = executablePath.split('/');
            // 找到包含版本号的目录层级
            const versionDirIndex = parts.findIndex(part => part.includes(buildId));
            if (versionDirIndex !== -1) {
                installDir = parts.slice(0, versionDirIndex + 1).join('/');
            } else {
                // 备用方案：使用chrome-mac-arm64的父目录
                const chromeDirIndex = parts.findIndex(part => part.startsWith('chrome-mac'));
                if (chromeDirIndex !== -1) {
                    installDir = parts.slice(0, chromeDirIndex).join('/');
                }
            }
        }
    }
    
    // 如果没有找到合适的安装目录，使用executablePath
    const finalInstallPath = installDir || executablePath || String(installPath);
    
    console.log(`COMPLETED:${finalInstallPath}`);
    console.log(`EXECUTABLE:${executablePath}`);
    console.log(`VERSION:${buildId}`);
    console.log(`INFO:Browser installed successfully at: ${finalInstallPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`ERROR:${error.message}`);
    console.error(`DEBUG:${error.stack}`);
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

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('INFO:Download interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('INFO:Download terminated');
  process.exit(1);
});

// 开始下载
downloadBrowser();