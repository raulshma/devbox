/**
 * Parallel Worker
 *
 * Worker thread for executing parallel tasks
 * This file runs in a separate thread context
 */

import { parentPort, workerData } from 'worker_threads';
import type { ParallelTask, TaskResult, TaskProcessor, WorkerMessage } from '../utils/parallelProcessor.js';

/**
 * Current processor function
 */
let currentProcessor: TaskProcessor<any, any> | null = null;

/**
 * Initialize the worker with a processor function
 */
function initialize(processorCode: string): void {
  try {
    // Create processor function from code
    currentProcessor = eval(`(${processorCode})`);

    parentPort?.postMessage({
      type: 'init',
    } as WorkerMessage);
  } catch (error) {
    console.error('[ParallelWorker] Initialization failed:', error);
    throw error;
  }
}

/**
 * Execute a task
 */
async function executeTask(task: ParallelTask): Promise<TaskResult> {
  if (!currentProcessor) {
    return {
      id: task.id,
      error: 'Worker not initialized',
      success: false,
    };
  }

  try {
    const output = await currentProcessor(task.input);
    return {
      id: task.id,
      output,
      success: true,
    };
  } catch (error) {
    return {
      id: task.id,
      error: error instanceof Error ? error.message : String(error),
      success: false,
    };
  }
}

/**
 * Handle incoming messages from main thread
 */
parentPort?.on('message', async (message: WorkerMessage) => {
  try {
    switch (message.type) {
      case 'task': {
        const result = await executeTask(message.task);

        parentPort?.postMessage({
          type: 'result',
          result,
          taskId: message.taskId,
        } as WorkerMessage);
        break;
      }

      case 'init':
        // Initialization handled separately
        break;

      default:
        console.warn('[ParallelWorker] Unknown message type:', (message as any).type);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const taskId = 'taskId' in message ? message.taskId : 'unknown';

    parentPort?.postMessage({
      type: 'error',
      error: errorMsg,
      taskId,
    } as WorkerMessage);
  }
});

// Export for type checking
export type {};
