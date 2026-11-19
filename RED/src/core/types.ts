export type Race = 'Human' | 'Elf' | 'Dwarf' | 'Beastkin';
export type CreatureKind = 'wolf' | 'deer' | 'bear';
export type CreatureMood = 'hostile' | 'passive' | 'territorial' | 'tamed' | 'dead';

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
    inventory: ['Worn sword', 'Valley herb'],
    equipment: ['Worn sword'],
    companions: 0,
    discoveredLocations: ['Forgotten Valley'],
  };
}
