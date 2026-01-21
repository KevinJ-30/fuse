import { Execution } from '@prisma/client';
import { CompensationStrategy, CompensationPlan } from './index';

export class FileStrategy implements CompensationStrategy {
  supports(tool: string): boolean {
    return (
      tool === 'write_file' ||
      tool === 'delete_file' ||
      tool === 'move_file' ||
      tool === 'copy_file' ||
      tool.startsWith('file_') ||
      tool.startsWith('fs_')
    );
  }

  async generate(execution: Execution): Promise<CompensationPlan[]> {
    const input = execution.input as any;
    const output = execution.output as any;

    switch (execution.tool) {
      case 'write_file':
      case 'file_write':
      case 'fs_write':
        // If we overwrote a file, restore it
        if (execution.previousState) {
          const previousContent = execution.previousState as any;
          return [
            {
              type: 'AUTO_REVERSE',
              tool: 'write_file',
              input: {
                path: input.path,
                content: previousContent.content || previousContent,
              },
              description: `Restore previous content of ${input.path}`,
              riskLevel: 'LOW',
              reasoning: 'Previous file content was saved, can safely restore',
            },
          ];
        }

        // If it was a new file, delete it
        if (output?.isNewFile || input.mode === 'create') {
          return [
            {
              type: 'AUTO_REVERSE',
              tool: 'delete_file',
              input: {
                path: input.path,
              },
              description: `Delete newly created file ${input.path}`,
              riskLevel: 'LOW',
              reasoning: 'File was newly created, safe to delete',
            },
          ];
        }

        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: 'write_file',
            input: { path: input.path },
            description: `Manually restore ${input.path}`,
            riskLevel: 'HIGH',
            reasoning: 'No backup of previous state available',
          },
        ];

      case 'delete_file':
      case 'file_delete':
      case 'fs_delete':
        // Restore from previous state
        if (execution.previousState) {
          const previousContent = execution.previousState as any;
          return [
            {
              type: 'AUTO_REVERSE',
              tool: 'write_file',
              input: {
                path: input.path,
                content: previousContent.content || previousContent,
              },
              description: `Restore deleted file ${input.path}`,
              riskLevel: 'MEDIUM',
              reasoning: 'File content was backed up before deletion',
            },
          ];
        }

        return [
          {
            type: 'NOT_REVERSIBLE',
            tool: 'write_file',
            input: { path: input.path },
            description: `Cannot restore ${input.path} - no backup available`,
            riskLevel: 'CRITICAL',
            reasoning: 'File was deleted without backup, must restore from external backup or accept data loss',
          },
        ];

      case 'move_file':
      case 'file_move':
      case 'fs_move':
        // Move it back
        return [
          {
            type: 'AUTO_REVERSE',
            tool: 'move_file',
            input: {
              from: input.to,
              to: input.from,
            },
            description: `Move ${input.to} back to ${input.from}`,
            riskLevel: 'LOW',
            reasoning: 'File move can be reversed by swapping paths',
          },
        ];

      case 'copy_file':
      case 'file_copy':
      case 'fs_copy':
        // Delete the copy
        return [
          {
            type: 'AUTO_REVERSE',
            tool: 'delete_file',
            input: {
              path: input.to,
            },
            description: `Delete copied file ${input.to}`,
            riskLevel: 'LOW',
            reasoning: 'Original file remains, safe to delete copy',
          },
        ];

      default:
        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: execution.tool,
            input: {},
            description: `Manual intervention required for ${execution.tool}`,
            riskLevel: 'MEDIUM',
            reasoning: 'No automated compensation strategy for this file operation',
          },
        ];
    }
  }
}

export default new FileStrategy();
