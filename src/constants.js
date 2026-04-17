export const RARITY = {
  coal:              { label: 'Common',    color: '#888'    },
  copper_ore:        { label: 'Common',    color: '#888'    },
  tin_ore:           { label: 'Common',    color: '#888'    },
  raw_quartz:        { label: 'Uncommon',  color: '#4ade80' },
  iron_ore:          { label: 'Uncommon',  color: '#4ade80' },
  malachite:         { label: 'Uncommon',  color: '#4ade80' },
  silver_ore:        { label: 'Rare',      color: '#60a5fa' },
  amethyst_shard:    { label: 'Rare',      color: '#60a5fa' },
  gold_ore:          { label: 'Epic',      color: '#c084fc' },
  obsidian:          { label: 'Epic',      color: '#c084fc' },
  ruby_fragment:     { label: 'Epic',      color: '#c084fc' },
  sapphire_fragment: { label: 'Epic',      color: '#c084fc' },
  platinum_ore:      { label: 'Legendary', color: '#fb923c' },
  void_stone:        { label: 'Legendary', color: '#fb923c' },
  diamond_rough:     { label: 'Legendary', color: '#fb923c' },
  ancient_fragment:  { label: 'Legendary', color: '#fb923c' },
  worldstone_shard:  { label: 'Mythical',  color: '#f43f5e' },
  core_crystal:      { label: 'Mythical',  color: '#f43f5e' },
}

export function getRarity(item) {
  return RARITY[item] || { label: 'Common', color: '#888' }
}
