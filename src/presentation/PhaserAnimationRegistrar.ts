import Phaser from 'phaser';

import type { AssetRegistry } from '../assets/AssetRegistry';
import type {
  AnimationClipDefinition,
  EntityAnimationSet,
} from './AnimationDefinitions';

function getUniqueClips(
  animationSets: readonly (EntityAnimationSet | undefined)[],
): readonly AnimationClipDefinition[] {
  const clips = new Map<string, AnimationClipDefinition>();
  for (const animationSet of animationSets) {
    for (const clip of Object.values(animationSet?.clips ?? {})) {
      if (clip !== undefined) clips.set(clip.clipId, clip);
    }
  }
  return [...clips.values()];
}

export function registerPhaserAnimations(
  scene: Phaser.Scene,
  animationSets: readonly (EntityAnimationSet | undefined)[],
  assets: AssetRegistry,
): number {
  let registeredCount = 0;
  for (const clip of getUniqueClips(animationSets)) {
    const textureKey = assets.getAvailablePhaserKey(clip.spriteSheetAssetId);
    if (textureKey === null || scene.anims.exists(clip.animationKey)) continue;
    const frames = 'names' in clip.frames
      ? clip.frames.names.map((frame) => ({ key: textureKey, frame }))
      : scene.anims.generateFrameNumbers(textureKey, {
          start: clip.frames.start,
          end: clip.frames.end,
        });
    scene.anims.create({
      key: clip.animationKey,
      frames,
      frameRate: clip.frameRate,
      repeat: clip.repeat,
      yoyo: clip.yoyo,
      ...(clip.durationMs === undefined ? {} : { duration: clip.durationMs }),
    });
    registeredCount += 1;
  }
  return registeredCount;
}
