const PACK_NAMES = [
  "Mario",
  "Luigi",
  "Toad",
  "Yoshi",
  "Wario",
  "Waluigi",
  "Bowser",
  "Peach",
  "Rosalina",
  "Donkey Kong",
  "Diddy Kong",
  "Dixie",
  "Mega Man",
  "Proto Man",
  "Zero",
  "Roll",
  "Bass",
  "X",
  "Axl",
  "Sonic",
  "Tails",
  "Knuckles",
  "Shadow",
  "Amy",
  "Rouge",
  "Silver",
  "Blaze",
  "Cream",
  "Link",
  "Zelda",
  "Ganondorf",
  "Impa",
  "Sheik",
  "Saria",
  "Darunia",
  "Ryu",
  "Ken",
  "Chun-Li",
  "Blanka",
  "Guile",
  "Zangief",
  "Cammy",
  "Pac-Man",
  "Blinky",
  "Pinky",
  "Inky",
  "Clyde",
  "Samus",
  "Ridley",
  "Simon",
  "Alucard",
  "Richter",
  "Bomberman",
  "Kirby",
  "Meta Knight",
  "Dedede",
  "Pikachu",
  "Charizard",
  "Mewtwo",
  "Terra",
  "Kefka",
  "Cloud",
  "Tifa",
  "Aerith",
  "Sephiroth",
  "Barret",
  "Squall",
  "Tidus",
  "Yuna",
  "Kyo",
  "Iori",
  "Terry",
  "Mai",
  "Athena",
  "Contra Bill",
  "Contra Lance",
  "Liu Kang",
  "Raiden",
  "Scorpion",
  "Sub-Zero",
  "Kitana",
];

const used = new Set<string>();

export function getNextPackName(): string {
  for (const name of PACK_NAMES) {
    if (!used.has(name)) {
      used.add(name);
      return `Simulado ${name}`;
    }
  }
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Simulado Pack-${rand}`;
}

export function getPackNameByIndex(index: number): string {
  if (index < PACK_NAMES.length) {
    return `Simulado ${PACK_NAMES[index]}`;
  }
  return `Simulado Pack-${index + 1}`;
}

export { PACK_NAMES };
