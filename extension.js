const vscode = require('vscode');
const os = require('os');
const path = require('path');
const fs = require('fs');

function getStoragePath() {
    // 首先检查用户是否在设置中指定了路径
    const config = vscode.workspace.getConfiguration('cursorFakeMachine');
    const customPath = config.get('storagePath');

    if (customPath && fs.existsSync(customPath)) {
        return customPath;
    }

    // 如果没有指定或路径无效，使用默认路径
    const platform = os.platform();
    let basePath;

    switch (platform) {
        case 'win32':
            basePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage');
            break;
        case 'darwin':
            basePath = path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage');
            break;
        case 'linux':
            basePath = path.join(os.homedir(), '.config', 'Cursor', 'User', 'globalStorage');
            break;
        default:
            throw new Error('不支持的操作系统');
    }

    return path.join(basePath, 'storage.json');
}

function modifyTelemetryIds() {
    try {
        const storagePath = getStoragePath();

        // 检查文件是否存在
        if (!fs.existsSync(storagePath)) {
            throw new Error(`文件不存在: ${storagePath}`);
        }

        // 读取文件
        let data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));

        // 获取用户配置
        const config = vscode.workspace.getConfiguration('cursorFakeMachine');
        const customMachineId = config.get('customMachineId');
        
        // 生成新的 ID
        const newMacMachineId = customMachineId || generateRandomMachineId();
        const newMachineId = generateHexString(64);  // 生成64位的十六进制字符串
        const newDeviceId = generateRandomMachineId();  // UUID 格式

        // 更新所有遥测 ID
        data['telemetry.macMachineId'] = newMacMachineId;
        data['telemetry.machineId'] = newMachineId;
        data['telemetry.devDeviceId'] = newDeviceId;

        // 写回文件
        fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf8');

        return {
            success: true,
            message: '已成功修改所有遥测 ID',
            macMachineId: newMacMachineId,
            machineId: newMachineId,
            devDeviceId: newDeviceId,
            path: storagePath,
        };
    } catch (error) {
        throw new Error(`修改失败: ${error.message}`);
    }
}

// 新增：生成指定长度的十六进制字符串
function generateHexString(length) {
    const hex = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += hex[Math.floor(Math.random() * 16)];
    }
    return result;
}

function generateRandomMachineId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 添加新的清理备份文件函数
function cleanupBackupFiles(storagePath) {
    try {
        const dirPath = path.dirname(storagePath);
        const files = fs.readdirSync(dirPath);
        
        // 查找并删除所有 backup_ 开头的文件
        const backupFiles = files.filter(file => file.includes('storage.backup'));
        for (const file of backupFiles) {
            fs.unlinkSync(path.join(dirPath, file));
        }
        
        return {
            success: true,
            message: `已清理 ${backupFiles.length} 个备份文件`,
            cleanedFiles: backupFiles
        };
    } catch (error) {
        throw new Error(`清理备份文件失败: ${error.message}`);
    }
}

function activate(context) {
    let disposable = vscode.commands.registerCommand('cursor-fake-machine.cursor-fake-machine', async function () {
        try {
            // 首先清理备份文件
            const storagePath = getStoragePath();
            const cleanupResult = cleanupBackupFiles(storagePath);
            
            // 然后修改遥测 ID
            const result = modifyTelemetryIds();
            
            vscode.window.showInformationMessage(
                `操作成功完成！\n` +
                `${cleanupResult.message}\n` +
                `已更新遥测 ID:\n` +
                `路径: ${result.path}\n` +
                `新的 macMachineId: ${result.macMachineId}\n` +
                `新的 machineId: ${result.machineId}\n` +
                `新的 devDeviceId: ${result.devDeviceId}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);

            if (error.message.includes('不存在')) {
                const answer = await vscode.window.showQuestionMessage(
                    '是否要打开设置页面指定 storage.json 的路径？',
                    '是',
                    '否'
                );
                if (answer === '是') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'cursorFakeMachine.storagePath');
                }
            }
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
