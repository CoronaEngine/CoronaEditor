export const GEAR_SLOTS = [
  { id: 'helm', name: '头盔', types: ['重甲', '轻甲'] },
  { id: 'chest', name: '胸甲', types: ['重甲', '轻甲'] },
  { id: 'legs', name: '腿甲', types: ['重甲', '轻甲'] },
  { id: 'boots', name: '战靴', types: ['靴履'] },
  { id: 'weapon', name: '武器', types: ['长兵', '刀剑', '弓弩', '法器'] },
];

export const BAG_TABS = [
  { id: 'all', name: '全部' },
  { id: 'equip', name: '装备' },
  { id: 'usable', name: '治疗物品' },
  { id: 'mat', name: '材料' },
];

export const SKILL_ICON_INNER = {
  // 重斩：护盾（防御 → 蓄力重击）
  shield:
    '<polygon points="24,6 40,16 34,36 24,44 14,36 8,16" fill="rgba(158,203,214,.28)"/>' +
    '<polygon points="24,6 40,16 34,36 24,44 14,36 8,16"/>' +
    '<line x1="24" y1="16" x2="24" y2="44"/>',
  // 横扫：多重残影（横挥的多段轨迹）
  mirage:
    '<rect x="14" y="14" width="20" height="20" rx="2" fill="rgba(230,213,167,.34)"/>' +
    '<rect x="14" y="14" width="20" height="20" rx="2"/>' +
    '<rect x="8" y="8" width="20" height="20" rx="2" opacity="0.45" fill="rgba(230,213,167,.2)"/>' +
    '<rect x="8" y="8" width="20" height="20" rx="2" opacity="0.45"/>' +
    '<rect x="20" y="20" width="20" height="20" rx="2" opacity="0.45" fill="rgba(230,213,167,.2)"/>' +
    '<rect x="20" y="20" width="20" height="20" rx="2" opacity="0.45"/>',
  // 其它战技：定身符（双竖线 + 环）
  stasis:
    '<circle cx="24" cy="24" r="16" fill="rgba(158,203,214,.22)"/>' +
    '<circle cx="24" cy="24" r="16"/>' +
    '<line x1="18" y1="14" x2="18" y2="34"/><line x1="30" y1="14" x2="30" y2="34"/>',
};

