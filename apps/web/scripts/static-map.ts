/**
 * Génère public/images/plan-mairie.webp : plan de situation de la mairie à
 * partir de tuiles OpenStreetMap (attribution affichée sur le site).
 * À relancer seulement si la mairie déménage : node scripts/static-map.ts [lat] [lon]
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const [lat = 47.689402, lon = 1.016163] = process.argv.slice(2).map(Number);
const ZOOM = 17;
const WIDTH = 1200;
const HEIGHT = 800;
const TILE = 256;

const worldX = ((lon + 180) / 360) * 2 ** ZOOM * TILE;
const rad = (lat * Math.PI) / 180;
const worldY = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** ZOOM * TILE;
const left = worldX - WIDTH / 2;
const top = worldY - HEIGHT / 2;

const tiles: { input: Buffer; left: number; top: number }[] = [];
for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + WIDTH) / TILE); tx += 1) {
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + HEIGHT) / TILE); ty += 1) {
    const res = await fetch(`https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`, {
      headers: { 'user-agent': 'SaintAmandLongpre-site/1.0 (plan de situation statique)' },
    });
    if (!res.ok) throw new Error(`Tuile ${tx}/${ty} : ${res.status}`);
    tiles.push({
      input: Buffer.from(await res.arrayBuffer()),
      left: Math.round(tx * TILE - left),
      top: Math.round(ty * TILE - top),
    });
  }
}

const canvas = sharp({
  create: {
    width: WIDTH + 2 * TILE,
    height: HEIGHT + 2 * TILE,
    channels: 3,
    background: '#f2efe9',
  },
});
const shifted = tiles.map((t) => ({ ...t, left: t.left + TILE, top: t.top + TILE }));
const composed = await canvas.composite(shifted).png().toBuffer();
const out = await sharp(composed)
  .extract({ left: TILE, top: TILE, width: WIDTH, height: HEIGHT })
  .modulate({ saturation: 0.75 })
  .webp({ quality: 78 })
  .toBuffer();
await writeFile(new URL('../public/images/plan-mairie.webp', import.meta.url), out);
console.log(`Plan écrit (${(out.length / 1024).toFixed(0)} Ko).`);
