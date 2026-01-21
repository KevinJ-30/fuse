-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'BLOCKED', 'AWAITING_APPROVAL', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "BreakerScope" AS ENUM ('GLOBAL', 'AGENT', 'TOOL');

-- CreateEnum
CREATE TYPE "BreakerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PolicyAction" AS ENUM ('ALLOW', 'DENY', 'REQUIRE_APPROVAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RollbackStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('AUTO_REVERSE', 'SUGGESTED', 'MANUAL_REQUIRED', 'NOT_REVERSIBLE', 'NO_ACTION_NEEDED');

-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('RATE_LIMIT', 'VALUE_THRESHOLD', 'PATTERN_MATCH', 'TIME_RESTRICTION', 'PROTECTED_RESOURCE');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "ExecutionStatus" NOT NULL,
    "parentId" TEXT,
    "previousState" JSONB,
    "riskScore" DOUBLE PRECISION,
    "detectionFlags" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breaker" (
    "id" TEXT NOT NULL,
    "scope" "BreakerScope" NOT NULL,
    "target" TEXT,
    "status" "BreakerStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "condition" TEXT,
    "action" "PolicyAction" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskBreakdown" JSONB NOT NULL,
    "detectionFlags" JSONB NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decision" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rollback" (
    "id" TEXT NOT NULL,
    "targetExecutionId" TEXT NOT NULL,
    "status" "RollbackStatus" NOT NULL,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "executedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "initiatedBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rollback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compensation" (
    "id" TEXT NOT NULL,
    "rollbackId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "type" "CompensationType" NOT NULL,
    "tool" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "description" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" "CompensationStatus" NOT NULL,
    "error" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "config" JSONB NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyBaseline" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "dailyCountsMean" DOUBLE PRECISION NOT NULL,
    "dailyCountsStdDev" DOUBLE PRECISION NOT NULL,
    "activeHours" JSONB NOT NULL,
    "commonTargets" JSONB NOT NULL,
    "transitionProbabilities" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_agentId_idx" ON "Execution"("agentId");

-- CreateIndex
CREATE INDEX "Execution_tool_idx" ON "Execution"("tool");

-- CreateIndex
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- CreateIndex
CREATE INDEX "Execution_parentId_idx" ON "Execution"("parentId");

-- CreateIndex
CREATE INDEX "Execution_createdAt_idx" ON "Execution"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Breaker_scope_target_key" ON "Breaker"("scope", "target");

-- CreateIndex
CREATE INDEX "Policy_tool_idx" ON "Policy"("tool");

-- CreateIndex
CREATE INDEX "Policy_enabled_idx" ON "Policy"("enabled");

-- CreateIndex
CREATE INDEX "Policy_priority_idx" ON "Policy"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_executionId_key" ON "ApprovalRequest"("executionId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_createdAt_idx" ON "ApprovalRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rollback_targetExecutionId_key" ON "Rollback"("targetExecutionId");

-- CreateIndex
CREATE INDEX "Rollback_status_idx" ON "Rollback"("status");

-- CreateIndex
CREATE INDEX "Rollback_createdAt_idx" ON "Rollback"("createdAt");

-- CreateIndex
CREATE INDEX "Compensation_rollbackId_idx" ON "Compensation"("rollbackId");

-- CreateIndex
CREATE INDEX "Compensation_status_idx" ON "Compensation"("status");

-- CreateIndex
CREATE INDEX "Rule_enabled_idx" ON "Rule"("enabled");

-- CreateIndex
CREATE INDEX "Rule_type_idx" ON "Rule"("type");

-- CreateIndex
CREATE INDEX "AnomalyBaseline_lastUpdated_idx" ON "AnomalyBaseline"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyBaseline_agentId_tool_key" ON "AnomalyBaseline"("agentId", "tool");

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rollback" ADD CONSTRAINT "Rollback_targetExecutionId_fkey" FOREIGN KEY ("targetExecutionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_rollbackId_fkey" FOREIGN KEY ("rollbackId") REFERENCES "Rollback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
