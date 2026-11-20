export type Race = 'Human' | 'Elf' | 'Dwarf' | 'Beastkin';
export type CreatureKind = 'wolf' | 'deer' | 'bear';
export type CreatureMood = 'hostile' | 'passive' | 'territorial' | 'tamed' | 'dead';
export type GameLocation = 'hub' | 'floor1' | 'floor2' | 'floor3';

export interface TowerProgression {
  currentLocation: GameLocation;
  unlockedFloors: number[];
  defeatedBosses: string[];
}

export interface Attributes {
  health: number;
  stamina: number;
  mana: number;
  strength: number;
  agility: number;
  intelligence: number;
  defense: number;
}

export interface CharacterData {
  name: string;
  race: Race;
  level: number;
  xp: number;
  attributes: Attributes;
  inventory: string[];
  equipment: string[];
  companions: number;
  discoveredLocations: string[];
  tower: TowerProgression;
}

export function createTowerProgression(currentLocation: GameLocation = 'hub'): TowerProgression {
  return {
    currentLocation,
    unlockedFloors: [1],
    defeatedBosses: [],
  };
}

export function normalizeTowerProgression(value: unknown, fallback: GameLocation = 'floor1'): TowerProgression {
  if (!value || typeof value !== 'object') return createTowerProgression(fallback);
  const saved = value as Partial<TowerProgression>;
  const unlockedFloors = Array.isArray(saved.unlockedFloors)
    ? [...new Set(saved.unlockedFloors.filter((floor): floor is number =>
      Number.isInteger(floor) && floor >= 1 && floor <= 3,
    ))].sort((a, b) => a - b)
    : [1];
  if (!unlockedFloors.includes(1)) unlockedFloors.unshift(1);
  const defeatedBosses = Array.isArray(saved.defeatedBosses)
    ? [...new Set(saved.defeatedBosses.filter((boss): boss is string => typeof boss === 'string'))]
    : [];
  const requestedLocation = saved.currentLocation;
  const currentLocation: GameLocation = requestedLocation === 'hub'
    || requestedLocation === 'floor1'
    || requestedLocation === 'floor2'
    || requestedLocation === 'floor3'
      ? requestedLocation
      : fallback;
  const floor = Number(currentLocation.slice(-1));
  return currentLocation === 'hub' || unlockedFloors.includes(floor)
    ? { currentLocation, unlockedFloors, defeatedBosses }
    : { currentLocation: 'hub', unlockedFloors, defeatedBosses };
}

export const RACE_ATTRIBUTES: Record<Race, Attributes> = {
  Human: { health: 110, stamina: 105, mana: 100, strength: 10, agility: 10, intelligence: 10, defense: 10 },
  Elf: { health: 95, stamina: 110, mana: 125, strength: 8, agility: 14, intelligence: 13, defense: 8 },
  Dwarf: { health: 130, stamina: 115, mana: 80, strength: 14, agility: 7, intelligence: 9, defense: 15 },
  Beastkin: { health: 105, stamina: 125, mana: 90, strength: 12, agility: 15, intelligence: 8, defense: 9 },
};

export function createCharacter(race: Race, name: string): CharacterData {
  return {
    name,
    race,
    level: 1,
    xp: 0,
    attributes: { ...RACE_ATTRIBUTES[race] },
    inventory: ['Worn sword', 'Broadsword', 'Dagger', 'Valley herb'],
    equipment: ['Worn sword'],
    companions: 0,
    discoveredLocations: ['Forgotten Valley'],
    tower: createTowerProgression(),
  };
}
