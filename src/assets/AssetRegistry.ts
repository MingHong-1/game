import {
  type AssetAvailability,
  type AssetManifest,
  type AssetManifestEntry,
  validateAssetManifest,
} from './AssetManifest';

export interface AssetStatusSnapshot {
  readonly entry: AssetManifestEntry;
  readonly availability: AssetAvailability;
  readonly errorMessage?: string;
}

interface MutableAssetStatus {
  readonly entry: AssetManifestEntry;
  availability: AssetAvailability;
  errorMessage?: string;
}

export class AssetRegistry {
  private readonly statuses = new Map<string, MutableAssetStatus>();
  private readonly assetIdByPhaserKey = new Map<string, string>();
  private readonly reportedFailures = new Set<string>();

  public constructor(manifest: AssetManifest) {
    validateAssetManifest(manifest);
    for (const entry of manifest.entries) {
      this.statuses.set(entry.assetId, {
        entry,
        availability: entry.enabled ? 'registered' : 'disabled',
      });
      this.assetIdByPhaserKey.set(entry.phaserKey, entry.assetId);
    }
  }

  public getEntry(assetId: string): AssetManifestEntry | undefined {
    return this.statuses.get(assetId)?.entry;
  }

  public getStatus(assetId: string): AssetStatusSnapshot | undefined {
    const status = this.statuses.get(assetId);
    if (status === undefined) return undefined;
    return { ...status };
  }

  public getEnabledEntries(preloadGroup?: string): readonly AssetManifestEntry[] {
    const entries: AssetManifestEntry[] = [];
    for (const status of this.statuses.values()) {
      if (!status.entry.enabled) continue;
      if (
        preloadGroup !== undefined &&
        status.entry.preloadGroup !== preloadGroup
      ) {
        continue;
      }
      entries.push(status.entry);
    }
    return entries;
  }

  public isAvailable(assetId: string | undefined): boolean {
    return assetId !== undefined &&
      this.statuses.get(assetId)?.availability === 'available';
  }

  public getAvailablePhaserKey(assetId: string | undefined): string | null {
    if (assetId === undefined) return null;
    const status = this.statuses.get(assetId);
    return status?.availability === 'available'
      ? status.entry.phaserKey
      : null;
  }

  public markQueued(assetId: string): void {
    const status = this.requireEnabled(assetId);
    if (status.availability === 'available') return;
    status.availability = 'queued';
    delete status.errorMessage;
  }

  public markAvailable(assetId: string): void {
    const status = this.requireEnabled(assetId);
    status.availability = 'available';
    delete status.errorMessage;
  }

  public markAvailableByPhaserKey(phaserKey: string): void {
    const assetId = this.assetIdByPhaserKey.get(phaserKey);
    if (assetId !== undefined) this.markAvailable(assetId);
  }

  public markFailedByPhaserKey(
    phaserKey: string,
    message: string,
  ): AssetStatusSnapshot | undefined {
    const assetId = this.assetIdByPhaserKey.get(phaserKey);
    if (assetId === undefined) return undefined;
    const status = this.requireEnabled(assetId);
    status.availability = 'failed';
    status.errorMessage = message;
    return { ...status };
  }

  public markQueuedEntriesAvailable(): void {
    for (const status of this.statuses.values()) {
      if (status.availability === 'queued') {
        status.availability = 'available';
      }
    }
  }

  public getRequiredFailures(): readonly AssetStatusSnapshot[] {
    const failures: AssetStatusSnapshot[] = [];
    for (const status of this.statuses.values()) {
      if (status.entry.required && status.availability === 'failed') {
        failures.push({ ...status });
      }
    }
    return failures;
  }

  public reportFailureOnce(
    assetId: string,
    reporter: (status: AssetStatusSnapshot) => void,
  ): void {
    if (this.reportedFailures.has(assetId)) return;
    const status = this.getStatus(assetId);
    if (status?.availability !== 'failed') return;
    this.reportedFailures.add(assetId);
    reporter(status);
  }

  public resetAvailability(): void {
    this.reportedFailures.clear();
    for (const status of this.statuses.values()) {
      status.availability = status.entry.enabled ? 'registered' : 'disabled';
      delete status.errorMessage;
    }
  }

  private requireEnabled(assetId: string): MutableAssetStatus {
    const status = this.statuses.get(assetId);
    if (status === undefined) throw new Error(`未登记资源：${assetId}`);
    if (!status.entry.enabled) {
      throw new Error(`未启用资源不能进入加载状态：${assetId}`);
    }
    return status;
  }
}
