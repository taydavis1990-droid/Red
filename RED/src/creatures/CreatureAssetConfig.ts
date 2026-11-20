export interface CreatureAssetConfig {
  id: string;
  label: string;
  path: string;
  targetHeight: number;
  rotationY?: number;
  animationMap?: Partial<Record<CreatureAnimationState, string>>;
}

export type CreatureAnimationState = 'idle' | 'walk' | 'run' | 'attack' | 'special' | 'hit' | 'death';

export const MONSTER_PREVIEW_ASSETS: readonly CreatureAssetConfig[] = [
  {
    id: 'ancient-wolf',
    label: 'Floor 1 - Ancient Wolf (Marsh Direwolf)',
    path: 'assets/monsters/bosses/ancient-wolf/marsh-direwolf.glb',
    targetHeight: 1.4,
  },
  {
    id: 'eternal-phoenix-optimized',
    label: 'Floor 2 - Eternal Phoenix (99,996 triangles; static preview)',
    path: 'assets/monsters/bosses/eternal-phoenix/phoenix-optimized-100k.glb',
    targetHeight: 2.5,
  },
  {
    id: 'eternal-dragon',
    label: 'Floor 3 - Eternal Dragon (Ashfen Dragon)',
    path: 'assets/monsters/bosses/eternal-dragon/ashfen-dragon.glb',
    targetHeight: 3.2,
  },
];

export const ANCIENT_WOLF_BOSS_ASSET: CreatureAssetConfig = {
  id: 'ancient-wolf',
  label: 'Ancient Wolf (Marsh Direwolf)',
  path: 'assets/monsters/bosses/ancient-wolf/marsh-direwolf.glb',
  targetHeight: 2.45,
};

export const ETERNAL_PHOENIX_BOSS_ASSET: CreatureAssetConfig = {
  id: 'eternal-phoenix',
  label: 'Eternal Phoenix (static optimized visual)',
  path: 'assets/monsters/bosses/eternal-phoenix/phoenix-optimized-100k.glb',
  targetHeight: 2.5,
};

export const ETERNAL_DRAGON_BOSS_ASSET: CreatureAssetConfig = {
  id: 'eternal-dragon',
  label: 'Eternal Dragon (Ashfen Dragon)',
  path: 'assets/monsters/bosses/eternal-dragon/ashfen-dragon.glb',
  targetHeight: 3.2,
};

export const GLOOM_STALKER_ASSET: CreatureAssetConfig = {
  id: 'gloom-stalker',
  label: 'Gloom Stalker',
  path: 'assets/monsters/enemies/gloom-stalker.glb',
  targetHeight: 1.8,
  animationMap: {
    idle: 'combat_idle',
    walk: 'walk_forward',
    run: 'run_forward',
    attack: 'punch_right',
    special: 'kick',
    hit: 'hit_reaction',
    death: 'death_fall',
  },
};

export const HOLLOW_WARDEN_ASSET: CreatureAssetConfig = {
  id: 'hollow-warden',
  label: 'Hollow Warden',
  path: 'assets/monsters/enemies/hollow-warden.glb',
  targetHeight: 1.8,
  animationMap: {
    idle: 'sword_idle',
    walk: 'walk_forward',
    run: 'run_forward',
    attack: 'sword_slash_horizontal',
    special: 'shield_bash',
    hit: 'stagger_back',
    death: 'knocked_down',
  },
};
