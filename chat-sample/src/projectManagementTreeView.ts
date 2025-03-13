import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ProjectManagementTreeDataProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | void> = new vscode.EventEmitter<FileItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        // If no workspace is open, return empty
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No workspace folder is open');
            return Promise.resolve([]);
        }

        // Define the directory to read
        const directoryToRead = element ?
            element.fullPath :
            path.join(this.workspaceRoot, 'project_management');

        // Check if directory exists, create if it doesn't
        if (!fs.existsSync(directoryToRead)) {
            if (directoryToRead === path.join(this.workspaceRoot, 'project_management')) {
                try {
                    fs.mkdirSync(directoryToRead, { recursive: true });
                    vscode.window.showInformationMessage('Created project_management folder for file management');
                } catch (error) {
                    console.error('Failed to create project_management folder:', error);
                    return Promise.resolve([]);
                }
            } else {
                return Promise.resolve([]);
            }
        }

        return Promise.resolve(this.readDirectory(directoryToRead));
    }

    private readDirectory(dir: string): FileItem[] {
        if (!fs.existsSync(dir)) {
            return [];
        }

        try {
            const items = fs.readdirSync(dir);
            return items.map(item => {
                const fullPath = path.join(dir, item);
                const stats = fs.statSync(fullPath);
                const isDirectory = stats.isDirectory();

                const treeItem = new FileItem(
                    item,
                    fullPath,
                    isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
                );

                // Add file size info for files
                if (!isDirectory) {
                    treeItem.description = `${(stats.size / 1024).toFixed(2)} KB`;
                    treeItem.tooltip = `${item} - ${(stats.size / 1024).toFixed(2)} KB`;
                }

                return treeItem;
            });
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
            return [];
        }
    }
}

export class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly fullPath: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);

        // Set the icon for the item based on whether it's a file or folder
        this.iconPath = collapsibleState === vscode.TreeItemCollapsibleState.None ?
            new vscode.ThemeIcon('file') :
            new vscode.ThemeIcon('folder');

        this.resourceUri = vscode.Uri.file(fullPath);

        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(fullPath)]
            };
        }
    }

    contextValue = 'fileItem';
}