export const GEAR_ICONS = {
  'i-helm-h':
    '<svg viewBox="0 0 48 48"><path d="M24 5C15.7 5 9.5 11.6 9.5 20v6h29v-6C38.5 11.6 32.3 5 24 5Z" fill="rgba(230,213,167,.30)"/><path d="M24 5c8.3 0 14.5 6.6 14.5 15v6H24Z" fill="rgba(120,92,38,.45)"/><path d="M24 31c-6.4 0-11.6 3.6-13.4 9h26.8C35.6 34.6 30.4 31 24 31Z" fill="rgba(230,213,167,.30)"/><path d="M24 5C15.7 5 9.5 11.6 9.5 20v6h29v-6C38.5 11.6 32.3 5 24 5Z"/><path d="M24 31c-6.4 0-11.6 3.6-13.4 9h26.8C35.6 34.6 30.4 31 24 31Z"/><path d="M21.6 26v14"/><path d="M10.6 26h7.4M30 26h7.4"/><path d="M24 5v7"/></svg>',
  'i-helm-l':
    '<svg viewBox="0 0 48 48"><path d="M24 10c-7.4 0-13 6.4-14.6 15.4L24 31l14.6-5.6C37 16.4 31.4 10 24 10Z" fill="rgba(244,248,240,.40)"/><path d="M24 10c7.4 0 13 6.4 14.6 15.4L24 31Z" fill="rgba(150,164,144,.35)"/><path d="M6 25.4c5.6 4.8 12 6.9 18 6.9s12.4-2.1 18-6.9c-5.6 2-12 3-18 3s-12.4-1-18-3Z" fill="rgba(230,213,167,.30)"/><path d="M24 10c-7.4 0-13 6.4-14.6 15.4L24 31l14.6-5.6C37 16.4 31.4 10 24 10Z"/><path d="M6 25.4c5.6 4.8 12 6.9 18 6.9s12.4-2.1 18-6.9c-5.6 2-12 3-18 3s-12.4-1-18-3Z"/><path d="M17 32c1.6 5.6 4 9.6 7 12 3-2.4 5.4-6.4 7-12"/><path d="M24 10v21"/></svg>',
  'i-chest-h':
    '<svg viewBox="0 0 48 48"><path d="M14.5 12.5 24 9.5l9.5 3 2 9.5c0 9-5 15.5-11.5 19.5C17.5 37.5 12.5 31 12.5 22Z" fill="rgba(230,213,167,.30)"/><path d="M24 9.5l9.5 3 2 9.5c0 9-5 15.5-11.5 19.5Z" fill="rgba(120,92,38,.45)"/><path d="M24 20c-4.4 0-7 3-7 7 0 5 3.4 9 7 11.5 3.6-2.5 7-6.5 7-11.5 0-4-2.6-7-7-7Z" fill="rgba(230,213,167,.55)"/><path d="M14.5 12.5 24 9.5l9.5 3 2 9.5c0 9-5 15.5-11.5 19.5C17.5 37.5 12.5 31 12.5 22Z"/><path d="M24 20c-4.4 0-7 3-7 7 0 5 3.4 9 7 11.5 3.6-2.5 7-6.5 7-11.5 0-4-2.6-7-7-7Z"/><path d="M24 20v18.5"/><path d="M12.5 22h7M35.5 22h-7"/></svg>',
  'i-chest-l':
    '<svg viewBox="0 0 48 48"><path d="M15 13 24 10l9 3 2 10c0 8-4.5 13.5-11 16.5-6.5-3-11-8.5-11-16.5Z" fill="rgba(244,248,240,.40)"/><path d="M24 10l9 3 2 10c0 8-4.5 13.5-11 16.5Z" fill="rgba(150,164,144,.35)"/><path d="M15 13 24 10l9 3 2 10c0 8-4.5 13.5-11 16.5-6.5-3-11-8.5-11-16.5Z"/><path d="M20 13.5 24 20l4-6.5"/><path d="M24 20v19"/><path d="M15.5 26h5M27.5 26h5"/></svg>',
  'i-legs-h':
    '<svg viewBox="0 0 48 48"><path d="M15 8.5h8c1 5 1.4 10 1 15l-1 6h-8l-1-6c-.4-5 0-10 1-15Z" fill="rgba(230,213,167,.30)"/><path d="M25 8.5h8c1 5 1.4 10 1 15l-1 6h-8l-1-6c-.4-5 0-10 1-15Z" fill="rgba(230,213,167,.30)"/><path d="M25 8.5h8c1 5 1.4 10 1 15l-1 6h-8Z" fill="rgba(120,92,38,.45)"/><path d="M11.6 8.6C17.4 5 30.6 5 36.4 8.6c-5.8 3.4-19 3.4-24.8 0Z" fill="rgba(230,213,167,.55)"/><circle cx="19" cy="20" r="3.6" fill="rgba(230,213,167,.55)"/><circle cx="29.5" cy="20" r="3.6" fill="rgba(230,213,167,.55)"/><path d="M15 8.5h8c1 5 1.4 10 1 15l-1 6h-8l-1-6c-.4-5 0-10 1-15Z"/><path d="M25 8.5h8c1 5 1.4 10 1 15l-1 6h-8l-1-6c-.4-5 0-10 1-15Z"/><path d="M11.6 8.6C17.4 5 30.6 5 36.4 8.6c-5.8 3.4-19 3.4-24.8 0Z"/><circle cx="19" cy="20" r="3.6"/><circle cx="29.5" cy="20" r="3.6"/><path d="M15.4 30.5h7.2M25.4 30.5h7.2"/></svg>',
  'i-legs-l':
    '<svg viewBox="0 0 48 48"><path d="M16 9h6.5l1.4 8-1 22H16c-1-10-1-20 0-30Z" fill="rgba(244,248,240,.40)"/><path d="M25.5 9H32c1 10 1 20 0 30h-7.9l-1-22Z" fill="rgba(244,248,240,.40)"/><path d="M25.5 9H32c1 10 1 20 0 30H25.5Z" fill="rgba(150,164,144,.35)"/><path d="M16 9h6.5l1.4 8-1 22H16c-1-10-1-20 0-30Z"/><path d="M25.5 9H32c1 10 1 20 0 30h-7.9l-1-22Z"/><path d="M16.4 17h7M16.4 25h7M16.4 33h7M25.6 17h7M25.6 25h7M25.6 33h7"/></svg>',
  'i-boots-h':
    '<svg viewBox="0 0 48 48"><path d="M13 11h8v17.5l6.5 6.5v6.5H13Z" fill="rgba(230,213,167,.30)"/><path d="M25 12h8v13l6 10v6.5H25Z" fill="rgba(230,213,167,.30)"/><path d="M25 12h8v13l6 10v6.5H25Z" fill="rgba(120,92,38,.45)"/><path d="M11.5 9.5c4.4-1.6 15.6-1.6 20 0 .8 2.2.8 3.6 0 5.4-4.4-1.6-15.6-1.6-20 0-.8-1.8-.8-3.2 0-5.4Z" fill="rgba(230,213,167,.55)"/><path d="M11.5 38.5h31v3.5h-31Z" fill="rgba(120,92,38,.45)"/><path d="M13 11h8v17.5l6.5 6.5v6.5H13Z"/><path d="M25 12h8v13l6 10v6.5H25Z"/><path d="M11.5 9.5c4.4-1.6 15.6-1.6 20 0 .8 2.2.8 3.6 0 5.4-4.4-1.6-15.6-1.6-20 0-.8-1.8-.8-3.2 0-5.4Z"/><path d="M11.5 38.5h31v3.5h-31Z"/><path d="M25 25h8"/></svg>',
  'i-boots-l':
    '<svg viewBox="0 0 48 48"><path d="M14 13h7.5v15.5l6 7v5H14Z" fill="rgba(244,248,240,.40)"/><path d="M25 14h7.5v12l5.5 9.5v5H25Z" fill="rgba(244,248,240,.40)"/><path d="M25 14h7.5v12l5.5 9.5v5H25Z" fill="rgba(150,164,144,.35)"/><path d="M11 38h29l-1.5 4h-26Z" fill="rgba(150,164,144,.35)"/><path d="M14 13h7.5v15.5l6 7v5H14Z"/><path d="M25 14h7.5v12l5.5 9.5v5H25Z"/><path d="M11 38h29l-1.5 4h-26Z"/><path d="M14 19h7.5M25 20h7.5M25 27h7.5"/></svg>',
  'i-weapon-b':
    '<svg viewBox="0 0 48 48"><path d="M24 2.6 30 13.5v20.5h-12V13.5Z" fill="rgba(255,255,255,.62)"/><path d="M24 2.6 30 13.5v20.5h-6Z" fill="rgba(124,134,118,.45)"/><path d="M24 2.6 30 13.5v20.5h-12V13.5Z"/><path d="M9.5 33.5c5-3 24-3 29 0-5 3-24 3-29 0Z" fill="rgba(230,213,167,.55)"/><path d="M9.5 33.5c5-3 24-3 29 0-5 3-24 3-29 0Z"/><path d="M21.3 36.6h5.4v7.4h-5.4Z" fill="rgba(230,213,167,.30)"/><path d="M21.3 36.6h5.4v7.4h-5.4Z"/><path d="M21.3 40.3h5.4"/><circle cx="24" cy="45.6" r="2.4" fill="rgba(230,213,167,.55)"/><circle cx="24" cy="45.6" r="2.4"/></svg>',
  'i-weapon-h':
    '<svg viewBox="0 0 48 48"><path d="M19.5 7c-7 3.5-10.5 9-10.5 15.5S12.5 34.5 19.5 38Z" fill="rgba(230,213,167,.30)"/><path d="M28.5 7c7 3.5 10.5 9 10.5 15.5S35.5 34.5 28.5 38Z" fill="rgba(120,92,38,.45)"/><path d="M19.5 7c-7 3.5-10.5 9-10.5 15.5S12.5 34.5 19.5 38Z"/><path d="M28.5 7c7 3.5 10.5 9 10.5 15.5S35.5 34.5 28.5 38Z"/><path d="M21.4 4.5h5.2v39h-5.2Z" fill="rgba(230,213,167,.30)"/><path d="M21.4 4.5h5.2v39h-5.2Z"/><path d="M21.4 12h5.2M21.4 18h5.2M21.4 24h5.2M21.4 30h5.2"/><circle cx="24" cy="45" r="2.6" fill="rgba(230,213,167,.55)"/><circle cx="24" cy="45" r="2.6"/></svg>',
  'i-weapon-x':
    '<svg viewBox="0 0 48 48"><path d="M24 3.5 34 12v17L24 37.5 14 29V12Z" fill="rgba(230,213,167,.30)"/><path d="M24 3.5 34 12v17L24 37.5Z" fill="rgba(120,92,38,.45)"/><path d="M24 16.5 29 20v7l-5 3.5-5-3.5v-7Z" fill="rgba(230,213,167,.55)"/><path d="M24 3.5 34 12v17L24 37.5 14 29V12Z"/><path d="M14 12l10 8 10-8M24 20v17.5"/><path d="M24 16.5 29 20v7l-5 3.5-5-3.5v-7Z"/><path d="M24 37.5V44"/></svg>',
  'i-weapon-r':
    '<svg viewBox="0 0 48 48"><path d="M13.5 5c11 6.5 11 27.5 0 34-.8-11.3-.8-22.7 0-34Z" fill="rgba(230,213,167,.30)"/><path d="M13.5 5c11 6.5 11 27.5 0 34-.8-11.3-.8-22.7 0-34Z"/><path d="M13.5 5v34"/><path d="M13.5 22h19"/><path d="M33 17.5l7.5 4.5-7.5 4.5Z" fill="rgba(230,213,167,.55)"/><path d="M33 17.5l7.5 4.5-7.5 4.5Z"/><path d="M28 22h5"/></svg>',
  'i-material-d':
    '<svg viewBox="0 0 48 48"><path d="M19 8l10 3 4 9-4 9-10 3-9-4-2-8 3-9Z" fill="rgba(158,203,214,.32)"/><path d="M29 11l4 9-4 9-10 3 5-10Z" fill="rgba(51,96,108,.45)"/><path d="M19 8l10 3 4 9-4 9-10 3-9-4-2-8 3-9Z"/><path d="M10 12l9 5 10-6M19 17v15"/></svg>',
  'i-herb-d':
    '<svg viewBox="0 0 48 48"><path d="M24 21C18 20 13 15 13 9c6-.6 11 5 11 12Z" fill="rgba(158,203,214,.32)"/><path d="M24 30c6-1.4 11-7 11-13-6-.6-11 5-11 13Z" fill="rgba(158,203,214,.32)"/><path d="M24 41V15"/><path d="M24 21C18 20 13 15 13 9c6-.6 11 5 11 12Z"/><path d="M24 30c6-1.4 11-7 11-13-6-.6-11 5-11 13Z"/><path d="M11 41h26"/></svg>',
  'i-silk-d':
    '<svg viewBox="0 0 48 48"><path d="M7 13c7-6 14 6 21 0s10 2 13 5v8c-3-3-6-9-13-3s-14-6-21 0Z" fill="rgba(158,203,214,.32)"/><path d="M7 26c7-6 14 6 21 0s10 2 13 5v8c-3-3-6-9-13-3s-14-6-21 0Z" fill="rgba(51,96,108,.45)"/><path d="M7 13c7-6 14 6 21 0s10 2 13 5"/><path d="M7 26c7-6 14 6 21 0s10 2 13 5"/><path d="M7 34c7-6 14 6 21 0s10 2 13 5"/></svg>',
  'i-ore-d':
    '<svg viewBox="0 0 48 48"><path d="M15 16l9-7 9 7v12l-9 8-9-8Z" fill="rgba(158,203,214,.32)"/><path d="M24 9l9 7v12l-9 8Z" fill="rgba(51,96,108,.45)"/><path d="M15 16l9-7 9 7v12l-9 8-9-8Z"/><path d="M15 16h18M24 21v15"/></svg>',
  'i-coal-d':
    '<svg viewBox="0 0 48 48"><path d="M13 28l5-15 11 3 6 13-11 10Z" fill="rgba(158,203,214,.32)"/><path d="M29 16l6 13-11 10Z" fill="rgba(51,96,108,.45)"/><path d="M13 28l5-15 11 3 6 13-11 10Z"/><path d="M18 13l-3 13 11 10"/></svg>',
  'i-fang-d':
    '<svg viewBox="0 0 48 48"><path d="M20 5l5 9-2 28-4-28Z" fill="rgba(158,203,214,.32)"/><path d="M25 14l7 5-5 4Z" fill="rgba(51,96,108,.45)"/><path d="M20 5l5 9-2 28-4-28Z"/><path d="M25 14l7 5-5 4Z"/></svg>',
  'i-ring-d':
    '<svg viewBox="0 0 48 48"><path d="M24 12a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z" fill="rgba(158,203,214,.32)"/><path d="M18 6l6 4-3 5-4-4Z" fill="rgba(51,96,108,.45)"/><path d="M24 12a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"/><path d="M18 6l6 4-3 5-4-4Z"/></svg>',
  'i-talis-d':
    '<svg viewBox="0 0 48 48"><path d="M18 12c-2 12 1 22 6 31 5-9 8-19 6-31Z" fill="rgba(158,203,214,.32)"/><path d="M24 12c3 0 5 1 6 31-3 0-4-1-6-31Z" fill="rgba(51,96,108,.45)"/><path d="M18 12c-2 12 1 22 6 31 5-9 8-19 6-31Z"/><path d="M17 5h14v7H17Z" fill="rgba(51,96,108,.45)"/><path d="M17 5h14v7H17Z"/><path d="M20 22h8M21 30h6"/></svg>',
  'i-pill-d':
    '<svg viewBox="0 0 48 48"><path d="M24 6l13 10v16L24 42 11 32V16Z" fill="rgba(158,203,214,.32)"/><path d="M24 6l13 10v16L24 42Z" fill="rgba(51,96,108,.45)"/><path d="M24 6l13 10v16L24 42 11 32V16Z"/><path d="M11 16l13 10 13-10M24 26v16"/></svg>',
  'i-elixir-d':
    '<svg viewBox="0 0 48 48"><path d="M21 12c-8 5-10 12-6 18 3 5 7 7 9 7s6-2 9-7c4-6 2-13-6-18Z" fill="rgba(158,203,214,.32)"/><path d="M24 12c8 5 10 12 6 18-3 5-7 7-9 7Z" fill="rgba(51,96,108,.45)"/><path d="M21 12c-8 5-10 12-6 18 3 5 7 7 9 7s6-2 9-7c4-6 2-13-6-18Z"/><path d="M19 5h10v8H19Z" fill="rgba(51,96,108,.45)"/><path d="M19 5h10v8H19Z"/><path d="M15 26h18"/></svg>',
  'i-scroll-d':
    '<svg viewBox="0 0 48 48"><path d="M16 9h16v30H16Z" fill="rgba(158,203,214,.32)"/><path d="M32 9h3v30h-3Z" fill="rgba(51,96,108,.45)"/><path d="M16 9h16v30H16Z"/><path d="M13 6h22v5H13Z" fill="rgba(51,96,108,.45)"/><path d="M13 6h22v5H13Z"/><path d="M13 37h22v5H13Z" fill="rgba(51,96,108,.45)"/><path d="M13 37h22v5H13Z"/><path d="M20 18h8M20 24h8M20 30h5"/></svg>',
  'i-consumable-d':
    '<svg viewBox="0 0 48 48"><path d="M16 16h16v19c0 4-16 4-16 0Z" fill="rgba(158,203,214,.32)"/><path d="M32 16v19c0 4-16 4-16 0Z" fill="rgba(51,96,108,.45)"/><path d="M16 16h16v19c0 4-16 4-16 0Z"/><path d="M20 7h8v9h-8Z" fill="rgba(51,96,108,.45)"/><path d="M20 7h8v9h-8Z"/><path d="M20 23h8M20 28h8"/></svg>',
  'i-material':
    '<svg viewBox="0 0 48 48"><path d="M24 8l12 8v16l-12 8-12-8V16Z" fill="rgba(158,203,214,.32)"/><path d="M24 8l12 8v16l-12 8V16Z" fill="rgba(51,96,108,.45)"/><path d="M24 8l12 8v16l-12 8-12-8V16Z"/><path d="M24 24l12-8M24 24l-12-8M24 24v16"/></svg>',
  'i-consumable':
    '<svg viewBox="0 0 48 48"><path d="M16 16h16v20c0 4-16 4-16 0Z" fill="rgba(158,203,214,.32)"/><path d="M16 16h16v20c0 4-16 4-16 0Z"/><path d="M20 8h8v8h-8Z" fill="rgba(51,96,108,.45)"/><path d="M20 8h8v8h-8Z"/></svg>',
  'i-core':
    '<svg viewBox="0 0 48 48"><path d="M24 6l16 18-16 18L8 24Z" fill="rgba(230,213,167,.30)"/><path d="M24 6l16 18-16 18L8 24Z"/><circle cx="24" cy="24" r="6" fill="rgba(230,213,167,.55)"/><circle cx="24" cy="24" r="6"/></svg>',
  'i-acc':
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke-dasharray="4 4" fill="rgba(150,164,144,.35)"/><circle cx="24" cy="24" r="14" stroke-dasharray="4 4"/><circle cx="24" cy="24" r="6"/><path d="M24 4v6"/></svg>',
};

