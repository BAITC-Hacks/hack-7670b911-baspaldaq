-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaskField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provenance" TEXT NOT NULL DEFAULT 'initial_description',
    "sourceId" TEXT,
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskField_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskDimension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "aiStatus" TEXT NOT NULL DEFAULT 'missing',
    "evidence" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "TaskDimension_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClarificationQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "targetDimensions" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    CONSTRAINT "ClarificationQuestion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClarificationAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClarificationAnswer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClarificationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ClarificationQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TaskField_taskId_status_idx" ON "TaskField"("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskField_taskId_key_key" ON "TaskField"("taskId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDimension_taskId_key_key" ON "TaskDimension"("taskId", "key");

-- CreateIndex
CREATE INDEX "ClarificationQuestion_taskId_status_idx" ON "ClarificationQuestion"("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationAnswer_questionId_key" ON "ClarificationAnswer"("questionId");

-- CreateIndex
CREATE INDEX "ClarificationAnswer_taskId_idx" ON "ClarificationAnswer"("taskId");
