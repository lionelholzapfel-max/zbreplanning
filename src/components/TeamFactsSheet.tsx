'use client';

import { useEffect, useRef, useState } from 'react';
import { getTeamFacts, type TeamFacts } from '@/data/team-facts';

// Flag mapping - all 48 World Cup 2026 teams
const FLAGS: Record<string, string> = {
  // Hosts
  'USA': '🇺🇸', 'Mexique': '🇲🇽', 'Canada': '🇨🇦',
  // Europe
  'Allemagne': '🇩🇪', 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Autriche': '🇦🇹', 'Belgique': '🇧🇪',
  'Bosnie-Herzégovine': '🇧🇦', 'Croatie': '🇭🇷', 'Danemark': '🇩🇰', 'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Espagne': '🇪🇸', 'France': '🇫🇷', 'Galles': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Hongrie': '🇭🇺',
  'Italie': '🇮🇹', 'Norvège': '🇳🇴', 'Pays-Bas': '🇳🇱', 'Pologne': '🇵🇱',
  'Portugal': '🇵🇹', 'République tchèque': '🇨🇿', 'Serbie': '🇷🇸', 'Slovénie': '🇸🇮',
  'Suède': '🇸🇪', 'Suisse': '🇨🇭', 'Turquie': '🇹🇷', 'Ukraine': '🇺🇦', 'Albanie': '🇦🇱',
  // South America
  'Argentine': '🇦🇷', 'Brésil': '🇧🇷', 'Chili': '🇨🇱', 'Colombie': '🇨🇴',
  'Équateur': '🇪🇨', 'Paraguay': '🇵🇾', 'Pérou': '🇵🇪', 'Uruguay': '🇺🇾',
  'Bolivie': '🇧🇴', 'Venezuela': '🇻🇪',
  // Africa
  'Afrique du Sud': '🇿🇦', 'Algérie': '🇩🇿', 'Cameroun': '🇨🇲', 'Cap-Vert': '🇨🇻',
  'Côte d\'Ivoire': '🇨🇮', 'Égypte': '🇪🇬', 'Ghana': '🇬🇭', 'Mali': '🇲🇱',
  'Maroc': '🇲🇦', 'Nigeria': '🇳🇬', 'RD Congo': '🇨🇩', 'Sénégal': '🇸🇳', 'Tunisie': '🇹🇳',
  // Asia
  'Arabie Saoudite': '🇸🇦', 'Australie': '🇦🇺', 'Corée du Sud': '🇰🇷', 'Indonésie': '🇮🇩',
  'Irak': '🇮🇶', 'Iran': '🇮🇷', 'Japon': '🇯🇵', 'Jordanie': '🇯🇴',
  'Ouzbékistan': '🇺🇿', 'Qatar': '🇶🇦',
  // CONCACAF & Caribbean
  'Curaçao': '🇨🇼', 'Haïti': '🇭🇹', 'Panama': '🇵🇦',
  // Oceania
  'Nouvelle-Zélande': '🇳🇿',
};

function getFlag(team: string): string {
  return FLAGS[team] || '🏳️';
}

interface TeamFactsSheetProps {
  teamName: string;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

export function TeamFactsSheet({ teamName, isOpen, onClose, triggerRef }: TeamFactsSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true);
  const facts = getTeamFacts(teamName);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        // Don't close if clicking the trigger button
        if (triggerRef?.current?.contains(e.target as Node)) return;
        onClose();
      }
    };

    // Small delay to avoid immediate close on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isOpen]);

  if (!isOpen || !facts) return null;

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-lg sm:text-xl">💡</span>
          <span>Le saviez-vous ?</span>
          <span className="text-xl sm:text-2xl">{getFlag(teamName)}</span>
          <span>{teamName}</span>
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white flex-shrink-0"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Facts */}
      <div className="space-y-3">
        <FactItem emoji="😂" label="Marrante" text={facts.funny} />
        <FactItem emoji="🧠" label="Intelligente" text={facts.smart} />
        <FactItem emoji="⚽" label="Footballistique" text={facts.football} />
      </div>
    </>
  );

  // Both mobile and desktop use fixed positioning to avoid clipping
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet container - flexbox for centering */}
      <div className="absolute inset-0 flex items-end md:items-center justify-center pointer-events-none p-2 sm:p-4 md:p-8">
        <div
          ref={sheetRef}
          className={`relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-auto ${
            isMobile
              ? 'w-full rounded-t-3xl rounded-b-none -mb-2 pb-6'
              : 'w-[450px] max-w-full rounded-2xl'
          }`}
          style={{ maxHeight: isMobile ? '90vh' : '85vh' }}
        >
          {/* Handle bar - mobile only */}
          {isMobile && (
            <div className="sticky top-0 pt-2 pb-1 bg-gradient-to-b from-gray-900 to-transparent rounded-t-3xl">
              <div className="mx-auto w-10 h-1 bg-white/30 rounded-full" />
            </div>
          )}

          {/* Scrollable content */}
          <div
            className={`overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 ${isMobile ? 'pt-1' : 'pt-6'}`}
            style={{ maxHeight: isMobile ? 'calc(90vh - 32px)' : 'calc(85vh - 48px)' }}
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

function FactItem({ emoji, label, text }: { emoji: string; label: string; text: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-lg">{emoji}</span>
        <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-white/90 text-sm leading-snug">{text}</p>
    </div>
  );
}

// Info button component to use next to team names
interface TeamInfoButtonProps {
  teamName: string;
  className?: string;
}

export function TeamInfoButton({ teamName, className = '' }: TeamInfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const facts = getTeamFacts(teamName);

  // Don't render if no facts
  if (!facts) return null;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-[#6366f1]/20 hover:bg-[#6366f1]/40 active:bg-[#6366f1]/50 border border-[#6366f1]/30 hover:border-[#6366f1]/60 transition-all text-xs sm:text-base hover:scale-110 ${className}`}
        aria-label={`Info sur ${teamName}`}
        style={{ minWidth: '32px', minHeight: '32px' }}
      >
        💡
      </button>

      <TeamFactsSheet
        teamName={teamName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={buttonRef as React.RefObject<HTMLElement>}
      />
    </div>
  );
}
