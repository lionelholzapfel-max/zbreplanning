import { Avatar } from './Avatar';

interface Holder {
  member_name: string;
  member_slug: string;
}

interface RecordCardProps {
  label: string;
  value: string | number;
  detail?: string;
  /** One holder, or several on a tie. */
  holders: Holder[];
}

/**
 * One record in the unified Records grid. Surface-1 + top-light, the value in
 * `.score`. No gold (reserved for podium/Drère), no gradient, no emoji.
 */
export function RecordCard({ label, value, detail, holders }: RecordCardProps) {
  return (
    <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5">
      <p className="eyebrow">{label}</p>
      <div className="mt-3 flex items-center gap-2.5 min-w-0">
        <div className="flex -space-x-2 shrink-0">
          {holders.slice(0, 3).map((h) => (
            <Avatar key={h.member_slug} slug={h.member_slug} name={h.member_name} size={24} />
          ))}
        </div>
        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
          {holders.map((h) => h.member_name.split(' ')[0]).join(' & ')}
        </span>
      </div>
      <p className="mt-3 score text-[28px] text-[var(--text-primary)]">{value}</p>
      {detail && <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{detail}</p>}
    </div>
  );
}
