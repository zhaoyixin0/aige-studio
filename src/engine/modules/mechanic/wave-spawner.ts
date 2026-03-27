import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class WaveSpawner extends BaseModule {
  readonly type = 'WaveSpawner';

  private currentWave = 0;
  private enemiesRemaining = 0;
  private spawnedInWave = 0;
  private spawnTimer = 0;
  private cooldownTimer = 0;
  protected waveActive = false;
  private inCooldown = false;
  private currentWaveEnemyCount = 0;
  private nextSpawnId = 0;

  getSchema(): ModuleSchema {
    return {
      enemiesPerWave: { type: 'range', label: 'Enemies Per Wave', default: 5, min: 1, max: 50 },
      waveCooldown: { type: 'range', label: 'Wave Cooldown (ms)', default: 3000, min: 1000, max: 10000, unit: 'ms' },
      spawnDelay: { type: 'range', label: 'Spawn Delay (ms)', default: 500, min: 100, max: 2000, unit: 'ms' },
      scalingFactor: { type: 'range', label: 'Scaling Factor', default: 1.2, min: 1.0, max: 2.0, step: 0.1 },
      maxWaves: { type: 'range', label: 'Max Waves (0=infinite)', default: 0, min: 0, max: 100 },
      spawnAreaX: { type: 'range', label: 'Spawn Area X', default: 0, min: 0, max: 2000 },
      spawnAreaWidth: { type: 'range', label: 'Spawn Area Width', default: 800, min: 100, max: 2000 },
      spawnY: { type: 'range', label: 'Spawn Y', default: 0, min: 0, max: 2000 },
      enemyCollisionRadius: { type: 'range', label: 'Enemy Collision Radius', default: 24, min: 8, max: 100 },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    // Override base resume handler to also start the first wave
    this.on('gameflow:resume', () => {
      if (this.currentWave === 0) {
        this.startNextWave();
      }
    });

    this.on('enemy:death', () => {
      if (!this.waveActive) return;
      this.enemiesRemaining = Math.max(0, this.enemiesRemaining - 1);
      if (this.enemiesRemaining === 0 && this.spawnedInWave >= this.currentWaveEnemyCount) {
        this.completeWave();
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    if (this.inCooldown) {
      this.cooldownTimer += dt;
      const waveCooldown = (this.params.waveCooldown as number) ?? 3000;
      if (this.cooldownTimer >= waveCooldown) {
        this.cooldownTimer = 0;
        this.inCooldown = false;
        this.startNextWave();
      }
      return;
    }

    if (!this.waveActive) return;

    const spawnDelay = (this.params.spawnDelay as number) ?? 500;

    if (this.spawnedInWave < this.currentWaveEnemyCount) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= spawnDelay) {
        this.spawnTimer -= spawnDelay;
        this.spawnEnemy();
      }
    }
  }

  startNextWave(): void {
    const maxWaves = (this.params.maxWaves as number) ?? 0;
    if (maxWaves > 0 && this.currentWave >= maxWaves) return;

    this.currentWave += 1;
    this.spawnedInWave = 0;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.inCooldown = false;

    const baseCount = (this.params.enemiesPerWave as number) ?? 5;
    const scaling = (this.params.scalingFactor as number) ?? 1.2;
    this.currentWaveEnemyCount =
      this.currentWave === 1
        ? baseCount
        : Math.ceil(baseCount * Math.pow(scaling, this.currentWave - 1));
    this.enemiesRemaining = this.currentWaveEnemyCount;

    this.emit('wave:start', { wave: this.currentWave, enemyCount: this.currentWaveEnemyCount });
  }

  private spawnEnemy(): void {
    const x =
      (this.params.spawnAreaX as number) +
      Math.random() * (this.params.spawnAreaWidth as number ?? 800);
    const y = (this.params.spawnY as number) ?? 0;
    const id = `wave-enemy-${++this.nextSpawnId}`;

    this.spawnedInWave += 1;
    this.emit('wave:spawn', { id, x, y, wave: this.currentWave });
  }

  private completeWave(): void {
    this.waveActive = false;
    this.emit('wave:complete', { wave: this.currentWave });

    const maxWaves = (this.params.maxWaves as number) ?? 0;
    if (maxWaves > 0 && this.currentWave >= maxWaves) {
      this.emit('wave:allComplete', { totalWaves: this.currentWave });
      return;
    }

    this.inCooldown = true;
    this.cooldownTimer = 0;
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  getEnemiesRemaining(): number {
    return this.enemiesRemaining;
  }

  reset(): void {
    this.currentWave = 0;
    this.enemiesRemaining = 0;
    this.spawnedInWave = 0;
    this.spawnTimer = 0;
    this.cooldownTimer = 0;
    this.waveActive = false;
    this.inCooldown = false;
    this.currentWaveEnemyCount = 0;
    this.nextSpawnId = 0;
  }
}
