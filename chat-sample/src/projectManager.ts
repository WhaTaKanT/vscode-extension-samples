import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * ProjectManagerProvider class
 * Handles project management functionality and chat interface
 */
export class ProjectManagerProvider {
    /**
     * Creates a new instance of the ProjectManagerProvider
     * @param context The extension context
     */
    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Registers the project manager commands and views
     */
    register(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // Register the command to open the project manager overview
        disposables.push(
            vscode.commands.registerCommand('project-manager.openProjectManager', () => {
                this.openProjectManagerOverview();
            })
        );

        // Register the command to get file content from X:/CombinedOutput.txt and copy to clipboard
        disposables.push(
            vscode.commands.registerCommand('project-manager.getFileContent', () => {
                this.getFileContent();
            })
        );

        return disposables;
    }

    /**
     * Gets the content of the CombinedOutput.txt file and copies it to the clipboard
     */
    private async getFileContent() {
        const filePath = 'X:/CombinedOutput.txt';

        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`File does not exist: ${filePath}`);
                return;
            }

            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Copy to clipboard
            await vscode.env.clipboard.writeText(fileContent);

            vscode.window.showInformationMessage(`Content from ${filePath} has been copied to clipboard`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Opens the project manager overview as a webview panel
     */
    private async openProjectManagerOverview() {
        // Create a webview panel for project management
        const panel = vscode.window.createWebviewPanel(
            'projectManagementOverview',
            'Project Management Overview',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set the HTML content for the webview
        panel.webview.html = await this.getProjectOverviewHtml();

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openFile':
                        if (message.path) {
                            this.openFile(message.path);
                        }
                        return;
                    case 'getFileContent':
                        this.getFileContent();
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Opens a file in the editor
     * @param path The file path to open
     */
    private async openFile(path: string) {
        try {
            const document = await vscode.workspace.openTextDocument(path);
            await vscode.window.showTextDocument(document);
        } catch {
            vscode.window.showErrorMessage(`Failed to open file: ${path}`);
        }
    }

    /**
     * Generates the HTML content for the project overview
     * @returns HTML content as a string
     */
    private async getProjectOverviewHtml(): Promise<string> {
        let html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Project Management Overview</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    h1, h2, h3 {
                        color: var(--vscode-titleBar-activeForeground);
                    }
                    .file-link {
                        color: var(--vscode-textLink-foreground);
                        cursor: pointer;
                        text-decoration: underline;
                    }
                    .section {
                        margin-bottom: 20px;
                        padding: 15px;
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 5px;
                    }
                    .button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        cursor: pointer;
                        border-radius: 3px;
                        margin-top: 10px;
                    }
                    .button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <h1>Project Management Overview</h1>

                <div class="section">
                    <h2>Project Tools</h2>
                    <button class="button" onclick="getFileContent()">Get File Content from X:/CombinedOutput.txt</button>
                </div>

                <div class="chat-container">`;

        // Add workspace folders information
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            html += `
                <div class="section">
                    <h2>Workspace Folders</h2>
                    <ul>`;

            for (const folder of workspaceFolders) {
                html += `<li><strong>${folder.name}</strong>: ${folder.uri.fsPath}</li>`;
            }

            html += `
                    </ul>
                </div>`;
        }

        // Try to get Git information if available
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            if (gitExtension) {
                const api = gitExtension.getAPI(1);
                if (api && api.repositories.length > 0) {
                    html += `
                        <div class="section">
                            <h2>Git Repositories</h2>
                            <ul>`;

                    for (const repo of api.repositories) {
                        html += `
                            <li>
                                <strong>Repository</strong>: ${repo.rootUri.fsPath}
                                <br>Current Branch: ${repo.state.HEAD?.name || 'Unknown'}
                            </li>`;
                    }

                    html += `
                            </ul>
                        </div>`;
                }
            }
        } catch (error) {
            console.log('Git information not available:', error);
        }

        // List project files
        try {
            if (workspaceFolders && workspaceFolders.length > 0) {
                const files = await vscode.workspace.findFiles('**/*.{json,ts,js,md}', '**/node_modules/**', 100);

                html += `
                    <div class="section">
                        <h2>Project Files</h2>
                        <p>Here are some important files in your project:</p>`;

                // Look for package.json files
                const packageJsonFiles = files.filter(file => file.path.endsWith('package.json'));
                if (packageJsonFiles.length > 0) {
                    html += `
                        <h3>Package Files</h3>
                        <ul>`;

                    for (const file of packageJsonFiles) {
                        const fileName = file.fsPath.split(/[\\/]/).pop();
                        html += `<li><span class="file-link" onclick="openFile('${file.fsPath.replace(/\\/g, '\\\\')}')">${fileName}</span></li>`;
                    }

                    html += `</ul>`;
                }

                // Look for TypeScript files
                const tsFiles = files.filter(file => file.path.endsWith('.ts') && !file.path.includes('node_modules'));
                if (tsFiles.length > 0) {
                    html += `
                        <h3>TypeScript Files</h3>
                        <ul>`;

                    const mainFiles = tsFiles.filter(f => f.fsPath.includes('main') || f.fsPath.includes('extension') || f.fsPath.includes('index'));
                    for (const file of mainFiles.slice(0, 5)) {
                        const fileName = file.fsPath.split(/[\\/]/).pop();
                        html += `<li><span class="file-link" onclick="openFile('${file.fsPath.replace(/\\/g, '\\\\')}')">${fileName}</span></li>`;
                    }

                    if (tsFiles.length > 5) {
                        html += `<li>... and ${tsFiles.length - 5} more TypeScript files</li>`;
                    }

                    html += `</ul>`;
                }

                // Look for README files
                const readmeFiles = files.filter(file => file.path.toLowerCase().includes('readme.md'));
                if (readmeFiles.length > 0) {
                    html += `
                        <h3>Documentation</h3>
                        <ul>`;

                    for (const file of readmeFiles) {
                        const fileName = file.fsPath.split(/[\\/]/).pop();
                        html += `<li><span class="file-link" onclick="openFile('${file.fsPath.replace(/\\/g, '\\\\')}')">${fileName}</span></li>`;
                    }

                    html += `</ul>`;
                }

                html += `</div>`;
            }
        } catch (error) {
            console.error('Error getting project files:', error);
        }

        // Next steps section
        html += `
            <div class="section">
                <h2>Next Steps</h2>
                <p>Here are some suggestions for managing your project:</p>
                <ol>
                    <li><strong>Review the codebase</strong> - Look through the main files to understand the project structure</li>
                    <li><strong>Check dependencies</strong> - Review the package.json file for dependencies and scripts</li>
                    <li><strong>Run tests</strong> - If the project has tests, run them to ensure everything works</li>
                    <li><strong>Update documentation</strong> - Ensure the README and other documentation is up to date</li>
                </ol>
            </div>`;

        // Close the HTML
        html += `
                </div>
                <script>
                    const vscode = acquireVsCodeApi();

                    function openFile(path) {
                        vscode.postMessage({
                            command: 'openFile',
                            path: path
                        });
                    }

                    function getFileContent() {
                        vscode.postMessage({
                            command: 'getFileContent'
                        });
                    }
                </script>
            </body>
            </html>`;

        return html;
    }
}