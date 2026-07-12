import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { GAME_ASSET_MANIFEST } from '../src/assets/AssetManifest';

interface RuntimeAssetReportEntry {
  readonly heroDirectory: string;
  readonly masterPath: string;
  readonly runtimePath: string;
  readonly masterSha256: string;
  readonly runtimeSha256: string;
  readonly originalMode: string;
  readonly originalSize: readonly [number, number];
  readonly runtimeMode: string;
  readonly runtimeSize: readonly [number, number];
  readonly runtimeAlphaBounds: readonly [number, number, number, number];
  readonly safetyMargins: Readonly<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  readonly cornerAlpha: readonly number[];
}

const report = JSON.parse(
  readFileSync('tools/hero_runtime_assets_report.json', 'utf8'),
) as { readonly assets: readonly RuntimeAssetReportEntry[] };

describe('英雄运行纹理生成结果', () => {
  it('五张母版保持1254×1254 RGBA且SHA与生成报告一致', () => {
    expect(report.assets).toHaveLength(5);
    for (const asset of report.assets) {
      expect(asset.originalSize).toEqual([1_254, 1_254]);
      expect(asset.originalMode).toBe('RGBA');
      expect(sha256(asset.masterPath)).toBe(asset.masterSha256);
    }
  });

  it('运行纹理为确定的256×256 RGBA PNG并保留安全边距', () => {
    for (const asset of report.assets) {
      const bytes = readFileSync(asset.runtimePath);
      expect(readPngHeader(bytes)).toEqual({ width: 256, height: 256, colorType: 6 });
      expect(asset.runtimeSize).toEqual([256, 256]);
      expect(asset.runtimeMode).toBe('RGBA');
      expect(asset.cornerAlpha).toEqual([0, 0, 0, 0]);
      expect(Math.min(...Object.values(asset.safetyMargins))).toBeGreaterThanOrEqual(15);
      expect(asset.runtimeAlphaBounds[0]).toBeGreaterThan(0);
      expect(asset.runtimeAlphaBounds[1]).toBeGreaterThan(0);
      expect(asset.runtimeAlphaBounds[2]).toBeLessThan(256);
      expect(asset.runtimeAlphaBounds[3]).toBeLessThan(256);
      expect(sha256(asset.runtimePath)).toBe(asset.runtimeSha256);
    }
  });

  it('Manifest只加载四名运行时英雄的runtime纹理', () => {
    expect(GAME_ASSET_MANIFEST.entries).toHaveLength(4);
    for (const entry of GAME_ASSET_MANIFEST.entries) {
      expect(entry.filePath).toContain('/runtime/battle-1star.png');
      expect(entry.filePath).not.toMatch(/heroes\/[^/]+\/battle-1star\.png$/);
      expect(entry.owner.id).not.toBe('forest-summoner');
    }
    expect(
      GAME_ASSET_MANIFEST.entries.some((entry) =>
        entry.filePath.includes('forest-summoner')),
    ).toBe(false);
  });
});

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readPngHeader(bytes: Buffer): {
  readonly width: number;
  readonly height: number;
  readonly colorType: number;
} {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}
