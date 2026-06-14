import {describe, expect, it} from 'vitest';
import {formatReleaseDate} from '../src/lib/formatReleaseDate.js';

describe('formatReleaseDate', () => {
  it('formats full and partial MusicBrainz release dates', () => {
    expect(formatReleaseDate('2024-06-14')).toBe('14 Jun 2024');
    expect(formatReleaseDate('2007-04')).toBe('Apr 2007');
    expect(formatReleaseDate('2007')).toBe('2007');
    expect(formatReleaseDate(null)).toBe('—');
    expect(formatReleaseDate('not-a-date')).toBe('not-a-date');
  });
});