const BOSS_LOOT_ITEMS = [
  {
    u: 'boss-main',
    name: '龙牙断岳',
    type: '长兵',
    cat: 'equip',
    slot: 'weapon',
    rarity: 'epic',
    glyph: 'g-sword',
    stats: [
      ['锋芒', '128 - 168'],
      ['力道', '+47'],
      ['破甲', '+21%'],
    ],
    flavor: '刃口还残留着龙焰的温度，握久了掌心会发烫。',
  },
  {
    u: 'boss-helm',
    name: '龙鳞重盔',
    type: '重甲',
    cat: 'equip',
    slot: 'helm',
    rarity: 'epic',
    glyph: 'g-helm-h',
    stats: [
      ['护体', '+150'],
      ['定神', '+24'],
      ['抗蚀', '+12%'],
    ],
    flavor: '每一片鳞都朝着同一个方向，像是还记着风。',
  },
  {
    u: 'boss-chest',
    name: '龙脊重铠',
    type: '重甲',
    cat: 'equip',
    slot: 'chest',
    rarity: 'epic',
    glyph: 'g-armor',
    stats: [
      ['护体', '+210'],
      ['筋骨', '+31'],
      ['抗蚀', '+20%'],
    ],
    flavor: '背脊那一道棱线取自龙骨，披上时能听见极轻的嗡鸣。',
  },
  {
    u: 'boss-legs',
    name: '龙尾胫铠',
    type: '重甲',
    cat: 'equip',
    slot: 'legs',
    rarity: 'epic',
    glyph: 'g-legs-h',
    stats: [
      ['护体', '+168'],
      ['负重', '+18'],
      ['筋骨', '+12'],
    ],
    flavor: '胫甲末端收成尾鳍的形状，走起路来却毫不拖沓。',
  },
  {
    u: 'boss-boots',
    name: '龙爪战靴',
    type: '靴履',
    cat: 'equip',
    slot: 'boots',
    rarity: 'epic',
    glyph: 'g-boots-h',
    stats: [
      ['护体', '+112'],
      ['身法', '+24'],
      ['疾行', '+10%'],
    ],
    flavor: '鞋底是三枚钩爪，踩在石上会留下极浅的白痕。',
  },
];
const MONSTER_EQUIPMENT = Object.freeze([
  Object.freeze({
    u: 'hunter-blade',
    name: '猎人长刃',
    type: '刀剑',
    cat: 'equip',
    slot: 'weapon',
    rarity: 'rare',
    glyph: 'g-sword',
    stats: [
      ['锋芒', '68 - 92'],
      ['身法', '+16'],
    ],
    flavor: '刀背留着一排细齿，据说原是用来剥兽皮的。',
  }),
  Object.freeze({
    u: 'hunter-helm',
    name: '兽骨轻盔',
    type: '轻甲',
    cat: 'equip',
    slot: 'helm',
    rarity: 'rare',
    glyph: 'g-helm-l',
    stats: [
      ['护体', '+66'],
      ['定神', '+12'],
    ],
    flavor: '额前那枚骨片磨得很亮，猎人说它挡过一次角撞。',
  }),
  Object.freeze({
    u: 'hunter-chest',
    name: '兽皮护甲',
    type: '轻甲',
    cat: 'equip',
    slot: 'chest',
    rarity: 'rare',
    glyph: 'g-chest-l',
    stats: [
      ['护体', '+94'],
      ['身法', '+18'],
    ],
    flavor: '硝过的厚皮还带着草木味，针脚粗，却极耐磨。',
  }),
  Object.freeze({
    u: 'hunter-boots',
    name: '猎风战靴',
    type: '靴履',
    cat: 'equip',
    slot: 'boots',
    rarity: 'rare',
    glyph: 'g-boots-l',
    stats: [
      ['护体', '+58'],
      ['身法', '+15'],
      ['疾行', '+7%'],
    ],
    flavor: '靴筒里缝着一圈软草，走上一天也不磨脚。',
  }),
]);
export const ITEMS = Object.fromEntries(
  [
    ...BOSS_LOOT_ITEMS,
    ...MONSTER_EQUIPMENT,
    {
      u: 'herb',
      name: '回气草',
      type: '治疗物品',
      cat: 'usable',
      rarity: 'common',
      stats: [['怒气', '+30']],
      flavor: '服用后恢复怒气。',
    },
  ].map((item) => [item.u, item])
);
const BAG_GLYPH_TO_ICON = {
  // 头盔
  'g-helm-h': 'i-helm-h',
  'g-helm-l': 'i-helm-l',
  'g-helmet': 'i-helm-h',
  // 胸甲
  'g-chest-h': 'i-chest-h',
  'g-chest-l': 'i-chest-l',
  'g-armor': 'i-chest-h',
  'g-body': 'i-chest-l',
  // 腿甲
  'g-legs-h': 'i-legs-h',
  'g-legs-l': 'i-legs-l',
  // 战靴
  'g-boots-h': 'i-boots-h',
  'g-boots-l': 'i-boots-l',
  'g-boots': 'i-boots-l',
  // 武器
  'g-sword': 'i-weapon-b',
  'g-axe': 'i-weapon-h',
  'g-bow': 'i-weapon-r',
  'g-staff': 'i-weapon-x',
  // 佩饰 / 丹散 / 材料
  'g-ring': 'i-ring-d',
  'g-talis': 'i-talis-d',
  'g-pill': 'i-pill-d',
  'g-elixir': 'i-elixir-d',
  'g-scroll': 'i-scroll-d',
  'g-ore': 'i-ore-d',
  'g-herb': 'i-herb-d',
  'g-silk': 'i-silk-d',
  'g-coal': 'i-coal-d',
  'g-fang': 'i-fang-d',
  'g-belt': 'i-silk-d',
};
export function itemIcon(item) {
  return GEAR_ICONS[item?.u === 'herb' ? 'i-herb-d' : (BAG_GLYPH_TO_ICON[item?.glyph] || 'i-material')];
}
