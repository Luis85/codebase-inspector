export interface CancellationToken {
  readonly cancelled: boolean;
  throwIfCancelled(): void;
  onCancelled(listener: () => void): () => void;
}
