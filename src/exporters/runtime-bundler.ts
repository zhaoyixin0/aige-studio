import type { GameConfig, ModuleConfig } from '@/engine/core';

/**
 * Generates minimal standalone JavaScript runtime code for an exported game.
 * Uses Canvas 2D API only — no external dependencies.
 */
export class RuntimeBundler {
  /**
   * Generate standalone JS runtime code for the given config.
   * Returns a self-contained IIFE string.
   */
  bundle(config: GameConfig): string {
    const enabledModules = config.modules.filter(m => m.enabled);
    const moduleTypes = [...new Set(enabledModules.map(m => m.type))];

    return `
(function() {
  'use strict';

  // Embedded config
  var CONFIG = ${JSON.stringify(config)};

  // --- Mini EventBus ---
  var bus = {
    _h: {},
    on: function(e, f) {
      if (!this._h[e]) this._h[e] = [];
      this._h[e].push(f);
    },
    emit: function(e, d) {
      var self = this;
      if (self._h[e]) self._h[e].forEach(function(f){ f(d); });
      // wildcard support: listeners on 'touch:*' fire for 'touch:tap' etc.
      for (var k in self._h) {
        if (k.endsWith(':*') && e.startsWith(k.slice(0, -1))) {
          self._h[k].forEach(function(f){ f(d); });
        }
      }
    }
  };

  // --- Canvas setup ---
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;

  // --- Game state ---
  var score = 0;
  var timeLeft = ${this.getTimerDuration(enabledModules)};
  var lives = ${this.getLivesCount(enabledModules)};
  var objects = [];
  var gameState = 'playing';
  var lastTime = performance.now();
  var bgColor = CONFIG.canvas.background || '#222';

  // --- HUD config ---
  var hudFontSize = Math.round(W * 0.04);
  var hudPadding = Math.round(W * 0.03);

  ${this.generateModuleRuntime(moduleTypes, enabledModules)}

  // --- Update ---
  function update(dt) {
    ${this.generateUpdateCode(moduleTypes, enabledModules)}

    // Move objects
    for (var i = objects.length - 1; i >= 0; i--) {
      var obj = objects[i];
      obj.x += (obj.vx || 0) * dt / 1000;
      obj.y += (obj.vy || 0) * dt / 1000;

      // Remove objects that leave the canvas
      if (obj.y > H + obj.r || obj.y < -obj.r || obj.x > W + obj.r || obj.x < -obj.r) {
        objects.splice(i, 1);
      }
    }
  }

  // --- Render ---
  function render() {
    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Draw objects
    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.r || 30, 0, Math.PI * 2);
      ctx.fillStyle = obj.color || '#ff6b6b';
      ctx.fill();
      ctx.closePath();

      // Draw label if present
      if (obj.label) {
        ctx.fillStyle = '#fff';
        ctx.font = Math.round((obj.r || 30) * 0.7) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.label, obj.x, obj.y);
      }
    }

    // Draw HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + hudFontSize + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Score: ' + score, hudPadding, hudPadding);

    ${moduleTypes.includes('Timer') ? `
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(timeLeft) + 's', W / 2, hudPadding);
    ` : ''}

    ${moduleTypes.includes('Lives') ? `
    ctx.textAlign = 'right';
    ctx.fillText('Lives: ' + lives, W - hudPadding, hudPadding);
    ` : ''}

    // Game over overlay
    if (gameState === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(W * 0.08) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Game Over', W / 2, H / 2 - W * 0.06);
      ctx.font = Math.round(W * 0.05) + 'px sans-serif';
      ctx.fillText('Score: ' + score, W / 2, H / 2 + W * 0.03);
      ctx.font = Math.round(W * 0.03) + 'px sans-serif';
      ctx.fillText('Tap to restart', W / 2, H / 2 + W * 0.1);
    }
  }

  // --- Game loop ---
  function gameLoop(now) {
    if (gameState !== 'playing') {
      render();
      return;
    }
    var dt = now - lastTime;
    lastTime = now;

    // Clamp delta to avoid huge jumps (e.g. tab-switch)
    if (dt > 200) dt = 16;

    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  // --- Touch / click input ---
  canvas.addEventListener('pointerdown', function(e) {
    if (gameState === 'over') {
      // Restart
      score = 0;
      timeLeft = ${this.getTimerDuration(enabledModules)};
      lives = ${this.getLivesCount(enabledModules)};
      objects = [];
      gameState = 'playing';
      lastTime = performance.now();
      requestAnimationFrame(gameLoop);
      return;
    }

    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * W;
    var y = (e.clientY - rect.top) / rect.height * H;
    bus.emit('touch:tap', { x: x, y: y });

    // Hit-test objects
    for (var i = objects.length - 1; i >= 0; i--) {
      var obj = objects[i];
      var dx = x - obj.x;
      var dy = y - obj.y;
      if (dx * dx + dy * dy < (obj.r || 30) * (obj.r || 30)) {
        bus.emit('object:hit', { index: i, obj: obj });
        objects.splice(i, 1);
        break;
      }
    }
  });

  // --- Event wiring ---
  bus.on('object:hit', function(data) {
    ${this.generateHitHandler(moduleTypes, enabledModules)}
  });

  bus.on('game:over', function() {
    gameState = 'over';
  });

  // Start
  requestAnimationFrame(gameLoop);
})();`;
  }

  /** Extract timer duration from enabled modules, default 30s. */
  getTimerDuration(modules: ModuleConfig[]): number {
    const timer = modules.find(m => m.type === 'Timer' && m.enabled);
    if (timer?.params?.duration != null) return timer.params.duration as number;
    return 30;
  }

  /** Extract lives count from enabled modules, default 3. */
  getLivesCount(modules: ModuleConfig[]): number {
    const livesModule = modules.find(m => m.type === 'Lives' && m.enabled);
    if (livesModule?.params?.count != null) return livesModule.params.count as number;
    return 3;
  }

  /** Generate module-specific runtime code (spawner logic, etc.) */
  private generateModuleRuntime(moduleTypes: string[], enabledModules: ModuleConfig[]): string {
    const parts: string[] = [];

    if (moduleTypes.includes('Spawner')) {
      const spawner = enabledModules.find(m => m.type === 'Spawner');
      const interval = (spawner?.params?.interval as number) ?? 1000;
      const radius = (spawner?.params?.radius as number) ?? 30;
      const speed = (spawner?.params?.speed as number) ?? 200;
      const colors = '["#ff6b6b","#ffa502","#2ed573","#1e90ff","#a55eea","#fd79a8"]';

      parts.push(`
  // --- Spawner ---
  var spawnInterval = ${interval};
  var spawnTimer = 0;
  var spawnRadius = ${radius};
  var spawnSpeed = ${speed};
  var spawnColors = ${colors};
  function spawnObject() {
    var color = spawnColors[Math.floor(Math.random() * spawnColors.length)];
    objects.push({
      x: Math.random() * (W - spawnRadius * 2) + spawnRadius,
      y: -spawnRadius,
      r: spawnRadius,
      vy: spawnSpeed,
      vx: (Math.random() - 0.5) * 60,
      color: color,
      label: ''
    });
  }
`);
    }

    return parts.join('\n');
  }

  /** Generate per-frame update code. */
  private generateUpdateCode(moduleTypes: string[], _enabledModules: ModuleConfig[]): string {
    const parts: string[] = [];

    if (moduleTypes.includes('Timer')) {
      parts.push(`
    // Timer countdown
    timeLeft -= dt / 1000;
    if (timeLeft <= 0) {
      timeLeft = 0;
      bus.emit('game:over', { reason: 'time' });
    }`);
    }

    if (moduleTypes.includes('Spawner')) {
      parts.push(`
    // Spawn logic
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      spawnObject();
    }`);
    }

    return parts.join('\n');
  }

  /** Generate object-hit event handler code. */
  private generateHitHandler(moduleTypes: string[], enabledModules: ModuleConfig[]): string {
    const parts: string[] = [];

    if (moduleTypes.includes('Scorer')) {
      const scorer = enabledModules.find(m => m.type === 'Scorer');
      const points = (scorer?.params?.pointsPerHit as number) ?? 10;
      parts.push(`    score += ${points};`);
    }

    return parts.join('\n');
  }
}
