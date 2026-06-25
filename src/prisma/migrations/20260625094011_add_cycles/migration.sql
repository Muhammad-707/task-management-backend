-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "cycle_id" TEXT;

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cycle_workspace_id_idx" ON "Cycle"("workspace_id");

-- CreateIndex
CREATE INDEX "Cycle_project_id_idx" ON "Cycle"("project_id");

-- CreateIndex
CREATE INDEX "Issue_cycle_id_idx" ON "Issue"("cycle_id");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
