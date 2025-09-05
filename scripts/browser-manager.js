#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 获取命令行参数
const [,, command, ...args] = process.argv;

// 可用的命令映射
const commands = {
  'download': path.join(__dirname, 'download-browser.js'),
  'list': path.join(__dirname, 'list-versions.js'),
  'check': path.join(__dirname, 'check-installation.js'),
  'uninstall': path.join(__dirname, 'uninstall-browser.js'),
};

// 显示帮助信息
function showHelp() {
  console.log('Chrome Browser Manager - Puppeteer/Browsers API Wrapper');
  console.log('');
  console.log('Usage: node browser-manager.js <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  download   Download and install a browser version');
  console.log('  list       List available or installed browser versions');
  console.log('  check      Check if a browser version is installed');
  console.log('  uninstall  Uninstall a browser version');
  console.log('');
  console.log('Examples:');
  console.log('  # Download Chrome');
  console.log('  node browser-manager.js download --browser chrome --version 120.0.6099.109 --platform win64');
  console.log('');
  console.log('  # List available versions');
  console.log('  node browser-manager.js list');
  console.log('');
  console.log('  # List installed browsers');
  console.log('  node browser-manager.js list --action installed');
  console.log('');
  console.log('  # Check installation');
  console.log('  node browser-manager.js check --browser chrome --version 120.0.6099.109 --platform win64');
  console.log('');
  console.log('  # Uninstall browser');
  console.log('  node browser-manager.js uninstall --browser chrome --version 120.0.6099.109 --platform win64');
}

// 验证命令
if (!command || !commands[command]) {
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }
  
  console.error('ERROR:Invalid or missing command');
  console.error('Available commands:', Object.keys(commands).join(', '));
  console.error('Use "help" for more information');
  process.exit(1);
}

// 执行命令
function executeCommand(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      shell: false
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    // 处理信号传递
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });
}

// 运行选定的命令
async function run() {
  try {
    const scriptPath = commands[command];
    await executeCommand(scriptPath, args);
  } catch (error) {
    console.error('ERROR:Failed to execute command:', error.message);
    process.exit(1);
  }
}

run();