import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Manifest path is required');

const curatedTitles = {
  'img-1035': 'Friday soundcheck under the Horizon lights',
  'img-1141': 'The Big Top ready for opening night',
  'img-1142': 'First beams across the Friday stage',
  'img-1145': 'Friday guitars beneath the Big Top',
  'img-1152': 'Acoustic set in the afternoon light',
  'img-1159': 'Opening-day vocals under green lights',
  'img-1230': 'Festival tables filling in the sunshine',
  'img-1261': 'The VW booth before the evening sets',
  'img-1261-2': 'Long exposure around the VW booth',
  'img-1401': 'Sunset silhouettes beside the stage',
  'img-1443': 'Friday crowd with hands in the air',
  'img-1461': 'A smile from the Friday stage',
  'img-1490': 'The band seen from stage left',
  'img-1491': 'Friday set through the stage haze',
  'img-1502': 'Banjo under the green lights',
  'img-1503': 'Highstool Prophets banjo close-up',
  'img-1507': 'Highstool Prophets lead the Friday session',
  'img-1508': 'Friday session in full voice',
  'img-1519': 'Bodhrán rhythm under the Big Top',
  'img-1548': 'Final chorus on Friday night',
  'img-9480': 'Electrad open the Saturday stage',
  'img-9492': 'The Circus Ponies brass line',
  'img-9582': 'Saturday saxophone in the sunshine',
  'img-9595': 'A welcome from the VW DJ booth',
  'img-6656': 'Guitar under the Saturday stage roof',
  'img-9642': 'Saturday drums beneath the cymbals',
  'aead8131-f3ec-4a6f-8c0c-d829414ad7d9': 'Green shades in the afternoon crowd',
  '7db6adb8-9cc3-4907-a3ed-7d0101bf006d': 'Festival style in the Ballybunion sun',
  'img-9696': "Saturday queue outside McMunn's",
  'img-9772': 'Backstage view of the Saturday set',
  'img-9781': 'Electrad vocals from stage left',
  'img-9785': 'Electrad bring the harmonies',
  'img-9801': 'Circus Ponies brass in red',
  'img-9803': 'The Circus Ponies ringmaster',
  'img-9824': 'The Circus Ponies in full swing',
  'img-9832': 'Ringmaster in the spotlight',
  'img-9844': 'Saturday crowd beneath the red canvas',
  'img-9879': 'Saxophone solo under the Big Top',
  'img-9903': 'Brass section through the stage smoke',
  '0b4f2bd0-25aa-43e9-8e7b-5bf6415b82c4': 'The ringmaster calls to the crowd',
  'img-0029': 'Saturday performer at the front of the stage',
  'img-6687': 'Jenny Greene at the decks',
  'img-0050': 'Golden light over the Saturday crowd',
  'img-0073': 'Saturday night fills the Big Top',
  'img-0077': 'Front rows in the evening glow',
  'img-0078': 'Dancing into Saturday night',
  'dji-20260711220414-0346-d': 'Horizon Festival above Ballybunion',
  'a70cfe7b-6525-4131-b2f1-db07ba2d03c0': 'Friends together at the Big Top',
  'eeadb45b-753c-4f37-bb6d-8e3e3de19aea': 'Saturday style beside the stage',
  'img-0171': 'Jenny Greene through the golden haze',
  'img-0193': 'Electrad vocalist in the spotlight',
  'img-6188': 'One last Saturday festival portrait',
  '5436c355-3518-4794-be64-4d0451139ed7': 'Friends after the Saturday finale',
  'img-6197': 'Saturday night smiles after midnight',
  'copy-a4569cdf-5d61-4df1-91cd-585cf915354a': 'Saturday saxophone from the crowd',
  'copy-8d45bb47-ef95-4c2f-9942-51df6b0bc12d': 'Saturday vocalist in the golden light',
  '9e5ad0f8-7c67-4e3c-92a7-ed202af33d76': 'Circus Ponies saxophone in red',
  'img-6398': 'Sunday smiles in the festival village',
  'dji-20260712140635-0359-d': 'Festival site on the Kerry coast',
  'dji-20260712141944-0388-d': 'Ballybunion and the Atlantic from above',
  'img-0298': 'Sunday vocals at the front of the stage',
  'img-0504': 'Four friends beneath the rainbow flag',
  'img-0515': 'Bingo Loco host ready for Sunday',
  'img-0540': 'Sunday crowd with every hand raised',
  'img-0550': 'Bingo Loco takes the front row',
  'img-0551': 'Bingo Loco calls across the Big Top',
  'img-0560': 'Bingo Loco from behind the stage',
  '576159d7-d976-4179-a847-367b497b1030': 'Sunday DJ at the VW decks',
  'efb93e84-ab17-4bcc-a215-46d0a2a3f6f7': 'Sunday sunshine in the festival village',
  'img-0707': 'Masked performer under green lasers',
  'img-0708': 'The mask behind the decks',
  'img-0748': 'Close-up beneath the green light',
  'img-0767': 'VW booth against the Atlantic sunset',
  'img-0781': 'Sunday crowd washed in blue',
  'img-0800': 'DJ set under the Sunday lights',
  'img-0802': 'Sunday DJ in the blue haze',
  'img-0806': 'Microphone in hand for the final set',
  'img-0810': 'Closing DJ set at Horizon Festival',
  'img-0823': 'Green shades in the Sunday crowd',
  'img-6546': 'Masked finale under the lasers',
  'dji-20260708205542-0111-d': 'Ballybunion Castle and beach from above',
  'dji-20260709122929-0120-d': 'The Big Top beside the Atlantic'
};

