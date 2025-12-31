/**
 * Tests for Garmin sync functionality
 * FR-4.3, FR-4.4
 */

import { describe, test, expect } from 'vitest';
import { splitDateRangeIntoChunks } from '../../src/app/history/logic/dateChunker';

describe('Garmin Sync (FR-4)', () => {
  describe('Date Chunking', () => {
    test('30-day range should split into 5 chunks', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-12-18');
      
      expect(chunks.length).toBe(5);
      expect(chunks[0]).toEqual({ start: '2025-11-18', end: '2025-11-24' });
      expect(chunks[1]).toEqual({ start: '2025-11-25', end: '2025-12-01' });
      expect(chunks[2]).toEqual({ start: '2025-12-02', end: '2025-12-08' });
      expect(chunks[3]).toEqual({ start: '2025-12-09', end: '2025-12-15' });
      expect(chunks[4]).toEqual({ start: '2025-12-16', end: '2025-12-18' });
    });

    test('Range less than 7 days should return single chunk', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-20');
      
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual({ start: '2025-11-18', end: '2025-11-20' });
    });

    test('Exactly 7 days should return single chunk', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-24');
      
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual({ start: '2025-11-18', end: '2025-11-24' });
    });

    test('Exactly 8 days should split into 2 chunks', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-25');
      
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toEqual({ start: '2025-11-18', end: '2025-11-24' });
      expect(chunks[1]).toEqual({ start: '2025-11-25', end: '2025-11-25' });
    });

    test('Single day range should return single chunk', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-18');
      
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual({ start: '2025-11-18', end: '2025-11-18' });
    });

    test('Month boundaries should be handled correctly', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-28', '2025-12-05');
      
      expect(chunks.length).toBe(2);
      expect(chunks[0].start).toBe('2025-11-28');
      expect(chunks[0].end).toBe('2025-12-04');
      expect(chunks[1].start).toBe('2025-12-05');
      expect(chunks[1].end).toBe('2025-12-05');
    });

    test('Invalid start date should throw error', () => {
      expect(() => {
        splitDateRangeIntoChunks('invalid-date', '2025-12-18');
      }).toThrow();
    });

    test('Invalid end date should throw error', () => {
      expect(() => {
        splitDateRangeIntoChunks('2025-11-18', 'invalid-date');
      }).toThrow();
    });

    test('Start date after end date should throw error', () => {
      expect(() => {
        splitDateRangeIntoChunks('2025-12-18', '2025-11-18');
      }).toThrow();
    });

    test('Year boundaries should be handled correctly', () => {
      const chunks = splitDateRangeIntoChunks('2024-12-28', '2025-01-05');
      
      expect(chunks.length).toBe(2);
      expect(chunks[0].start).toBe('2024-12-28');
      expect(chunks[0].end).toBe('2025-01-03');
      expect(chunks[1].start).toBe('2025-01-04');
      expect(chunks[1].end).toBe('2025-01-05');
    });

    test('Chunks should be consecutive with no gaps', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-12-18');
      
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = new Date(chunks[i - 1].end);
        const currStart = new Date(chunks[i].start);
        prevEnd.setDate(prevEnd.getDate() + 1);
        expect(prevEnd.getTime()).toBe(currStart.getTime());
      }
    });

    test('Last chunk should not exceed end date', () => {
      const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-12-18');
      const lastChunk = chunks[chunks.length - 1];
      const endDate = new Date('2025-12-18');
      const lastChunkEnd = new Date(lastChunk.end);
      
      expect(lastChunkEnd.getTime()).toBeLessThanOrEqual(endDate.getTime());
    });
  });
});
