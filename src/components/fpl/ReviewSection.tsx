// The weekly review: AI-written prose (when available) around code-computed facts.
import { MANAGER_BY_SLUG, type ManagerSlug } from '@/lib/fpl/config';
import type { ReviewRow } from '@/lib/fpl/review';
import type { GameweekFacts } from '@/lib/fpl/stats';
import { Face, Name, SectionHead, cssColor } from './ui';
import { SoundButton } from './interactive';

const VERDICT: Record<'top' | 'correct' | 'flop', { label: string; color: string }> = {
  top: { label: 'Top', color: 'var(--f-green)' },
  correct: { label: 'Correct', color: 'var(--f-muted)' },
  flop: { label: 'Flop', color: 'var(--f-down)' },
};

function AwardCard({
  kind,
  slugs,
  pts,
  text,
  sound,
}: {
  kind: 'drere' | 'mzi';
  slugs: ManagerSlug[];
  pts: number | null;
  text?: string;
  sound?: { src: string; label: string } | null;
}) {
  if (!slugs.length) return null;
  const isDrere = kind === 'drere';
  return (
    <div
      className={`f-card p-5 f-rule ${isDrere ? 'f-champ' : ''}`}
      style={{ ['--c' as string]: isDrere ? 'var(--f-gold)' : 'var(--f-down)' }}
    >
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          {slugs.map((s) => (
            <Face key={s} slug={s} size={64} className={isDrere ? '' : 'grayscale'} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="f-label" style={{ color: isDrere ? 'var(--f-gold)' : 'var(--f-down)' }}>
            {isDrere ? 'Drère de la semaine' : 'Mzi de la semaine'}
          </div>
          <div className="f-display text-2xl font-bold leading-tight">
            {slugs.map((s) => MANAGER_BY_SLUG[s].firstName).join(' & ')}
          </div>
          {pts !== null ? <div className="f-num text-[var(--f-muted)]">{pts} pts</div> : null}
        </div>
      </div>
      {text ? <p className="mt-4 text-[15px] text-[#d9dce2]">{text}</p> : null}
      {sound ? (
        <div className="mt-4">
          <SoundButton src={sound.src} label={sound.label} />
        </div>
      ) : null}
    </div>
  );
}

function songFor(row: ReviewRow | null): { src: string; label: string } | null {
  // Our stored copy first (Suno's URL is temporary), behind the login.
  if (row?.song_status === 'completed' && row.song_storage_path) return { src: `/api/fpl/song/${row.gw}`, label: 'Sa chanson' };
  if (row?.song_status === 'completed' && row.song_audio_url) return { src: row.song_audio_url, label: 'Sa chanson' };
  return null;
}

export function ReviewSection({ row, facts }: { row: ReviewRow | null; facts: GameweekFacts }) {
  const review = row?.status === 'ready' ? row.review : null;
  const pts = (slug?: ManagerSlug) => facts.managers.find((m) => m.slug === slug)?.netPoints ?? null;
  const song = songFor(row);

  return (
    <section className="mb-10" aria-labelledby="review-title">
      <SectionHead id="review-title" title={`La review · GW${facts.gameweek}`} right={facts.fplAverage !== null ? `Moyenne FPL ${facts.fplAverage} pts` : undefined} />

      {review ? (
        <div className="mb-5">
          <h3 className="f-display text-3xl md:text-4xl font-bold leading-[1.05]">{review.headline}</h3>
          <p className="mt-3 text-[16px] text-[#d9dce2] max-w-3xl">{review.intro}</p>
        </div>
      ) : (
        <p className="mb-5 text-[var(--f-muted)]">
          {row?.status === 'generating'
            ? 'La review est en cours d’écriture…'
            : 'La review écrite arrive dès que FPL a validé la GW. En attendant, les chiffres parlent.'}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <AwardCard
          kind="drere"
          slugs={facts.drere as ManagerSlug[]}
          pts={pts(facts.drere[0] as ManagerSlug)}
          text={review?.drere.text}
          sound={song}
        />
        <AwardCard
          kind="mzi"
          slugs={facts.mzi as ManagerSlug[]}
          pts={pts(facts.mzi[0] as ManagerSlug)}
          text={review?.mzi.text}
          sound={{ src: '/sounds/mzi.m4a', label: 'Le son du Mzi' }}
        />
      </div>
      {row?.song_status === 'generating' ? (
        <p className="-mt-3 mb-6 text-sm text-[var(--f-muted)]">La chanson du Drère est en cours de composition (5 à 10 minutes).</p>
      ) : null}

      {review ? (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {review.managers.map((mr) => {
              const fact = facts.managers.find((f) => f.slug === mr.slug);
              const v = VERDICT[mr.verdict];
              return (
                <article key={mr.slug} className="f-card f-rule p-4" style={cssColor(mr.slug)}>
                  <header className="flex items-center gap-3 mb-2">
                    <Face slug={mr.slug} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Name slug={mr.slug} className="f-display text-lg" />
                        <span className="f-label px-1.5 py-0.5 rounded" style={{ color: v.color, border: `1px solid ${v.color}` }}>
                          {v.label}
                        </span>
                      </div>
                      <div className="text-sm text-[var(--f-muted)] truncate">« {mr.title} »</div>
                    </div>
                    {fact?.netPoints !== null && fact?.netPoints !== undefined ? (
                      <div className="f-num text-2xl">{fact.netPoints}</div>
                    ) : null}
                  </header>
                  <p className="text-[15px] text-[#d9dce2]">{mr.summary}</p>
                  {mr.goodCalls.length ? (
                    <ul className="mt-3 space-y-1 text-sm">
                      {mr.goodCalls.map((g, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[var(--f-green)] font-bold" aria-hidden="true">+</span>
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {mr.badCalls.length ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {mr.badCalls.map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[var(--f-down)] font-bold" aria-hidden="true">−</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-3 text-sm text-[var(--f-muted)]">
                    <span className="f-label mr-1">Conseil</span>
                    {mr.advice}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <div className="f-card f-rule p-4" style={cssColor(review.bestTeam.slug)}>
              <div className="f-label mb-1">Meilleure équipe pour la suite</div>
              <Name slug={review.bestTeam.slug} className="f-display text-lg" />
              <p className="text-sm mt-1 text-[#d9dce2]">{review.bestTeam.why}</p>
            </div>
            <div className="f-card p-4">
              <div className="f-label mb-1">Doit faire des changements</div>
              <ul className="space-y-2">
                {review.mustChange.map((c) => (
                  <li key={c.slug} className="text-sm">
                    <Name slug={c.slug} /> — <span className="text-[#d9dce2]">{c.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="f-card p-4">
              <div className="f-label mb-1">Le prono de la rédaction</div>
              <p className="text-sm text-[#d9dce2]">{review.prediction}</p>
            </div>
          </div>
        </>
      ) : (
        <FactsFallback facts={facts} />
      )}
    </section>
  );
}

/** Deterministic mini-review when no AI review exists (yet). */
function FactsFallback({ facts }: { facts: GameweekFacts }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {facts.managers.map((m) => (
        <article key={m.slug} className="f-card f-rule p-4" style={cssColor(m.slug)}>
          <header className="flex items-center gap-3 mb-2">
            <Face slug={m.slug} size={36} />
            <Name slug={m.slug} className="f-display text-lg flex-1" />
            <span className="f-num text-2xl">{m.netPoints ?? '—'}</span>
          </header>
          <ul className="text-sm space-y-1 text-[#d9dce2]">
            {m.captain ? (
              <li>
                Capitaine {m.captain.name} : {m.captain.rawPts * m.captain.multiplier} pts
                {m.bestPossibleCaptain && m.bestPossibleCaptain.rawPts > m.captain.rawPts
                  ? ` (${m.bestPossibleCaptain.name} en aurait fait ${m.bestPossibleCaptain.rawPts * m.captain.multiplier})`
                  : ' — le bon choix'}
              </li>
            ) : null}
            {m.topScorers[0] ? <li>Meilleur joueur : {m.topScorers[0].name} ({m.topScorers[0].pts} pts)</li> : null}
            {m.benchPoints >= 8 ? <li>{m.benchPoints} pts laissés sur le banc</li> : null}
            {m.hitCost ? <li>Hit : −{m.hitCost} pts</li> : null}
            {m.chip ? <li>Chip joué : {m.chip}</li> : null}
          </ul>
        </article>
      ))}
    </div>
  );
}
