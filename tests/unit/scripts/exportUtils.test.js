import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getSerializedShadowSheet, 
  cleanupEditCopyPayloadStorage, 
  writeEditCopyPayload 
} from '../../../src/pages/simulationpage/utils/exportUtils.js';

describe('exportUtils', () => {

  describe('getSerializedShadowSheet', () => {
    it('returns empty string if sheet is null or undefined', () => {
      expect(getSerializedShadowSheet(null)).toBe('');
      expect(getSerializedShadowSheet(undefined)).toBe('');
    });

    it('extracts cssText from rules', () => {
      const mockSheet = {
        cssRules: [
          { cssText: '.test { color: red; }' },
          { cssText: '.test2 { color: blue; }' }
        ]
      };
      
      const result = getSerializedShadowSheet(mockSheet);
      expect(result).toBe('.test { color: red; }\n.test2 { color: blue; }');
    });

    it('uses cached result if called multiple times with same sheet reference', () => {
      const mockSheet = {
        cssRules: [
          { cssText: '.cache-test { color: green; }' }
        ]
      };
      
      const firstCall = getSerializedShadowSheet(mockSheet);
      expect(firstCall).toBe('.cache-test { color: green; }');

      // Even if we mutate the sheet, it should return the cached string from the WeakMap
      mockSheet.cssRules = [{ cssText: '.mutated { color: black; }' }];
      
      const secondCall = getSerializedShadowSheet(mockSheet);
      expect(secondCall).toBe('.cache-test { color: green; }'); // Should still return cached value
    });

    it('returns empty string if accessing cssRules throws an error', () => {
      // Simulate Cross-Origin style sheet access error
      const mockSheet = {};
      Object.defineProperty(mockSheet, 'cssRules', {
        get: () => { throw new Error('CORS error'); }
      });
      
      expect(getSerializedShadowSheet(mockSheet)).toBe('');
    });
  });

  describe('Storage Payload Functions', () => {
    
    // Mock the global Storage APIs
    let mockSessionStorage = {};
    let mockLocalStorage = {};

    beforeEach(() => {
      mockSessionStorage = {};
      mockLocalStorage = {};

      const createStorageMock = (store, isSession = false) => ({
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => {
          // Simulate quota exceeded if key contains 'QUOTA_EXCEEDED' and it's sessionStorage
          if (isSession && value.includes('QUOTA_EXCEEDED')) {
            throw new Error('QuotaExceededError');
          }
          store[key] = value.toString();
        }),
        removeItem: vi.fn(key => { delete store[key]; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn(i => Object.keys(store)[i])
      });

      vi.stubGlobal('sessionStorage', createStorageMock(mockSessionStorage, true));
      vi.stubGlobal('localStorage', createStorageMock(mockLocalStorage, false));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe('cleanupEditCopyPayloadStorage', () => {
      it('removes only keys matching the exact prefix from both storages', () => {
        sessionStorage.setItem('openhw_copy_123', 'data');
        sessionStorage.setItem('keep_this', 'data');
        localStorage.setItem('openhw_copy_456', 'data');
        localStorage.setItem('keep_that', 'data');

        cleanupEditCopyPayloadStorage('openhw_copy_');

        expect(sessionStorage.removeItem).toHaveBeenCalledWith('openhw_copy_123');
        expect(sessionStorage.removeItem).not.toHaveBeenCalledWith('keep_this');
        expect(mockSessionStorage['openhw_copy_123']).toBeUndefined();
        expect(mockSessionStorage['keep_this']).toBe('data');

        expect(localStorage.removeItem).toHaveBeenCalledWith('openhw_copy_456');
        expect(mockLocalStorage['openhw_copy_456']).toBeUndefined();
        expect(mockLocalStorage['keep_that']).toBe('data');
      });
    });

    describe('writeEditCopyPayload', () => {
      const mockData = { project: 'Test Project' };
      const prefix = 'test_copy_';
      const copyKey = 'test_pointer_key';

      it('writes payload to session storage and pointer to local storage (Ideal Scenario)', () => {
        const result = writeEditCopyPayload(mockData, prefix, copyKey);
        
        expect(result.ok).toBe(true);
        
        // Ensure local storage pointer exists
        const pointerStr = mockLocalStorage[copyKey];
        expect(pointerStr).toBeDefined();
        
        const pointer = JSON.parse(pointerStr);
        expect(pointer.__openhwEditCopyPointer).toBe(true);
        expect(pointer.version).toBe(2);
        expect(pointer.storage).toBe('session');
        expect(pointer.key.startsWith(prefix)).toBe(true);

        // Ensure session storage payload exists
        const payloadStr = mockSessionStorage[pointer.key];
        expect(payloadStr).toBeDefined();
        
        const payload = JSON.parse(payloadStr);
        expect(payload.project).toBe('Test Project');
      });

      it('falls back to local storage if session storage throws quota error', () => {
        // We set QUOTA_EXCEEDED in the data to trigger the mock's throw behavior
        const hugeData = { project: 'QUOTA_EXCEEDED' };
        
        const result = writeEditCopyPayload(hugeData, prefix, copyKey);
        
        expect(result.ok).toBe(true);
        
        // Local storage should contain the raw payload, not the pointer
        const fallbackPayloadStr = mockLocalStorage[copyKey];
        expect(fallbackPayloadStr).toBeDefined();
        
        const fallbackPayload = JSON.parse(fallbackPayloadStr);
        expect(fallbackPayload.project).toBe('QUOTA_EXCEEDED');
        expect(fallbackPayload.__openhwEditCopyPointer).toBeUndefined(); // It's the real data!
      });
    });
  });
});
