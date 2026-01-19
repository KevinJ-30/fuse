import { Execution } from '@prisma/client';
import { CompensationStrategy, CompensationPlan } from './index';

export class DatabaseStrategy implements CompensationStrategy {
  supports(tool: string): boolean {
    return (
      tool === 'create_record' ||
      tool === 'update_record' ||
      tool === 'delete_record' ||
      tool.startsWith('db_') ||
      tool.startsWith('database_')
    );
  }

  async generate(execution: Execution): Promise<CompensationPlan[]> {
    const input = execution.input as any;
    const output = execution.output as any;

    switch (execution.tool) {
      case 'create_record':
      case 'db_create':
        // Delete the created record
        return [
          {
            type: 'AUTO_REVERSE',
            tool: 'delete_record',
            input: {
              table: input.table,
              id: output?.id || input.id,
            },
            description: `Delete ${input.table} record ${output?.id || input.id}`,
            riskLevel: 'LOW',
            reasoning: 'Newly created record can be safely deleted',
          },
        ];

      case 'update_record':
      case 'db_update':
        // Restore previous values if available
        if (execution.previousState) {
          const previousData = execution.previousState as any;
          return [
            {
              type: 'AUTO_REVERSE',
              tool: 'update_record',
              input: {
                table: input.table,
                id: input.id,
                data: previousData.values || previousData,
              },
              description: `Restore previous values for ${input.table} record ${input.id}`,
              riskLevel: 'LOW',
              reasoning: 'Previous state captured, can safely restore',
            },
          ];
        }

        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: 'update_record',
            input: {
              table: input.table,
              id: input.id,
            },
            description: `Manually restore ${input.table} record ${input.id}`,
            riskLevel: 'HIGH',
            reasoning: 'No previous state saved, manual review required',
          },
        ];

      case 'delete_record':
      case 'db_delete':
        // Restore from previous state if available
        if (execution.previousState) {
          const previousData = execution.previousState as any;
          return [
            {
              type: 'SUGGESTED',
              tool: 'create_record',
              input: {
                table: input.table,
                id: input.id,
                data: previousData.values || previousData,
              },
              description: `Restore deleted ${input.table} record ${input.id}`,
              riskLevel: 'MEDIUM',
              reasoning: 'Recreation from backup - verify data integrity',
            },
          ];
        }

        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: 'create_record',
            input: {
              table: input.table,
              id: input.id,
            },
            description: `Manually restore deleted ${input.table} record ${input.id}`,
            riskLevel: 'CRITICAL',
            reasoning: 'No backup available, must restore from external backup or accept data loss',
          },
        ];

      case 'db_bulk_insert':
      case 'bulk_create':
        // Delete all created records
        const createdIds = output?.ids || [];
        if (createdIds.length > 0) {
          return [
            {
              type: 'SUGGESTED',
              tool: 'db_bulk_delete',
              input: {
                table: input.table,
                ids: createdIds,
              },
              description: `Delete ${createdIds.length} bulk-created ${input.table} records`,
              riskLevel: 'MEDIUM',
              reasoning: 'Bulk operation - review list before deletion',
            },
          ];
        }

        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: 'db_bulk_delete',
            input: { table: input.table },
            description: `Manually identify and delete bulk-created ${input.table} records`,
            riskLevel: 'HIGH',
            reasoning: 'Created record IDs not tracked, manual identification required',
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
            reasoning: 'No automated compensation strategy for this database operation',
          },
        ];
    }
  }
}

export default new DatabaseStrategy();
