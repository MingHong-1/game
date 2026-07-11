import type { AssetRegistry } from '../assets/AssetRegistry';

export type EntityVisualState =
  | 'idle'
  | 'summon'
  | 'attack'
  | 'cast'
  | 'buffed'
  | 'disabled'
  | 'merge'
  | 'walk'
  | 'hit'
  | 'slowed'
  | 'frozen'
  | 'stunned'
  | 'shielded'
  | 'death'
  | 'reachCore'
  | 'phaseChange';

export interface AnimationClipDefinition {
  readonly clipId: string;
  readonly spriteSheetAssetId: string;
  readonly animationKey: string;
  readonly frames:
    | { readonly start: number; readonly end: number }
    | { readonly names: readonly string[] };
  readonly frameRate: number;
  readonly repeat: number;
  readonly yoyo: boolean;
  readonly durationMs?: number;
  readonly fallbackState?: EntityVisualState;
  readonly interruptibleByHigherPriority: boolean;
}

export interface EntityAnimationSet {
  readonly clips: Partial<Record<EntityVisualState, AnimationClipDefinition>>;
}

export const ANIMATION_STATE_PRIORITY: Readonly<Record<EntityVisualState, number>> =
  Object.freeze({
    idle: 0,
    walk: 0,
    summon: 1,
    attack: 2,
    hit: 3,
    buffed: 3,
    disabled: 4,
    slowed: 4,
    frozen: 5,
    stunned: 5,
    shielded: 5,
    merge: 6,
    cast: 7,
    reachCore: 8,
    phaseChange: 9,
    death: 10,
  });

export interface ResolvedAnimationClip {
  readonly state: EntityVisualState;
  readonly clip: AnimationClipDefinition;
  readonly textureKey: string;
}

export function resolveAnimationClip(
  animationSet: EntityAnimationSet | undefined,
  requestedState: EntityVisualState,
  assets: AssetRegistry,
): ResolvedAnimationClip | null {
  let state: EntityVisualState | undefined = requestedState;
  const visited = new Set<EntityVisualState>();
  while (state !== undefined && !visited.has(state)) {
    visited.add(state);
    const clip: AnimationClipDefinition | undefined =
      animationSet?.clips[state];
    if (clip === undefined) return null;
    const textureKey = assets.getAvailablePhaserKey(clip.spriteSheetAssetId);
    if (textureKey !== null) return { state, clip, textureKey };
    state = clip.fallbackState;
  }
  return null;
}

export function canInterruptAnimation(
  currentState: EntityVisualState,
  nextState: EntityVisualState,
  currentClip?: AnimationClipDefinition,
): boolean {
  if (currentState === nextState) return false;
  if (currentClip?.interruptibleByHigherPriority === false) return false;
  return ANIMATION_STATE_PRIORITY[nextState] >=
    ANIMATION_STATE_PRIORITY[currentState];
}
