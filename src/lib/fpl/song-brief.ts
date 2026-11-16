// Suno brief for the Drère of the GW song (pure, < 500 chars API limit).
import type { GameweekFacts } from './stats';

const SONG_STYLES = ['hip-hop français énergique', 'hymne rock de stade', 'variété française kitsch', 'chant de supporters', 'électro festive'];

export function buildSongBrief(facts: GameweekFacts): string {
  const drere = facts.managers.filter((m) => facts.drere.includes(m.slug));
  const names = drere.map((m) => m.who).join(' et ');
  const style = SONG_STYLES[facts.gameweek % SONG_STYLES.length];
  const losers = facts.managers.filter((m) => !facts.drere.includes(m.slug));
  const d0 = drere[0];
  const parts = [
    `Style musical : ${style}.`,
    `Chanson 100% en FRANÇAIS pour ${names}, « Drère » de la GW${facts.gameweek} de la Fantasy Premier League entre potes (${d0?.netPoints ?? '?'} pts).`,
    d0?.captain ? `Son capitaine ${d0.captain.name} a fait ${d0.captain.rawPts} pts.` : '',
    d0?.topScorers?.[0] ? `Son héros : ${d0.topScorers[0].name} (${d0.topScorers[0].pts} pts).` : '',
    `Glorifie-le, et chambre les autres sans pitié : ${losers.map((l) => `${l.who} ${l.netPoints ?? '?'} pts`).join(', ')}.`,
    `Écris toujours « Drère ».`,
  ].filter(Boolean);
  let brief = parts.join(' ');
  if (brief.length > 500) brief = brief.slice(0, 497) + '…';
  return brief;
}
