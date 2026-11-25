#!/usr/bin/env node
// Collecteur d'historique des retards (BestWays).
// Toutes les 10 min (GitHub Actions) : interroge le flux global PRIM « estimated-timetable » (SIRI Lite),
// garde les passages des 15 prochaines minutes qui ont une heure prévue ET une heure estimée,
// et cumule le retard par ligne, par arrêt et par tranche horaire dans stats.json.
//
// Usage : PRIM_API_KEY=... node collector/collect.js <stats.json existant ou absent> <sortie stats.json>
'use strict';
const fs = require('fs');

const [, , IN, OUT] = process.argv;
const KEY = process.env.PRIM_API_KEY;
if (!KEY) { console.error('PRIM_API_KEY manquante'); process.exit(2); }

// Tranches horaires (heure de Paris) : nuit, pointe matin, journée, pointe soir, soirée
const BUCKETS = [[0, 5], [5, 7], [7, 10], [10, 16], [16, 20], [20, 24]];
function parisHourDow(ms) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', weekday: 'short', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { hour: +p.hour % 24, weekend: p.weekday === 'Sat' || p.weekday === 'Sun' };
}
function bucketOf(ms) {
  const { hour, weekend } = parisHourDow(ms);
  const b = BUCKETS.findIndex(([a, z]) => hour >= a && hour < z);
  return (weekend ? 6 : 0) + b; // 0-5 semaine, 6-11 week-end
}
const tail = (ref) => String(ref || '').split(':').filter(Boolean).pop() || '';

(async () => {
  let stats = { version: 1, since: new Date().toISOString(), runs: 0, samples: 0, lines: {} };
  if (IN && fs.existsSync(IN)) { try { stats = JSON.parse(fs.readFileSync(IN, 'utf8')); } catch (e) { console.error('stats illisible, on repart de zéro'); } }

  const res = await fetch('https://prim.iledefrance-mobilites.fr/marketplace/estimated-timetable?LineRef=ALL', { headers: { apikey: KEY, Accept: 'application/json' } });
  if (!res.ok) { console.error('PRIM HTTP', res.status); process.exit(res.status === 429 ? 0 : 1); }
  const j = await res.json();
  const now = Date.now();
  let added = 0;
  const frames = j.Siri.ServiceDelivery.EstimatedTimetableDelivery[0].EstimatedJourneyVersionFrame || [];
  for (const fr of frames) for (const v of fr.EstimatedVehicleJourney || []) {
    const line = tail(v.LineRef && v.LineRef.value);
    const mode = (v.VehicleMode && v.VehicleMode[0]) || '';
    if (!line) continue;
    for (const c of (v.EstimatedCalls && v.EstimatedCalls.EstimatedCall) || []) {
      const aimed = Date.parse(c.AimedArrivalTime || c.AimedDepartureTime || '');
      const exp = Date.parse(c.ExpectedArrivalTime || c.ExpectedDepartureTime || '');
      if (isNaN(aimed) || isNaN(exp)) continue;
      if (exp < now - 60000 || exp > now + 15 * 60000) continue; // prédiction proche = fiable
      const status = String(c.ArrivalStatus || c.DepartureStatus || '').toLowerCase();
      const cancelled = status.includes('cancel');
      const d = Math.max(-300, Math.min(3600, (exp - aimed) / 1000)); // secondes
      const L = stats.lines[line] || (stats.lines[line] = { mode, n: 0, sum: 0, sq: 0, o2: 0, o5: 0, cx: 0, b: {}, s: {} });
      L.mode = mode || L.mode;
      if (cancelled) { L.cx++; continue; }
      L.n++; L.sum += d; L.sq += d * d; if (d > 120) L.o2++; if (d > 300) L.o5++;
      const bk = bucketOf(aimed);
      const B = L.b[bk] || (L.b[bk] = [0, 0, 0]); B[0]++; B[1] += d; if (d > 120) B[2]++;
      const stop = tail(c.StopPointRef && c.StopPointRef.value);
      if (stop) { const S = L.s[stop] || (L.s[stop] = [0, 0, 0]); S[0]++; S[1] += d; if (d > 120) S[2]++; }
      added++;
    }
  }
  stats.runs++; stats.samples += added; stats.updated = new Date().toISOString();
  // résumé lisible par l'appli : retard moyen (min) et part > 2 min par ligne, avec assez d'échantillons
  stats.summary = {};
  for (const [id, L] of Object.entries(stats.lines)) {
    if (L.n < 30) continue;
    stats.summary[id] = { mean: +(L.sum / L.n / 60).toFixed(2), p2: +(L.o2 / L.n).toFixed(3), p5: +(L.o5 / L.n).toFixed(3), n: L.n, cancel: +(L.cx / (L.n + L.cx)).toFixed(3), mode: L.mode };
  }
  fs.writeFileSync(OUT, JSON.stringify(stats));
  console.log(`+${added} passages (total ${stats.samples}, ${stats.runs} relevés, ${Object.keys(stats.summary).length} lignes avec historique)`);
})().catch((e) => { console.error(e); process.exit(1); });
