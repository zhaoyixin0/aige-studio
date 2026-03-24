// src/services/asset-library.ts
// Persistent asset library using IndexedDB via idb-keyval.
// Keeps an in-memory cache that stays in sync with IndexedDB.

import { get, set, del } from 'idb-keyval';

export interface LibraryAsset {
  id: string;
  name: string;
  tags: string[];
  type: 'sprite' | 'sound' | 'background' | 'particle';
  src: string;          // data URL
  createdAt: string;
  gameType?: string;    // which game type it was created for
  theme?: string;       // which theme
}

const STORAGE_KEY = 'aige-asset-library';

export class AssetLibrary {
  private assets: LibraryAsset[] = [];
  private _ready: Promise<void>;

  constructor() {
    this._ready = this.load();
  }

  /** Wait until IndexedDB data is loaded into memory. */
  async ready(): Promise<void> {
    await this._ready;
  }

  private async load(): Promise<void> {
    try {
      const data = await get<LibraryAsset[]>(STORAGE_KEY);
      this.assets = data ?? [];
    } catch {
      this.assets = [];
    }
  }

  private async persist(): Promise<void> {
    await set(STORAGE_KEY, this.assets);
  }

  async save(asset: Omit<LibraryAsset, 'id' | 'createdAt'>): Promise<LibraryAsset> {
    await this._ready;
    const entry: LibraryAsset = {
      ...asset,
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.assets.push(entry);
    await this.persist();
    return entry;
  }

  /** Search by name (Chinese or English, fuzzy) */
  search(query: string): LibraryAsset[] {
    const q = query.toLowerCase();
    return this.assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /** Search by exact tag match */
  searchByTag(tag: string): LibraryAsset[] {
    return this.assets.filter(a => a.tags.includes(tag));
  }

  /** Find by asset key (e.g., 'star', 'bomb') -- exact match on tags or name */
  findByKey(key: string): LibraryAsset | undefined {
    return this.assets.find(a =>
      a.tags.includes(key) || a.name === key
    );
  }

  /** Find by key + theme for best match */
  findByKeyAndTheme(key: string, theme?: string): LibraryAsset | undefined {
    if (theme) {
      // When a theme is specified, only return same-theme matches.
      // Do NOT fallback to a different theme — force regeneration instead.
      return this.assets.find(a =>
        (a.tags.includes(key) || a.name === key) && a.theme === theme
      );
    }
    return this.findByKey(key);
  }

  /** Generate a descriptive name for a new asset */
  generateName(assetKey: string, theme?: string): string {
    const NAMES: Record<string, string> = {
      star: '\u661F\u661F', apple: '\u82F9\u679C', coin: '\u91D1\u5E01', bomb: '\u70B8\u5F39',
      meteor: '\u6D41\u661F', heart: '\u7231\u5FC3', ghost: '\u5E7D\u7075', diamond: '\u94BB\u77F3',
      gift: '\u793C\u7269', rocket: '\u706B\u7BAD', obstacle: '\u969C\u788D\u7269',
      target_normal: '\u6807\u9776', target_gold: '\u91D1\u8272\u6807\u9776', target_small: '\u5C0F\u6807\u9776',
      bubble_red: '\u7EA2\u6CE1\u6CE1', bubble_blue: '\u84DD\u6CE1\u6CE1', bubble_gold: '\u91D1\u6CE1\u6CE1',
    };
    const baseName = NAMES[assetKey] ?? assetKey;
    const themeName = theme ? `${theme}_` : '';
    return `${themeName}${baseName}`;
  }

  getAll(): LibraryAsset[] {
    return [...this.assets];
  }

  async remove(id: string): Promise<void> {
    this.assets = this.assets.filter(a => a.id !== id);
    await this.persist();
  }

  async clear(): Promise<void> {
    this.assets = [];
    await del(STORAGE_KEY);
  }
}
