/** Bounded scratch-object storage. Released objects must never escape into saved reports. */
export class ObjectPool<T extends object> {
  private free: T[] = [];
  created = 0;
  reused = 0;
  constructor(private readonly create: () => T, private readonly reset: (value: T) => void, private readonly capacity = 128) {}
  acquire() {
    const item = this.free.pop();
    if (item) { this.reused++; return item; }
    this.created++; return this.create();
  }
  release(item: T) { this.reset(item); if (this.free.length < this.capacity) this.free.push(item); }
  get retained() { return this.free.length; }
}
