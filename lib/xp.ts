export function getLevel(xp: number): string {
  if (xp <= 50) return 'Bayi AI 👶';
  if (xp <= 150) return 'AI Tadika 🧸';
  if (xp <= 500) return 'AI Sekolah Rendah 📚';
  return 'Professor AI 🧠';
}

export function getXPToNextLevel(xp: number): { current: number; max: number; label: string } {
  if (xp <= 50) return { current: xp, max: 50, label: 'AI Tadika 🧸' };
  if (xp <= 150) return { current: xp - 50, max: 100, label: 'AI Sekolah Rendah 📚' };
  if (xp <= 500) return { current: xp - 150, max: 350, label: 'Professor AI 🧠' };
  return { current: xp - 500, max: Infinity, label: 'GOD MODE 👑' };
}

export const THINKING_MESSAGES = [
  'Tengah gali jawapan kat kubur...',
  'Kejap, tengah tanya jiran sebelah...',
  'Server tengah berasap ni, chill...',
  'AI tengah berak jap, tunggu eh...',
  'Tengah Google, jangan risau...',
  'Neuron tengah loading... 3%...',
  'Tanya tok batin dulu sekejap...',
  'Tengah scroll Reddit untuk jawapan...',
  'AI tengah minum kopi dulu...',
  'Tengah sembang dengan ChatGPT jap...',
  'Loading wisdom dari alam ghaib...',
  'Tengah baca buku dalam gelap...',
];

export const EXPIRED_MESSAGES = [
  'AI dah pengsan. Cuba lagi.',
  'Habis bateri. Cas dulu la.',
  'AI tersalah telan soalan tu. Maaf.',
  'Timeout! AI tengah tidur rupanya.',
  'Oops. AI terlupa nak jawab. Maaflah.',
];