const curatedDates = {
  'aead8131-f3ec-4a6f-8c0c-d829414ad7d9': '2026-07-11T19:00:00+01:00',
  '7db6adb8-9cc3-4907-a3ed-7d0101bf006d': '2026-07-11T19:05:00+01:00',
  '0b4f2bd0-25aa-43e9-8e7b-5bf6415b82c4': '2026-07-11T20:00:00+01:00',
  'img-6656': '2026-07-11T18:00:00+01:00',
  'img-6687': '2026-07-11T20:30:00+01:00',
  'copy-a4569cdf-5d61-4df1-91cd-585cf915354a': '2026-07-11T16:25:00+01:00',
  'copy-8d45bb47-ef95-4c2f-9942-51df6b0bc12d': '2026-07-11T22:00:00+01:00',
  '9e5ad0f8-7c67-4e3c-92a7-ed202af33d76': '2026-07-11T20:10:00+01:00',
  'eeadb45b-753c-4f37-bb6d-8e3e3de19aea': '2026-07-11T22:30:00+01:00',
  '576159d7-d976-4179-a847-367b497b1030': '2026-07-12T20:00:00+01:00',
  'efb93e84-ab17-4bcc-a215-46d0a2a3f6f7': '2026-07-12T20:05:00+01:00'
};

const days = {
  '2026-07-10': { festivalDay: 'day-1', dayLabel: 'Day 1', dayDate: 'Friday 10 July' },
  '2026-07-11': { festivalDay: 'day-2', dayLabel: 'Day 2', dayDate: 'Saturday 11 July' },
  '2026-07-12': { festivalDay: 'day-3', dayLabel: 'Day 3', dayDate: 'Sunday 12 July' },
  '2026-07-08': { festivalDay: 'setup', dayLabel: 'Setup', dayDate: 'Wednesday 8 July' },
  '2026-07-09': { festivalDay: 'setup', dayLabel: 'Setup', dayDate: 'Thursday 9 July' }
};

const localFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Dublin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23'
});

function metadataDate(value) {
  if (!value || value === '(null)') return null;
  return new Date(value.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \+0000$/,
    '$1T$2Z'
  ));
}

function eventDate(date) {
  const parts = Object.fromEntries(localFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) >= 4) return calendarDate;
  const previous = new Date(`${calendarDate}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

const lines = (await readFile(manifestPath, 'utf8')).trim().split('\n').filter(Boolean);
const sourceManifest = lines.map((line) => {
  const { id, type, sourceName, sourceSha256 } = JSON.parse(line);
  return { id, type, sourceName, sourceSha256 };
});
const media = lines.map((line) => {
  const { capturedAtRaw, sourceName, sourceSha256, ...item } = JSON.parse(line);
  const title = curatedTitles[item.id];
  if (!title) throw new Error(`${item.id}: missing curated title`);
  const curatedDate = curatedDates[item.id];
  const date = curatedDate ? new Date(curatedDate) : metadataDate(capturedAtRaw);
  if (!date || Number.isNaN(date.valueOf())) throw new Error(`${item.id}: missing valid capture date`);
  const dayKey = eventDate(date);
  const day = days[dayKey];
  if (!day) throw new Error(`${item.id}: event date ${dayKey} is outside the curated festival archive`);
  const mediaKind = item.type === 'video' ? 'film' : 'photograph';
  return {
    ...item,
    title,
    description: `${title}, an official Horizon Festival Ballybunion 2026 ${mediaKind}.`,
    alt: `${title} at Horizon Festival Ballybunion 2026`,
    capturedAt: date.toISOString(),
    dateSource: curatedDate ? 'curated' : 'metadata',
    orientation: item.width === item.height ? 'square' : item.width > item.height ? 'landscape' : 'portrait',
    sharePath: `media/${item.id}/`,
    ...day
  };
}).sort((a, b) => {
  const order = { 'day-1': 1, 'day-2': 2, 'day-3': 3, setup: 4 };
  return order[a.festivalDay] - order[b.festivalDay]
    || a.capturedAt.localeCompare(b.capturedAt)
    || a.id.localeCompare(b.id);
});

const duplicateTitles = media
  .map((item) => item.title)
  .filter((title, index, titles) => titles.indexOf(title) !== index);
if (duplicateTitles.length) throw new Error(`Duplicate titles: ${[...new Set(duplicateTitles)].join(', ')}`);

await writeFile('assets/data/gallery.json', `${JSON.stringify(media, null, 2)}\n`);
await writeFile('assets/data/source-manifest.json', `${JSON.stringify(sourceManifest, null, 2)}\n`);
console.log(`Wrote ${media.length} curated gallery records`);
