export class FirestoreMetrics {
  private circuitBreakerUntil = 0;
  private readCount = 0;
  private cacheHits = 0;
  private errorCount = 0;
  private lastErrors: Array<{ caller: string; collection: string; error: string; time: number }> = [];

  setCircuitBreaker(until: number) {
    this.circuitBreakerUntil = Math.max(this.circuitBreakerUntil, until);
  }

  isCircuitBreakerActive(): boolean {
    return Date.now() < this.circuitBreakerUntil;
  }

  recordError(caller: string, collection: string, err: any) {
    this.errorCount++;
    this.lastErrors.unshift({
      caller,
      collection,
      error: typeof err === 'string' ? err : err?.message || String(err),
      time: Date.now(),
    });
    if (this.lastErrors.length > 20) {
      this.lastErrors.pop();
    }
  }

  recordRead(_caller: string, _collection: string, _type: string, count: number, isCacheHit: boolean) {
    this.readCount += count;
    if (isCacheHit) {
      this.cacheHits += count;
    }
  }

  getMetricsSummary() {
    return {
      circuitBreakerActive: this.isCircuitBreakerActive(),
      circuitBreakerUntil: this.circuitBreakerUntil,
      readCount: this.readCount,
      cacheHits: this.cacheHits,
      errorCount: this.errorCount,
      lastErrors: this.lastErrors,
    };
  }
}

export const firestoreMetrics = new FirestoreMetrics();
