import type { Creature } from '../creatures/Creature';
import { isGraphicsQuality, type GraphicsQuality } from '../core/GraphicsConfig';
import { RACE_ATTRIBUTES, type CharacterData, type GameLocation, type Race, type TowerProgression } from '../core/types';

export interface UIActions {
  start: (race: Race, name: string) => void;
  preview: (race: Race) => void;
  continue: () => void;
  attack: () => void;
  jump: () => void;
  interact: () => void;
  spirit: () => void;
  camera: () => void;
  toggleInventory: () => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setBlocking: (blocked: boolean) => void;
  setSprinting: (sprinting: boolean) => void;
}

type GamePanelName = 'inventory' | 'equipment' | 'character' | 'companion' | 'quests' | 'map' | 'settings';

interface LandmarkStatus {
  name: string;
  x: number;
  z: number;
  discovered: boolean;
}

interface GameUIState {
  character: CharacterData;
  health: number;
  stamina: number;
  mana: number;
  camera: string;
  prompt: string;
  companion: Creature | null;
  spiritActive: boolean;
  spiritCooldown: number;
  graphicsQuality: GraphicsQuality;
  landmarks: LandmarkStatus[];
  location: GameLocation;
  tower: TowerProgression;
  boss?: {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    phase: number;
    visualStatus: string;
  };
}

