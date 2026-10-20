import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS, countryDirection, DIRECTIONS } from '../../src/data/directions';

describe('DIRECTIONS', () => {
  it('has the four directions of the compass, once each', () => {
    expect(DIRECTIONS.map((direction) => direction.id).sort()).toEqual(['east', 'north', 'south', 'west']);
  });

  it('has exactly one portal, and it is south', () => {
    const portals = DIRECTIONS.filter((direction) => direction.kind === 'portal');
    expect(portals).toHaveLength(1);
    expect(portals[0].id).toBe('south');
    expect(portals[0].country).toBeUndefined();
  });

  it('gives the three countries one direction each', () => {
    const countries = DIRECTIONS.filter((direction) => direction.kind === 'country').map((direction) => direction.country);
    expect([...countries].sort()).toEqual(['aruba', 'china', 'netherlands']);
    expect(new Set(countries).size).toBe(3);
    expect([...COUNTRY_IDS].sort()).toEqual(['aruba', 'china', 'netherlands']);
  });

  it('engraves every direction', () => {
    for (const direction of DIRECTIONS) expect(direction.engraving.trim().length, direction.id).toBeGreaterThan(0);
  });

  it('uses the art direction accents', () => {
    const accents = Object.fromEntries(DIRECTIONS.map((direction) => [direction.id, direction.accent]));
    expect(accents).toEqual({ east: '#a8352a', north: '#1d5fa8', west: '#2db3a8', south: '#efb53d' });
  });

  it('engraves east 東, north Noord and south 南', () => {
    const engravings = Object.fromEntries(DIRECTIONS.map((direction) => [direction.id, direction.engraving]));
    expect(engravings.east).toBe('東');
    expect(engravings.north).toBe('Noord');
    expect(engravings.south).toBe('南');
  });
});

describe('countryDirection', () => {
  it('finds the direction of a country', () => {
    expect(countryDirection('china').id).toBe('east');
    expect(countryDirection('netherlands').id).toBe('north');
    expect(countryDirection('aruba').id).toBe('west');
  });
});
