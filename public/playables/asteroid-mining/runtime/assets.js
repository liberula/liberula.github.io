export const MeteorDefs = [
  {
    id: "rockA",
    file: "assets/runtime/meteor_rockA_strip.webp",
    frames: 6,
    sweet: { center: 0.55, width: 0.26, bonus: 1.6 },
    hp: 20,
    dps: 55
  },
  {
    id: "rockB",
    file: "assets/runtime/meteor_rockB_strip.webp",
    frames: 6,
    sweet: { center: 0.70, width: 0.20, bonus: 1.9 },
    hp: 80,
    dps: 55
  },
  {
    id: "boss",
    file: "assets/runtime/meteor_boss_strip.webp",
    frames: 6,
    sweet: { center: 0.80, width: 0.10, bonus: 2.4 }, // filetinho
    hp: 650,
    dps: 45,
    scale: 1.45,
    isBoss: true
  }
];


export const ShardDef = 
  {
    id: "shards",
    frames: 6,
    file: "assets/runtime/shards_strip.webp",
  };
