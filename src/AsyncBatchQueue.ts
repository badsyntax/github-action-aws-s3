type OperationQueue = Array<() => Promise<unknown>>;

export class AsyncBatchQueue {
  private operationQueue: OperationQueue = [];
  public inProgress = 0;

  public constructor(
    private readonly concurrency: number,
    queue: OperationQueue
  ) {
    this.operationQueue = queue.slice();
  }

  public async process(): Promise<void> {
    const amount = Math.min(
      this.concurrency - this.inProgress,
      this.operationQueue.length
    );
    if (amount === 0) {
      return;
    }
    const batch = this.operationQueue.splice(0, amount);
    this.inProgress += batch.length;
    await Promise.all(
      batch.map((operation) =>
        operation().then(() => {
          this.inProgress--;
          return this.process();
        })
      )
    );
  }
}
