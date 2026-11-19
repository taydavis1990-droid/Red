import type { CharacterData } from './types';
import { createCharacter } from './types';

const DATABASE = 'red-forgotten-valley';
const STORE = 'saves';
const SAVE_KEY = 'main';
const SAVE_VERSION = 1;

interface SaveRecord {
  version: number;
  character: CharacterData;
  savedAt: number;
}

export class SaveManager {
  private database: IDBDatabase | null = null;

  async open(): Promise<void> {
    this.database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open local save database.'));
    });
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  async load(): Promise<CharacterData | null> {
    const db = this.requireDatabase();
    const saved = await this.request<SaveRecord | undefined>(
      db.transaction(STORE).objectStore(STORE).get(SAVE_KEY),
    );
    if (!saved) return null;
    if (saved.version > SAVE_VERSION || saved.version < 0) {
      throw new Error(`Save version ${saved.version} is not supported by this build.`);
    }
    let record = saved;
    while (record.version < SAVE_VERSION) {
      if (record.version === 0) {
        const defaults = createCharacter('Human', 'Wayfarer');
        record = {
          ...record,
          version: 1,
          character: {
            ...defaults,
            ...record.character,
            attributes: { ...defaults.attributes, ...record.character.attributes },
            inventory: record.character.inventory ?? defaults.inventory,
            equipment: record.character.equipment ?? defaults.equipment,
            discoveredLocations: record.character.discoveredLocations ?? defaults.discoveredLocations,
          },
        };
        continue;
      }
      throw new Error(`No migration exists for save version ${record.version}.`);
    }
    if (record.version !== saved.version) await this.save(record.character);
    return record.character;
  }

  async save(character: CharacterData): Promise<void> {
    const db = this.requireDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ version: SAVE_VERSION, character, savedAt: Date.now() } satisfies SaveRecord, SAVE_KEY);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save character.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Character save was aborted.'));
    });
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) throw new Error('Save database has not been opened.');
    return this.database;
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not read local save.'));
    });
  }
}
