ALTER TABLE "ClarificationQuestion" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TaskMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "questionId" TEXT,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskMessage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ClarificationQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TaskMessage_taskId_createdAt_idx" ON "TaskMessage"("taskId", "createdAt");
CREATE INDEX "TaskMessage_questionId_idx" ON "TaskMessage"("questionId");
