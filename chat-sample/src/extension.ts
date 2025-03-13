import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { registerChatLibChatParticipant } from './chatUtilsSample';
import { registerSimpleParticipant } from './simple';
import { registerToolUserChatParticipant } from './toolParticipant';
import { registerChatTools } from './tools';
import { ProjectManagerProvider } from './projectManager';
import { ProjectManagementTreeDataProvider } from './projectManagementTreeView';

export function activate(context: vscode.ExtensionContext) {
    registerSimpleParticipant(context);
    registerToolUserChatParticipant(context);
    registerChatLibChatParticipant(context);
    registerChatTools(context);

    // Register the project manager provider
    const projectManager = new ProjectManagerProvider(context);
    context.subscriptions.push(...projectManager.register());

    // Check if workspace is opened
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        // Try to open the current directory as a workspace
        const extensionPath = context.extensionPath;
        const parentDirectory = path.dirname(extensionPath);

        // Only attempt to open if it's not already open
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(parentDirectory), {
            forceNewWindow: false
        }).then(() => {
            vscode.window.showInformationMessage(`Opened workspace folder: ${parentDirectory}`);
        }, (error) => {
            console.error('Failed to open workspace folder:', error);
        });
    } else {
        // Register the tree view for project management
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const treeDataProvider = new ProjectManagementTreeDataProvider(workspaceRoot);

        // Create and register the TreeView with the proper view ID that matches the one in package.json
        const treeView = vscode.window.createTreeView('projectManagementView', {
            treeDataProvider,
            showCollapseAll: true  // Added for better UX
        });

        // Add refresh command for the tree view
        context.subscriptions.push(
            vscode.commands.registerCommand('projectManagementView.refresh', () => {
                treeDataProvider.refresh();
            })
        );

        context.subscriptions.push(treeView);

        // Create project_management folder if it doesn't exist
        const projectManagementPath = path.join(workspaceRoot, 'project_management');
        if (!fs.existsSync(projectManagementPath)) {
            try {
                fs.mkdirSync(projectManagementPath, { recursive: true });
                vscode.window.showInformationMessage('Created project_management folder for file management');
            } catch (error) {
                console.error('Failed to create project_management folder:', error);
            }
        }
    }
}

export function deactivate() { }