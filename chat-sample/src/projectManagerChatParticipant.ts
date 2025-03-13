import * as vscode from 'vscode';
import { ProjectManagementTreeDataProvider } from './projectManagementTreeView';

/**
 * Registers a chat participant specifically for project management
 * @param context The extension context
 */
export function registerProjectManagerChatParticipant(context: vscode.ExtensionContext) {
    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        // Project management specific commands could be added here
        if (request.command === 'overview') {
            stream.markdown('# Project Management Overview\n\n');

            // Get workspace folders information
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                stream.markdown('## Workspace Folders\n\n');
                for (const folder of workspaceFolders) {
                    stream.markdown(`- **${folder.name}**: ${folder.uri.fsPath}\n`);
                }
            }

            // Get git information if available
            try {
                const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
                if (gitExtension) {
                    const api = gitExtension.getAPI(1);
                    if (api && api.repositories.length > 0) {
                        stream.markdown('\n## Git Repositories\n\n');
                        for (const repo of api.repositories) {
                            stream.markdown(`- **Repository**: ${repo.rootUri.fsPath}`);
                            stream.markdown(`  - Current Branch: ${repo.state.HEAD?.name || 'Unknown'}`);
                        }
                    }
                }
            } catch (error) {
                console.log('Git information not available:', error);
            }

            // List project files
            try {
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const files = await vscode.workspace.findFiles('**/*.{json,ts,js,md}', '**/node_modules/**', 100);

                    stream.markdown('\n## Project Files\n\n');
                    stream.markdown('Here are some important files in your project:\n\n');

                    // Look for package.json files
                    const packageJsonFiles = files.filter(file => file.path.endsWith('package.json'));
                    if (packageJsonFiles.length > 0) {
                        stream.markdown('### Package Files\n\n');
                        for (const file of packageJsonFiles) {
                            stream.markdown(`- [${file.fsPath.split('/').pop()}](${file.fsPath})\n`);
                            stream.reference(file);
                        }
                    }

                    // Look for TypeScript files
                    const tsFiles = files.filter(file => file.path.endsWith('.ts') && !file.path.includes('node_modules'));
                    if (tsFiles.length > 0) {
                        stream.markdown('\n### TypeScript Files\n\n');
                        const mainFiles = tsFiles.filter(f => f.fsPath.includes('main') || f.fsPath.includes('extension') || f.fsPath.includes('index'));
                        for (const file of mainFiles.slice(0, 5)) {
                            stream.markdown(`- [${file.fsPath.split('/').pop()}](${file.fsPath})\n`);
                            stream.reference(file);
                        }
                        if (tsFiles.length > 5) {
                            stream.markdown(`- ... and ${tsFiles.length - 5} more TypeScript files\n`);
                        }
                    }

                    // Look for README files
                    const readmeFiles = files.filter(file => file.path.toLowerCase().includes('readme.md'));
                    if (readmeFiles.length > 0) {
                        stream.markdown('\n### Documentation\n\n');
                        for (const file of readmeFiles) {
                            stream.markdown(`- [${file.fsPath.split('/').pop()}](${file.fsPath})\n`);
                            stream.reference(file);
                        }
                    }
                }
            } catch (error) {
                console.error('Error getting project files:', error);
            }

            stream.markdown('\n## Next Steps\n\n');
            stream.markdown('Here are some suggestions for managing your project:\n\n');
            stream.markdown('1. **Review the codebase** - Look through the main files to understand the project structure\n');
            stream.markdown('2. **Check dependencies** - Review the package.json file for dependencies and scripts\n');
            stream.markdown('3. **Run tests** - If the project has tests, run them to ensure everything works\n');
            stream.markdown('4. **Update documentation** - Ensure the README and other documentation is up to date\n');
        } else {
            try {
                const messages = [
                    vscode.LanguageModelChatMessage.User(`You are a project management assistant. Your role is to help the user manage their software project.
                        Focus on providing useful information about the project structure, files, and helping to organize tasks.
                        If asked about coding concepts, you can explain those too, but your primary focus is project management.`),
                    vscode.LanguageModelChatMessage.User(request.prompt)
                ];

                const chatResponse = await request.model.sendRequest(messages, {}, token);
                for await (const fragment of chatResponse.text) {
                    stream.markdown(fragment);
                }
            } catch (err) {
                if (err instanceof vscode.LanguageModelError) {
                    console.log(err.message, err.code, err.cause);
                    stream.markdown('I encountered an issue helping with project management. Please try again with a more specific question.');
                } else {
                    throw err;
                }
            }
        }

        return { metadata: { command: request.command || '' } };
    };

    const projectManagerChat = vscode.chat.createChatParticipant('project-manager.assistant', handler);
    projectManagerChat.iconPath = new vscode.ThemeIcon('project');

    context.subscriptions.push(projectManagerChat);

    // Register the tree view for the "project_management" folder
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const treeDataProvider = new ProjectManagementTreeDataProvider(workspaceRoot);
        const treeView = vscode.window.createTreeView('projectManagementView', { treeDataProvider });
        context.subscriptions.push(treeView);
    }

    return projectManagerChat;
}