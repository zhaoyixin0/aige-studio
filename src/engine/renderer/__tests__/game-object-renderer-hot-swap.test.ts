import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container, Text } from 'pixi.js';
import { GameObjectRenderer } from '../game-object-renderer';

/**
 * Tests for GameObjectRenderer.applyAssetUpdate (Phase D3 of asset-streaming).
 *
 * When AssetAgent streams a freshly fulfilled sprite, the renderer must swap
 * the texture of any live sprite referencing that asset key WITHOUT recreating
 * the wrapper container (to preserve x/y/rotation/physics state).
 */

/**
 * Create a synthetic wrapper sprite and register it in the renderer's internal
 * sprite map with a known asset key. This simulates what syncSpawnedObjects()
 * would have produced. We bypass sync() because sync() requires a full Engine.
 */
function registerFakeSprite(
  renderer: GameObjectRenderer,
  spriteId: string,
  assetKey: string,
  child: Container,
  x = 100,
  y = 200,
  rotation = 0.5,
): Container {
  const wrapper = new Container();
  wrapper.x = x;
  wrapper.y = y;
  wrapper.rotation = rotation;
  wrapper.addChild(child);

  const rAny = renderer as any;
  (rAny.container as Container).addChild(wrapper);
  (rAny.sprites as Map<string, Container>).set(spriteId, wrapper);
  // applyAssetUpdate reads spriteAssetKeys map (populated by sync() in production).
  (rAny.spriteAssetKeys as Map<string, string>).set(spriteId, assetKey);
  return wrapper;
}

describe('GameObjectRenderer.applyAssetUpdate', () => {
  let container: Container;
  let renderer: GameObjectRenderer;

  beforeEach(() => {
    container = new Container();
    renderer = new GameObjectRenderer(container);
  });

  it('is a no-op when key is unknown', () => {
    // No sprites registered
    expect(() =>
      renderer.applyAssetUpdate('ghost_key', 'data:image/png;base64,XXX'),
    ).not.toThrow();
    expect((renderer as any).sprites.size).toBe(0);
  });

  it('replaces the inner child of a matching sprite wrapper', () => {
    const initialChild = new Container();
    const wrapper = registerFakeSprite(renderer, 'spawn_1', 'good_1', initialChild);
    expect(wrapper.children.length).toBe(1);
    expect(wrapper.children[0]).toBe(initialChild);

    renderer.applyAssetUpdate('good_1', 'data:image/png;base64,NEWSRC');

    // Wrapper container is the SAME instance (not recreated)
    expect((renderer as any).sprites.get('spawn_1')).toBe(wrapper);
    // Old inner child replaced with a new container (the createSpriteFromDataUrl wrapper)
    expect(wrapper.children.length).toBeGreaterThanOrEqual(1);
    expect(wrapper.children[0]).not.toBe(initialChild);
  });

  it('replaces an emoji Text fallback with an image wrapper', () => {
    const emojiText = new Text({ text: '🍎' });
    emojiText.anchor.set(0.5);
    const wrapper = registerFakeSprite(renderer, 'spawn_2', 'good_1', emojiText);

    renderer.applyAssetUpdate('good_1', 'data:image/png;base64,NEWSRC');

    // The emoji text is no longer in the wrapper
    expect(wrapper.children).not.toContain(emojiText);
    // Wrapper still has a child (the new sprite container)
    expect(wrapper.children.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves container x, y, rotation after swap', () => {
    const initialChild = new Container();
    const wrapper = registerFakeSprite(
      renderer,
      'spawn_3',
      'good_1',
      initialChild,
      333, // x
      777, // y
      1.25, // rotation
    );

    renderer.applyAssetUpdate('good_1', 'data:image/png;base64,NEWSRC');

    expect(wrapper.x).toBe(333);
    expect(wrapper.y).toBe(777);
    expect(wrapper.rotation).toBe(1.25);
  });

  it('only affects sprites matching the key (independent updates)', () => {
    const child1 = new Container();
    const child2 = new Container();
    const wrapper1 = registerFakeSprite(renderer, 'spawn_A', 'good_1', child1);
    const wrapper2 = registerFakeSprite(renderer, 'spawn_B', 'bad_1', child2);

    renderer.applyAssetUpdate('good_1', 'data:image/png;base64,A');

    // wrapper1's child should be swapped
    expect(wrapper1.children[0]).not.toBe(child1);
    // wrapper2's child should NOT be touched
    expect(wrapper2.children[0]).toBe(child2);
  });

  it('swaps player sprite when key is "player"', () => {
    const rAny = renderer as any;
    const playerContainer = new Container();
    playerContainer.x = 540;
    playerContainer.y = 1600;
    const initialChild = new Container();
    playerContainer.addChild(initialChild);
    container.addChild(playerContainer);
    rAny.playerSprite = playerContainer;
    // Player's asset key convention
    rAny.playerAssetKey = 'player';

    renderer.applyAssetUpdate('player', 'data:image/png;base64,PLAYER');

    // Player sprite reference preserved (no destroy)
    expect(rAny.playerSprite).toBe(playerContainer);
    // Position preserved
    expect(playerContainer.x).toBe(540);
    expect(playerContainer.y).toBe(1600);
    // Old child replaced
    expect(playerContainer.children[0]).not.toBe(initialChild);
  });

  it('invalidates texture cache entries so future creates use fresh dataUrl', () => {
    const rAny = renderer as any;
    // Prime the cache with a stale entry keyed by OLD dataUrl
    // (in production this would be the previous src mapped to an old Texture)
    const fakeTexture = { destroy: vi.fn() } as any;
    (rAny.textureCache as Map<string, any>).set('data:image/png;base64,OLD', fakeTexture);
    // Register the asset key so applyAssetUpdate knows which cache entries to drop
    (rAny.assetKeyToSrc as Map<string, string>).set('good_1', 'data:image/png;base64,OLD');

    renderer.applyAssetUpdate('good_1', 'data:image/png;base64,NEW');

    // Old cache entry should be cleared
    expect((rAny.textureCache as Map<string, any>).has('data:image/png;base64,OLD')).toBe(false);
    // And the old texture destroyed
    expect(fakeTexture.destroy).toHaveBeenCalled();
  });

  it('updates assetKeyToSrc mapping after swap', () => {
    const child = new Container();
    registerFakeSprite(renderer, 'spawn_1', 'good_1', child);

    renderer.applyAssetUpdate('good_1', 'data:image/png;base64,NEW');

    expect((renderer as any).assetKeyToSrc.get('good_1')).toBe('data:image/png;base64,NEW');
  });
});