const GAME_PANELS: Array<{ id: GamePanelName; label: string; icon: string }> = [
  { id: 'inventory', label: 'Pack', icon: '▤' },
  { id: 'equipment', label: 'Gear', icon: '⚒' },
  { id: 'character', label: 'Attributes', icon: '♙' },
  { id: 'companion', label: 'Companion', icon: '◈' },
  { id: 'quests', label: 'Quests', icon: '◇' },
  { id: 'map', label: 'Map', icon: '⌖' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export class UI {
  private readonly menu: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly gamePanel: HTMLDivElement;
  private toastTimeout = 0;
  private panelCloseTimeout = 0;
  private selectedRace: Race = 'Human';
  private currentCharacter: CharacterData | null = null;
  private latestUpdate: GameUIState | null = null;
  private activePanel: GamePanelName | null = null;
  private panelTrigger: HTMLElement | null = null;
  private panelSnapshot = '';
  private menuTransitionTimeout = 0;
  private graphicsQuality: GraphicsQuality = 'high';
  private readonly buttons = new Map<string, HTMLButtonElement[]>();
  private readonly onRootClick = (event: MouseEvent): void => this.handleClick(event);
  private readonly onRootChange = (event: Event): void => this.handleChange(event);
  private readonly onRootPointerDown = (event: PointerEvent): void => this.handlePointerDown(event);
  private readonly onGlobalPointerEnd = (): void => {
    this.actions.setBlocking(false);
    this.actions.setSprinting(false);
  };
  private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.activePanel) {
      event.preventDefault();
      this.closePanel();
    } else if (event.key === 'Tab' && this.activePanel) {
      const focusable = [...this.gamePanel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  constructor(private readonly root: HTMLElement, private readonly actions: UIActions) {
    this.menu = document.createElement('div');
    this.menu.className = 'screen menu-screen';
    this.hud = document.createElement('div');
    this.hud.className = 'hud hidden';
    this.toast = document.createElement('div');
    this.toast.className = 'toast';
    this.gamePanel = document.createElement('div');
    this.gamePanel.className = 'game-panel-overlay hidden';
    root.append(this.menu, this.hud, this.toast, this.gamePanel);
    this.renderMenu(null);
    this.menu.classList.add('hidden');
    this.root.addEventListener('click', this.onRootClick);
    this.root.addEventListener('change', this.onRootChange);
    this.root.addEventListener('pointerdown', this.onRootPointerDown);
    window.addEventListener('pointerup', this.onGlobalPointerEnd);
    window.addEventListener('pointercancel', this.onGlobalPointerEnd);
    window.addEventListener('keydown', this.onGlobalKeyDown);
  }

  dispose(): void {
    window.clearTimeout(this.toastTimeout);
    window.clearTimeout(this.panelCloseTimeout);
    window.clearTimeout(this.menuTransitionTimeout);
    this.root.removeEventListener('click', this.onRootClick);
    this.root.removeEventListener('change', this.onRootChange);
    this.root.removeEventListener('pointerdown', this.onRootPointerDown);
    window.removeEventListener('pointerup', this.onGlobalPointerEnd);
    window.removeEventListener('pointercancel', this.onGlobalPointerEnd);
    window.removeEventListener('keydown', this.onGlobalKeyDown);
    this.actions.setBlocking(false);
    this.actions.setSprinting(false);
    this.menu.remove();
    this.hud.remove();
    this.toast.remove();
    this.gamePanel.remove();
    this.buttons.clear();
  }

  private renderMenu(save: CharacterData | null): void {
    this.menu.innerHTML = `
      <div class="menu-layout">
        <header class="menu-brand" aria-label="R.E.D. Realm of Eternal Dragons">
          <span class="brand-mark">R.E.D.</span><span class="brand-divider"></span>
          <span class="brand-name">REALM OF<br>ETERNAL DRAGONS</span>
        </header>
        <main class="menu-panel">
          <div class="eyebrow">A REALM ON THE EDGE OF MEMORY</div>
          <h1>THE FORGOTTEN<br><span>VALLEY</span></h1>
          <p class="menu-copy">Beyond the old frontier, an ancient power stirs beneath the mist.</p>
          ${save ? `<button class="continue-button" data-action="continue"><span class="continue-icon">↗</span><span><small>CONTINUE YOUR JOURNEY</small><strong>${this.escape(save.name)} <i>·</i> ${this.escape(save.race)}</strong></span><span class="continue-arrow">→</span></button>` : ''}
          <div class="section-heading"><span>01</span><span>CHOOSE YOUR HERITAGE</span><i></i></div>
          <div class="race-grid" role="group" aria-label="Choose a character race">
            ${(['Human', 'Elf', 'Dwarf', 'Beastkin'] as Race[]).map((race) => `
              <button type="button" class="race-card ${race === this.selectedRace ? 'selected' : ''}" data-race="${race}" aria-pressed="${race === this.selectedRace}">
                <span class="race-sigil" aria-hidden="true">${this.raceIcon(race)}</span><strong>${race}</strong>
                <small>${this.raceSummary(race)}</small>
              </button>`).join('')}
          </div>
          <section class="race-details" id="race-details" aria-live="polite"></section>
          <div class="creation-row">
            <label class="name-field" for="character-name"><span>02</span> NAME YOUR WAYFARER
              <input id="character-name" maxlength="20" value="Wayfarer" autocomplete="off" placeholder="Enter a name">
            </label>
            <button class="primary-button" data-action="start">Begin journey <span>→</span></button>
          </div>
          <div class="menu-footer"><span>THE FORGOTTEN VALLEY</span><span>LOCAL SAVE · SINGLE PLAYER</span></div>
        </main>
        <aside class="preview-caption" aria-live="polite">
          <span class="preview-kicker"><i></i> CHARACTER PREVIEW</span>
          <strong id="preview-race">HUMAN</strong>
          <small>SELECT A HERITAGE TO PREVIEW</small>
        </aside>
      </div>
    `;
    window.clearTimeout(this.menuTransitionTimeout);
    this.menu.classList.remove('hidden', 'is-leaving');
    this.renderRaceDetails();
    this.hud.classList.add('hidden');
  }

  private raceIcon(race: Race): string {
    return ({ Human: '✦', Elf: '⌁', Dwarf: '⬡', Beastkin: '❋' })[race];
  }

  private raceSummary(race: Race): string {
    return ({
      Human: 'Versatile',
      Elf: 'Arcane',
      Dwarf: 'Resolute',
      Beastkin: 'Untamed',
    })[race];
  }

  private renderRaceDetails(): void {
    const details = this.menu.querySelector<HTMLElement>('#race-details');
    const previewRace = this.menu.querySelector<HTMLElement>('#preview-race');
    if (!details || !previewRace) return;
    const attributes = RACE_ATTRIBUTES[this.selectedRace];
    const detailsByRace: Record<Race, { advantage: string; description: string }> = {
      Human: { advantage: 'Balanced · adaptable', description: 'A resourceful people, equally at home with blade, spell, or unfamiliar paths.' },
      Elf: { advantage: 'Agility · arcane insight', description: 'Keen senses and an old bond with magic lend grace to every encounter.' },
      Dwarf: { advantage: 'Health · strength · defense', description: 'Mountain-forged and steadfast, dwarves endure where others falter.' },
      Beastkin: { advantage: 'Agility · stamina', description: 'Instinct and an unyielding spirit make the wilds feel like home.' },
    };
    const selected = detailsByRace[this.selectedRace];
    const stats: Array<[string, number]> = [
      ['VITALITY', attributes.health],
      ['STAMINA', attributes.stamina],
      ['MANA', attributes.mana],
      ['STRENGTH', attributes.strength],
      ['AGILITY', attributes.agility],
      ['DEFENSE', attributes.defense],
    ];
    details.innerHTML = `
      <div class="race-description"><span>RACIAL ADVANTAGE</span><strong>${selected.advantage}</strong><p>${selected.description}</p></div>
      <div class="race-stats">${stats.map(([label, value]) => `
        <div class="race-stat"><span>${label}</span><div><i style="--stat:${Math.round((value / 150) * 100)}%"></i></div><b>${value}</b></div>`).join('')}
      </div>
    `;
    previewRace.textContent = this.selectedRace.toUpperCase();
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const panelTab = target.closest<HTMLButtonElement>('[data-panel-select]');
    if (panelTab) {
      this.openPanel(panelTab.dataset.panelSelect as GamePanelName);
      return;
    }

    const panelTrigger = target.closest<HTMLButtonElement>('[data-open-panel]');
    if (panelTrigger) {
      this.openPanel(panelTrigger.dataset.openPanel as GamePanelName, panelTrigger);
      return;
    }
    if (target.closest('[data-action="close-panel"]')) {
      this.closePanel();
      return;
    }
    if (event.target === this.gamePanel) {
      this.closePanel();
      return;
    }
    const raceButton = target.closest<HTMLButtonElement>('[data-race]');
    if (raceButton) {
      this.selectedRace = raceButton.dataset.race as Race;
      this.menu.querySelectorAll<HTMLButtonElement>('.race-card').forEach((card) => {
        const selected = card === raceButton;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
      });
      this.renderRaceDetails();
      this.actions.preview(this.selectedRace);
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    switch (action) {
      case 'start': {
        const name = this.menu.querySelector<HTMLInputElement>('#character-name')?.value.trim() || 'Wayfarer';
        this.actions.start(this.selectedRace, name);
        break;
      }
      case 'continue':
        this.actions.continue();
        break;
      case 'attack':
        this.actions.attack();
        break;
      case 'jump':
        this.actions.jump();
        break;
      case 'interact':
        this.actions.interact();
        break;
      case 'spirit':
        this.actions.spirit();
        break;
      case 'camera':
        this.actions.camera();
        break;
      case 'inventory':
        this.toggleInventory();
        break;
      case 'close-inventory':
      case 'close-panel':
        this.closePanel();
        break;
    }
  }

  private handleChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== 'graphics-quality') return;
    if (!isGraphicsQuality(target.value)) {
      target.value = this.graphicsQuality;
      return;
    }
    this.actions.setGraphicsQuality(target.value);
  }

  private handlePointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-action="block"]')) {
      event.preventDefault();
      this.actions.setBlocking(true);
    }
    if (target.closest('[data-action="sprint"]')) {
      event.preventDefault();
      this.actions.setSprinting(true);
    }
  }

  setSprintingReleased(): void {
    this.actions.setSprinting(false);
  }

  startGame(character: CharacterData): void {
    this.currentCharacter = character;
    this.menu.classList.add('is-leaving');
    window.clearTimeout(this.menuTransitionTimeout);
    this.menuTransitionTimeout = window.setTimeout(() => this.menu.classList.add('hidden'), 420);
    this.hud.classList.remove('hidden');
    this.renderHud();
  }

  showSavedCharacter(character: CharacterData | null): void {
    this.renderMenu(character);
    this.actions.preview(this.selectedRace);
  }

  private renderHud(): void {
    this.hud.innerHTML = `
      <header class="hud-header">
        <section class="player-status" aria-label="Player status">
          <div class="player-identity">
            <span class="identity-mark" aria-hidden="true">R</span>
            <span class="identity-copy"><b id="hud-name"></b><small><span id="hud-level"></span><i>·</i><span id="hud-race"></span></small></span>
          </div>
          <div class="status-list">
            <div class="status-row"><span class="status-icon health-icon" aria-hidden="true">♥</span><span class="status-label">HEALTH</span><div class="bar"><i id="health-bar" class="health-fill"></i></div><b id="health-value"></b></div>
            <div class="status-row"><span class="status-icon stamina-icon" aria-hidden="true">↯</span><span class="status-label">STAMINA</span><div class="bar"><i id="stamina-bar" class="stamina-fill"></i></div><b id="stamina-value"></b></div>
            <div class="status-row"><span class="status-icon mana-icon" aria-hidden="true">✧</span><span class="status-label">MANA</span><div class="bar"><i id="mana-bar" class="mana-fill"></i></div><b id="mana-value"></b></div>
          </div>
          <div class="xp-row"><span class="xp-label">XP</span><div class="bar"><i id="xp-bar" class="xp-fill"></i></div><b id="xp-value"></b></div>
        </section>
        <div class="hud-header-actions">
          <div class="companion-chip" id="companion-status"><span aria-hidden="true">◈</span><span>COMPANION <b id="companion-value">NONE</b></span></div>
          <div class="companion-chip tower-location"><span aria-hidden="true">⌂</span><span id="tower-location-value">THE ETERNAL SANCTUARY</span></div>
          <button type="button" class="hud-icon-button camera-button" data-action="camera" aria-label="Switch camera">
            <span class="hud-button-icon" aria-hidden="true">◉</span><span class="camera-label">THIRD PERSON</span>
          </button>
          <button type="button" class="hud-icon-button mobile-menu-button" data-open-panel="inventory" aria-label="Open game menu">
            <span class="hud-button-icon" aria-hidden="true">☰</span><span>MENU</span>
          </button>
        </div>
      </header>
      <nav class="hud-quickbar" aria-label="Game panels">
        <button type="button" data-open-panel="inventory"><span aria-hidden="true">▤</span><small>PACK</small></button>
        <button type="button" data-open-panel="equipment"><span aria-hidden="true">⚒</span><small>GEAR</small></button>
        <button type="button" data-open-panel="character"><span aria-hidden="true">♙</span><small>ATTRIBUTES</small></button>
        <button type="button" data-open-panel="companion"><span aria-hidden="true">◈</span><small>COMPANION</small></button>
        <button type="button" data-open-panel="quests"><span aria-hidden="true">◇</span><small>JOURNAL</small></button>
        <button type="button" data-open-panel="map"><span aria-hidden="true">⌖</span><small>MAP</small></button>
        <button type="button" data-open-panel="settings"><span aria-hidden="true">⚙</span><small>SETTINGS</small></button>
      </nav>
      <section id="boss-status" class="boss-status hidden" aria-live="polite">
        <div><span id="boss-name"></span><b id="boss-phase"></b></div>
        <div class="boss-health-track"><i id="boss-health-bar"></i></div>
        <small id="boss-model-status" class="boss-model-status"></small>
        <small id="boss-health-value"></small>
      </section>
      <div class="interaction-prompt" id="interaction-prompt" role="status" aria-live="polite"></div>
      <div class="desktop-hints"><span>WASD MOVE</span><span>SHIFT SPRINT</span><span>SPACE JUMP</span><span>CLICK ATTACK</span><span>E USE</span><span>Q SPIRIT</span></div>
      <div class="touch-controls">
        <div class="joystick" role="application" aria-label="Touch movement joystick"><span></span></div>
        <div class="touch-actions">
          <button type="button" data-action="camera" aria-label="Switch camera"><span aria-hidden="true">◉</span><small>CAM</small></button>
          <button type="button" data-action="jump" aria-label="Jump"><span aria-hidden="true">↑</span><small>JUMP</small></button>
          <button type="button" data-action="block" aria-label="Hold block"><span aria-hidden="true">⬡</span><small>BLOCK</small></button>
          <button type="button" data-action="spirit" aria-label="Use spirit ability"><span aria-hidden="true">✧</span><small>SPIRIT</small></button>
          <button type="button" data-action="attack" class="attack-button" aria-label="Attack"><span aria-hidden="true">⚔</span><small>ATTACK</small></button>
          <button type="button" data-action="interact" aria-label="Use or interact"><span aria-hidden="true">◇</span><small>USE</small></button>
          <button type="button" data-action="sprint" aria-label="Hold sprint"><span aria-hidden="true">»</span><small>RUN</small></button>
        </div>
      </div>
    `;
    this.buttons.clear();
    this.hud.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      if (!button.dataset.action) return;
      const buttons = this.buttons.get(button.dataset.action) ?? [];
      buttons.push(button);
      this.buttons.set(button.dataset.action, buttons);
    });
  }

  update(data: GameUIState): void {
    this.currentCharacter = data.character;
    this.latestUpdate = data;
    this.graphicsQuality = data.graphicsQuality;
    const setText = (selector: string, value: string): void => {
      const element = this.hud.querySelector<HTMLElement>(selector);
      if (element) element.textContent = value;
    };
    const setBar = (selector: string, value: number, max: number): void => {
      const element = this.hud.querySelector<HTMLElement>(selector);
      if (element) element.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
    };
    setText('#hud-name', data.character.name);
    setText('#hud-level', `LEVEL ${data.character.level}`);
    setText('#hud-race', data.character.race.toUpperCase());
    setText('#health-value', `${Math.ceil(data.health)} / ${data.character.attributes.health}`);
    setText('#stamina-value', `${Math.ceil(data.stamina)} / ${data.character.attributes.stamina}`);
    setText('#mana-value', `${Math.ceil(data.mana)} / ${data.character.attributes.mana}`);
    const xpRequired = 100 + (data.character.level - 1) * 75;
    setText('#xp-value', `${data.character.xp} / ${xpRequired}`);
    setBar('#health-bar', data.health, data.character.attributes.health);
    setBar('#stamina-bar', data.stamina, data.character.attributes.stamina);
    setBar('#mana-bar', data.mana, data.character.attributes.mana);
    setBar('#xp-bar', data.character.xp, xpRequired);
    setText('#interaction-prompt', data.prompt);
    setText('#companion-value', data.companion ? `WOLF · ${Math.ceil(data.companion.health)} HP` : 'NONE');
    const locationLabels: Record<GameLocation, string> = {
      hub: 'THE ETERNAL SANCTUARY',
      floor1: 'FLOOR 1 · FORSAKEN WILDS',
      floor2: 'FLOOR 2 · ASHEN SANCTUARY',
      floor3: "FLOOR 3 · DRAGON'S THRONE",
    };
    setText('#tower-location-value', locationLabels[data.location]);
    const bossStatus = this.hud.querySelector<HTMLElement>('#boss-status');
    bossStatus?.classList.toggle('hidden', !data.boss);
    if (data.boss) {
      setText('#boss-name', data.boss.name);
      setText('#boss-phase', `PHASE ${data.boss.phase}`);
      setText('#boss-model-status', data.boss.visualStatus);
      setText('#boss-health-value', `${Math.ceil(data.boss.health)} / ${data.boss.maxHealth}`);
      setBar('#boss-health-bar', data.boss.health, data.boss.maxHealth);
    }
    for (const cameraButton of this.buttons.get('camera') ?? []) {
      cameraButton.title = data.camera === 'first-person' ? 'First person · V' : 'Third person · V';
      const label = cameraButton.querySelector<HTMLElement>('.camera-label');
      if (label) label.textContent = `V · ${data.camera === 'first-person' ? 'FIRST PERSON' : 'THIRD PERSON'}`;
    }
    for (const spiritButton of this.buttons.get('spirit') ?? []) {
      const spiritLabel = spiritButton.querySelector<HTMLElement>('small');
      if (spiritLabel) spiritLabel.textContent = data.spiritActive ? 'DISMISS' : data.spiritCooldown > 0 ? `${Math.ceil(data.spiritCooldown)}s` : 'SPIRIT';
    }
    if (this.activePanel) this.refreshPanelIfChanged();
  }

  toggleInventory(): void {
    if (!this.currentCharacter) return;
    if (this.activePanel === 'inventory') this.closePanel();
    else this.openPanel('inventory');
  }

  private openPanel(name: GamePanelName, trigger: HTMLElement | null = null): void {
    if (this.activePanel === name && !this.gamePanel.classList.contains('hidden')) {
      this.closePanel();
      return;
    }
    window.clearTimeout(this.panelCloseTimeout);
    const opening = this.gamePanel.classList.contains('hidden');
    if (opening) {
      this.panelTrigger = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      this.gamePanel.innerHTML = `
        <section class="game-panel" role="dialog" aria-modal="true" aria-labelledby="game-panel-title">
          <header class="game-panel-header">
            <div><span>WAYFARER'S JOURNAL</span><h2 id="game-panel-title"></h2></div>
            <button type="button" class="close-button" data-action="close-panel" aria-label="Close panel">×</button>
          </header>
          <nav class="game-panel-tabs" role="tablist" aria-label="Game panels">
            ${GAME_PANELS.map((panel) => `
                <button type="button" role="tab" id="panel-tab-${panel.id}" class="game-panel-tab" data-panel-select="${panel.id}" aria-controls="game-panel-body" aria-selected="false">
                <span aria-hidden="true">${panel.icon}</span><small>${panel.label}</small>
              </button>`).join('')}
          </nav>
            <div class="game-panel-body" id="game-panel-body" role="tabpanel"></div>
        </section>
      `;
      this.gamePanel.classList.remove('hidden', 'is-closing');
    } else if (!this.activePanel) {
      this.panelTrigger = trigger;
      this.gamePanel.classList.remove('is-closing');
    }
    this.activePanel = name;
    const definition = GAME_PANELS.find((panel) => panel.id === name);
    this.gamePanel.querySelector<HTMLElement>('#game-panel-title')!.textContent = definition?.label ?? 'Journal';
    this.gamePanel.querySelectorAll<HTMLButtonElement>('.game-panel-tab').forEach((tab) => {
      const selected = tab.dataset.panelSelect === name;
      tab.classList.toggle('selected', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    this.gamePanel.querySelector<HTMLElement>('#game-panel-body')?.setAttribute('aria-labelledby', `panel-tab-${name}`);
    this.panelSnapshot = '';
    this.renderPanelContent();
    if (opening) this.gamePanel.querySelector<HTMLButtonElement>('[data-action="close-panel"]')?.focus();
  }

  private closePanel(): void {
    if (!this.activePanel) return;
    this.activePanel = null;
    this.gamePanel.classList.add('is-closing');
    window.clearTimeout(this.panelCloseTimeout);
    this.panelCloseTimeout = window.setTimeout(() => {
      this.gamePanel.classList.add('hidden');
      this.gamePanel.classList.remove('is-closing');
    }, 220);
    this.panelTrigger?.focus();
    this.panelTrigger = null;
  }

  private refreshPanelIfChanged(): void {
    const character = this.currentCharacter;
    if (!character) return;
    const update = this.latestUpdate;
    const panelState = this.activePanel === 'character'
      ? update ? [Math.ceil(update.health), Math.ceil(update.stamina), Math.ceil(update.mana)] : []
      : this.activePanel === 'quests'
        ? [update?.prompt, update?.landmarks.map(({ name, discovered }) => [name, discovered]), update?.tower]
        : this.activePanel === 'map'
          ? [update?.landmarks.map(({ name, discovered }) => [name, discovered])]
          : this.activePanel === 'companion'
            ? [update?.companion ? [update.companion.kind, update.companion.health] : null]
            : this.activePanel === 'settings'
              ? [update?.graphicsQuality]
              : [];
    const snapshot = JSON.stringify([
      character.level,
      character.xp,
      character.attributes,
      character.inventory,
      character.equipment,
      character.companions,
      character.discoveredLocations,
      panelState,
    ]);
    if (snapshot === this.panelSnapshot) return;
    this.panelSnapshot = snapshot;
    this.renderPanelContent();
  }

  private renderPanelContent(): void {
    const body = this.gamePanel.querySelector<HTMLElement>('#game-panel-body');
    const character = this.currentCharacter;
    if (!body || !character || !this.activePanel) return;
    const update = this.latestUpdate;
    const itemList = (items: string[], emptyText: string, equipped: string[] = [], rowLabel = 'ITEM'): string => items.length
      ? `<div class="panel-list">${items.map((item) => `<div class="panel-list-row"><span class="panel-item-icon" aria-hidden="true">◇</span><span>${this.escape(item)}</span><small>${equipped.includes(item) ? 'EQUIPPED' : rowLabel}</small></div>`).join('')}</div>`
      : `<p class="panel-empty">${emptyText}</p>`;
    const content: Record<GamePanelName, string> = {
      inventory: `
        <div class="panel-intro"><span>THE WAYFARER'S PACK</span><p>Items gathered on your journey through the valley.</p></div>
        ${itemList(character.inventory, 'Your pack is empty.', character.equipment)}
      `,
      equipment: `
        <div class="panel-intro"><span>WORN AND READY</span><p>Equipment currently carried by ${this.escape(character.name)}.</p></div>
        ${itemList(character.equipment, 'No equipment is worn.', character.equipment)}
        <p class="panel-note">Equipment management is not available in this chapter.</p>
      `,
      character: `
        <div class="panel-intro"><span>LEVEL ${character.level} · ${this.escape(character.race.toUpperCase())}</span><p>${this.escape(character.name)}'s attributes and current condition.</p></div>
        <div class="attribute-grid">
          ${([
            ['HEALTH', update?.health ?? character.attributes.health, character.attributes.health],
            ['STAMINA', update?.stamina ?? character.attributes.stamina, character.attributes.stamina],
            ['MANA', update?.mana ?? character.attributes.mana, character.attributes.mana],
            ['STRENGTH', character.attributes.strength, 20],
            ['AGILITY', character.attributes.agility, 20],
            ['INTELLIGENCE', character.attributes.intelligence, 20],
            ['DEFENSE', character.attributes.defense, 20],
          ] as Array<[string, number, number]>).map(([label, value, max]) => `
            <div class="attribute-card"><span>${label}</span><strong>${Math.ceil(value)}<small>${label === 'HEALTH' || label === 'STAMINA' || label === 'MANA' ? ` / ${max}` : ''}</small></strong>
              <div class="attribute-meter"><i style="--meter:${Math.max(0, Math.min(100, (value / max) * 100))}%"></i></div>
            </div>`).join('')}
        </div>
        <div class="panel-xp">EXPERIENCE <b>${character.xp} / ${100 + (character.level - 1) * 75} XP</b></div>
      `,
      companion: update?.companion
        ? `<div class="companion-detail"><span class="companion-emblem" aria-hidden="true">◈</span><div><span>TRAVELING COMPANION</span><h3>${this.escape(update.companion.kind.toUpperCase())}</h3><p>${Math.ceil(update.companion.health)} HP · Following your path</p></div></div>`
        : `<div class="panel-empty-state"><span aria-hidden="true">◈</span><h3>No companion nearby</h3><p>Weakened wolves may be befriended in the valley. Your companion status will appear here.</p><small>COMPANIONS · ${character.companions}</small></div>`,
      quests: `
        <div class="panel-intro"><span>TOWER PROGRESSION</span><p>${update?.prompt ? this.escape(update.prompt) : 'Travel between the sanctuary and the unlocked floors.'}</p></div>
        ${update ? `<div class="tower-progress-list">${[
          ['ancient-wolf', 'Floor 1 · Ancient Wolf'],
          ['eternal-phoenix', 'Floor 2 · Eternal Phoenix'],
          ['eternal-dragon', "Floor 3 · Eternal Dragon"],
        ].map(([boss, label], index) => {
          const floor = index + 1;
          const defeated = update.tower.defeatedBosses.includes(boss);
          const unlocked = update.tower.unlockedFloors.includes(floor);
          return `<div class="panel-list-row"><span class="panel-item-icon" aria-hidden="true">${defeated ? '◆' : '◇'}</span><span>${label}</span><small>${defeated ? 'DEFEATED' : unlocked ? 'UNLOCKED' : 'SEALED'}</small></div>`;
        }).join('')}</div>` : ''}
        <div class="journal-progress"><span>LANDMARKS DISCOVERED</span><b>${update?.landmarks.filter((landmark) => landmark.discovered).length ?? character.discoveredLocations.length} / ${update?.landmarks.length ?? 4}</b></div>
        ${itemList((update?.landmarks ?? []).map(({ name, discovered }) => `${discovered ? 'Discovered · ' : 'Unexplored · '}${name}`), 'Your journey into the valley has begun.', [], 'LANDMARK')}
      `,
      map: `
        <div class="panel-intro"><span>THE FORGOTTEN VALLEY</span><p>Known paths and landmarks. Continue exploring to reveal more.</p></div>
        <div class="map-board" role="img" aria-label="Map of discovered and undiscovered valley landmarks">
          <span class="map-compass">N</span><span class="map-river" aria-hidden="true"></span>
          ${(update?.landmarks ?? []).map((landmark) => {
            const x = Math.round(((landmark.x + 35) / 70) * 100);
            const y = Math.round(((landmark.z + 35) / 70) * 100);
            return `<span class="map-pin ${landmark.discovered ? 'discovered' : ''}" style="--map-x:${x}%;--map-y:${y}%" title="${this.escape(landmark.name)}">${landmark.discovered ? '◆' : '◇'}</span>`;
          }).join('')}
        </div>
        ${itemList((update?.landmarks ?? []).map(({ name, discovered }) => `${discovered ? '◆ ' : '◇ '}${name}`), 'The map will fill in as you explore.', [], 'LOCATION')}
      `,
      settings: `
        <div class="panel-intro"><span>YOUR ADVENTURE</span><p>Controls and current interface settings.</p></div>
        <div class="settings-list">
          <div><span>MOVE</span><b>W A S D · TOUCH JOYSTICK</b></div>
          <div><span>LOOK</span><b>MOUSE DRAG · TOUCH DRAG</b></div>
          <div><span>ACTIONS</span><b>SPACE / JUMP · B / BLOCK · SHIFT / SPRINT</b></div>
          <div><span>COMBAT</span><b>CLICK / ATTACK · E / USE</b></div>
          <div><span>SPIRIT</span><b>Q / SPIRIT · I / PACK</b></div>
          <div><span>CAMERA</span><button type="button" data-action="camera">SWITCH VIEW · V</button></div>
          <label class="graphics-setting" for="graphics-quality"><span>GRAPHICS QUALITY</span>
            <select id="graphics-quality" name="graphics-quality">
              ${(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((quality) => `
                <option value="${quality}" ${quality === this.graphicsQuality ? 'selected' : ''}>${quality.toUpperCase()}</option>
              `).join('')}
            </select>
          </label>
          <p class="panel-note">Quality changes apply immediately. Anti-aliasing follows the device profile chosen at startup.</p>
          <div><span>SAVE</span><b>LOCAL · AUTOMATIC</b></div>
        </div>
      `,
    };
    body.innerHTML = content[this.activePanel];
  }

  toastMessage(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => this.toast.classList.remove('visible'), 2600);
  }

  private escape(text: string): string {
    return text.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] ?? character);
  }
}
