import { describe, it, expect } from 'vitest';
import { getItemDisplay, getModifierDisplay, collectLineItemIcons } from './utils';
import type { MenuDisplayItem, ModifierDisplayItem, OrderLineItem } from './types';

describe('getItemDisplay icon field', () => {
  const menuDisplay: MenuDisplayItem[] = [
    { restaurant_code: 'TEST', item_name: 'Spicy Chicken', icon: '🔥' },
    { restaurant_code: 'TEST', item_name: 'Salmon Bowl', icon: '🐟', abbreviation: 'Salmon' },
    { restaurant_code: 'TEST', item_name: 'No Icon Item' },
  ];

  it('returns icon when configured', () => {
    const result = getItemDisplay('Spicy Chicken', menuDisplay);
    expect(result.icon).toBe('🔥');
  });

  it('returns icon alongside abbreviation', () => {
    const result = getItemDisplay('Salmon Bowl', menuDisplay);
    expect(result.icon).toBe('🐟');
    expect(result.label).toBe('Salmon');
  });

  it('returns undefined icon when not configured', () => {
    const result = getItemDisplay('No Icon Item', menuDisplay);
    expect(result.icon).toBeUndefined();
  });

  it('returns undefined icon for unknown item', () => {
    const result = getItemDisplay('Unknown Item', menuDisplay);
    expect(result.icon).toBeUndefined();
  });
});

describe('getModifierDisplay icon field', () => {
  const modifierDisplay: ModifierDisplayItem[] = [
    { restaurant_code: 'TEST', modifier_name: 'Brown Rice', icon: '🌾' },
    { restaurant_code: 'TEST', modifier_name: 'Extra Spicy', icon: '🌶️', abbreviation: 'X-Spicy' },
    { restaurant_code: 'TEST', modifier_name: 'No Onion' },
  ];

  it('returns icon when configured', () => {
    const result = getModifierDisplay({ name: 'Brown Rice', qty: 1, price: 0 }, modifierDisplay);
    expect(result.icon).toBe('🌾');
  });

  it('returns icon alongside abbreviation', () => {
    const result = getModifierDisplay({ name: 'Extra Spicy', qty: 1, price: 0 }, modifierDisplay);
    expect(result.icon).toBe('🌶️');
    expect(result.label).toBe('X-Spicy');
  });

  it('returns undefined icon when not configured', () => {
    const result = getModifierDisplay({ name: 'No Onion', qty: 1, price: 0 }, modifierDisplay);
    expect(result.icon).toBeUndefined();
  });

  it('returns undefined icon for unknown modifier', () => {
    const result = getModifierDisplay('Unknown Mod', modifierDisplay);
    expect(result.icon).toBeUndefined();
  });
});

describe('collectLineItemIcons', () => {
  const menuItems: MenuDisplayItem[] = [
    { restaurant_code: 'TEST', item_name: 'Spicy Poke', icon: '🌶️' },
    { restaurant_code: 'TEST', item_name: 'Plain Bowl' },
  ];
  const modifiers: ModifierDisplayItem[] = [
    { restaurant_code: 'TEST', modifier_name: 'Brown Rice', icon: '🌾' },
    { restaurant_code: 'TEST', modifier_name: 'Extra Spicy', icon: '🔥' },
    { restaurant_code: 'TEST', modifier_name: 'No Onion' },
    { restaurant_code: 'TEST', modifier_name: 'Hidden Mod', icon: '👻', show_on_kds: false },
  ];

  const makeItem = (name: string, mods?: { name: string; qty: number; price: number }[]): OrderLineItem => ({
    name,
    quantity: '1',
    totalMoney: 0,
    modifiers: mods,
  });

  it('returns item icon only when no modifier icons', () => {
    const item = makeItem('Spicy Poke', [{ name: 'No Onion', qty: 1, price: 0 }]);
    expect(collectLineItemIcons(item, menuItems, modifiers)).toEqual(['🌶️']);
  });

  it('returns modifier icon only when no item icon', () => {
    const item = makeItem('Plain Bowl', [{ name: 'Brown Rice', qty: 1, price: 0 }]);
    expect(collectLineItemIcons(item, menuItems, modifiers)).toEqual(['🌾']);
  });

  it('returns both item + modifier icons in order', () => {
    const item = makeItem('Spicy Poke', [
      { name: 'Brown Rice', qty: 1, price: 0 },
      { name: 'Extra Spicy', qty: 1, price: 0 },
    ]);
    expect(collectLineItemIcons(item, menuItems, modifiers)).toEqual(['🌶️', '🌾', '🔥']);
  });

  it('returns empty array when no icons configured', () => {
    const item = makeItem('Plain Bowl', [{ name: 'No Onion', qty: 1, price: 0 }]);
    expect(collectLineItemIcons(item, menuItems, modifiers)).toEqual([]);
  });

  it('excludes icons from showOnKds=false modifiers', () => {
    const item = makeItem('Plain Bowl', [{ name: 'Hidden Mod', qty: 1, price: 0 }]);
    expect(collectLineItemIcons(item, menuItems, modifiers)).toEqual([]);
  });

  it('returns empty array when no modifiers', () => {
    const item = makeItem('Plain Bowl');
    expect(collectLineItemIcons(item, menuItems, modifiers)).toEqual([]);
  });
});
