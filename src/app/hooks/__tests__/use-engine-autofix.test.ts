import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factories run
const {
  mockEngineRestart,
  mockEngineStart,
  mockLoaderLoad,
  mockSetValidationReport,
  mockRendererConnectToEngine,
  mockValidateConfig,
  mockApplyFixes,
  mockContracts,
} = vi.hoisted(() => {
  const mockContracts = { _isMockContracts: true };
  return {
    mockEngineRestart: vi.fn(),
    mockEngineStart: vi.fn(),
    mockLoaderLoad: vi.fn(),
    mockSetValidationReport: vi.fn(),
    mockRendererConnectToEngine: vi.fn(),
    mockValidateConfig: vi.fn(),
    mockApplyFixes: vi.fn(),
    mockContracts,
  };
});

// ── Module mocks (hoisted automatically by Vitest) ──

vi.mock('@/engine/core/engine', () => ({
  Engine: vi.fn(function () {
    return {
      restart: mockEngineRestart,
      start: mockEngineStart,
      getConfig: vi.fn(),
      getModule: vi.fn(),
    };
  }),
}));

vi.mock('@/engine/core/config-loader', () => ({
  ConfigLoader: vi.fn(function () {
    return {
      load: mockLoaderLoad,
      getLastValidationReport: vi.fn().mockReturnValue(null),
    };
  }),
}));

vi.mock('@/engine/renderer/pixi-renderer', () => ({
  PixiRenderer: vi.fn(function () {
    return {
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      connectToEngine: mockRendererConnectToEngine,
    };
  }),
}));

vi.mock('@/engine/module-setup', () => ({
  createModuleRegistry: vi.fn().mockReturnValue({ _isMockRegistry: true }),
}));

vi.mock('@/engine/core/contract-registry', () => ({
  ContractRegistry: {
    fromRegistry: vi.fn().mockReturnValue(mockContracts),
  },
}));

vi.mock('@/engine/core/config-validator', () => ({
  validateConfig: (...args: unknown[]) => mockValidateConfig(...args),
  applyFixes: (...args: unknown[]) => mockApplyFixes(...args),
}));

vi.mock('@/store/editor-store', () => ({
  useEditorStore: {
    getState: vi.fn().mockReturnValue({
      setValidationReport: mockSetValidationReport,
    }),
  },
}));

vi.mock('@/engine/diagnostics', () => ({
  EventRecorder: vi.fn(),
  ModuleDiagnostics: { diagnose: vi.fn(), formatReport: vi.fn() },
}));

// ── Imports after mocks ──
import { renderHook, act } from '@testing-library/react';
import { useEngine } from '../use-engine';
import type { GameConfig } from '@/engine/core/types';
import { ContractRegistry } from '@/engine/core/contract-registry';

// ── Helpers ──

function makeConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    version: '1.0',
    modules: [
      { id: 'timer-1', type: 'Timer', enabled: true, params: { duration: 30 } },
    ],
    assets: {},
    canvas: { width: 1080, height: 1920 },
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    ...overrides,
  };
}

function makeReport(fixes: unknown[] = []) {
  return {
    errors: [],
    warnings: [],
    fixes,
    isPlayable: true,
  };
}

// ── Tests ──

describe('useEngine.loadConfig — auto-fix integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default implementations after clearAllMocks
    (ContractRegistry.fromRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockContracts);
    mockValidateConfig.mockReturnValue(makeReport([]));
    mockApplyFixes.mockImplementation((config: GameConfig) => config);
  });

  it('calls validateConfig with the original config and contracts before loading', () => {
    const config = makeConfig();
    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(config);
    });

    expect(mockValidateConfig).toHaveBeenCalledOnce();
    expect(mockValidateConfig).toHaveBeenCalledWith(config, mockContracts);
  });

  it('calls ContractRegistry.fromRegistry to build contracts', () => {
    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(makeConfig());
    });

    expect(ContractRegistry.fromRegistry).toHaveBeenCalledOnce();
  });

  it('calls loader.load with the original config when there are no fixes', () => {
    const config = makeConfig();
    mockValidateConfig.mockReturnValue(makeReport([])); // no fixes

    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(config);
    });

    expect(mockLoaderLoad).toHaveBeenCalledOnce();
    expect(mockLoaderLoad).toHaveBeenCalledWith(expect.anything(), config);
  });

  it('calls applyFixes and passes the FIXED config to loader.load when fixes exist', () => {
    const originalConfig = makeConfig();
    const fixedConfig = makeConfig({
      meta: { name: 'Fixed', description: '', thumbnail: null, createdAt: '' },
    });

    const fixes = [
      { moduleId: 'timer-1', param: 'duration', from: -1, to: 30, reason: 'Timer duration must be positive' },
    ];
    mockValidateConfig.mockReturnValue(makeReport(fixes));
    mockApplyFixes.mockReturnValue(fixedConfig);

    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(originalConfig);
    });

    // applyFixes must be called with original config and fixes
    expect(mockApplyFixes).toHaveBeenCalledOnce();
    expect(mockApplyFixes).toHaveBeenCalledWith(originalConfig, fixes);

    // loader.load must receive fixedConfig, NOT originalConfig
    expect(mockLoaderLoad).toHaveBeenCalledOnce();
    expect(mockLoaderLoad).toHaveBeenCalledWith(expect.anything(), fixedConfig);
    expect(mockLoaderLoad).not.toHaveBeenCalledWith(expect.anything(), originalConfig);
  });

  it('does NOT call applyFixes when fixes array is empty', () => {
    mockValidateConfig.mockReturnValue(makeReport([]));
    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(makeConfig());
    });

    expect(mockApplyFixes).not.toHaveBeenCalled();
  });

  it('publishes the validation report to editor store', () => {
    const report = makeReport([]);
    mockValidateConfig.mockReturnValue(report);
    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(makeConfig());
    });

    expect(mockSetValidationReport).toHaveBeenCalledOnce();
    expect(mockSetValidationReport).toHaveBeenCalledWith(report);
  });

  it('publishes validation report even when there are fixes', () => {
    const fixes = [
      { moduleId: 'timer-1', param: 'duration', from: -5, to: 30, reason: 'Timer duration must be positive' },
    ];
    const report = makeReport(fixes);
    mockValidateConfig.mockReturnValue(report);
    mockApplyFixes.mockReturnValue(makeConfig());

    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(makeConfig());
    });

    expect(mockSetValidationReport).toHaveBeenCalledWith(report);
  });

  it('still calls engine.restart() and engine.start() regardless of fixes', () => {
    mockValidateConfig.mockReturnValue(makeReport([]));
    const { result } = renderHook(() => useEngine());

    act(() => {
      result.current.loadConfig(makeConfig());
    });

    expect(mockEngineRestart).toHaveBeenCalledOnce();
    expect(mockEngineStart).toHaveBeenCalledOnce();
  });
});
