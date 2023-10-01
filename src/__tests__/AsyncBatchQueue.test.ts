import { describe, it, expect } from '@jest/globals';
import { AsyncBatchQueue } from '../AsyncBatchQueue';

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(undefined), delayMs),
  );
}

describe('AsyncBatchQueue', () => {
  it('should process in batches', async () => {
    const callOrder: number[] = [];
    const queue = new AsyncBatchQueue(5, [
      // Batch 1
      () =>
        delay(20).then(() => {
          callOrder.push(4);
        }),
      () =>
        delay(19).then(() => {
          callOrder.push(3);
        }),
      () =>
        delay(18).then(() => {
          callOrder.push(2);
        }),
      () =>
        delay(17).then(() => {
          callOrder.push(1);
        }),
      () =>
        delay(16).then(() => {
          callOrder.push(0);
        }),

      // Batch 2
      () =>
        delay(15).then(() => {
          callOrder.push(9);
        }),
      () =>
        delay(14).then(() => {
          callOrder.push(8);
        }),
      () =>
        delay(13).then(() => {
          callOrder.push(7);
        }),
      () =>
        delay(12).then(() => {
          callOrder.push(6);
        }),
      () =>
        delay(11).then(() => {
          callOrder.push(5);
        }),

      // Batch 3
      () =>
        delay(10).then(() => {
          callOrder.push(10);
        }),
    ]);
    await queue.process();
    expect(callOrder.length).toBe(11);
  });
});
