import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Manifest path is required');

const curatedTitles = {
  '0b4f2bd0-25aa-43e9-8e7b-5bf6415b82c4': 'Jenny Greene — deep in the mix',
  '5436c355-3518-4794-be64-4d0451139ed7': 'On stage with The Circus Ponies',
  '576159d7-d976-4179-a847-367b497b1030': 'Backstage, a minute to stage',
  '7db6adb8-9cc3-4907-a3ed-7d0101bf006d': 'Percussion under the rig',
  '995edbaf-bcee-40a5-895a-868f6dfc3e72': 'The Rising — golden hour',
  '9e5ad0f8-7c67-4e3c-92a7-ed202af33d76': 'Brass in the red light',
  'a70cfe7b-6525-4131-b2f1-db07ba2d03c0': 'The Circus Ponies — trumpet line',
  'b0794460-8ad2-4dd3-8b2c-9ec16d52dd3c': "Sunset queue at McMunn's",
  'eeadb45b-753c-4f37-bb6d-8e3e3de19aea': 'Jenny Greene — closing set',
  'efb93e84-ab17-4bcc-a215-46d0a2a3f6f7': 'DJ Marty Guilfoyle — VW decks',
  'img-0193': 'Front row on the cliff',
  'img-0298': 'Straight down the mic',
  'img-0550': "White Claw o'clock",
  'img-0823': 'Green shades in the crowd',
  'img-1261-2': 'Long exposure under the lights',
  'img-1401': 'Ringmaster of The Circus Ponies',
  'img-6687': 'Sunset pints with friends',
  'img-9480': 'The Circus Ponies — full brass',
  'img-9492': 'Bingo Loco — crowd goes up',
  'img-9595': 'Best mates at the Big Top',
  'img-9642': 'Front of house, Friday',
  'img-9696': 'Saturday session',
  'img-9772': 'Vocals into the smoke',
  'tezza-2439': 'DJ Marty Guilfoyle — spin',
  'dji-20260711220414-0346-d': 'Horizon Festival above Ballybunion',
  'dji-20260709122929-0120-d': 'The Big Top beside the Atlantic',
  'dji-20260712140635-0359-d': 'Festival site on the Kerry coast',
  'dji-20260712141944-0388-d': 'Ballybunion from above',
  'dji-20260708205542-0111-d': 'Big Top aerial film',
  'copy-a4569cdf-5d61-4df1-91cd-585cf915354a': 'Backstage vertical film 01',
  'copy-8d45bb47-ef95-4c2f-9942-51df6b0bc12d': 'Backstage vertical film 02'
};

const lines = (await readFile(manifestPath, 'utf8')).trim().split('\n').filter(Boolean);
const media = lines.map((line, index) => {
  const item = JSON.parse(line);
  const title = curatedTitles[item.id] ?? `Horizon Festival backstage — frame ${String(index + 1).padStart(2, '0')}`;
  return {
    ...item,
    title,
    alt: item.type === 'video'
      ? `${title}, video from Horizon Festival Ballybunion 2026`
      : `${title}, official Horizon Festival Ballybunion 2026 photograph`
  };
});

await writeFile('assets/data/gallery.json', `${JSON.stringify(media, null, 2)}\n`);
console.log(`Wrote ${media.length} gallery records`);

