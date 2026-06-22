'use client';

import { useEffect, useRef, useState } from 'react';
import { getTeamFacts, type TeamFacts } from '@/data/team-facts';

// Flag mapping (copied from world-cup page for consistency)
const FLAGS: Record<string, string> = {
  'Maroc': '🇲🇦', 'Portugal': '🇵🇹', 'Espagne': '🇪🇸', 'USA': '🇺🇸',
  'Mexique': '🇲🇽', 'Canada': '🇨🇦', 'Argentine': '🇦🇷', 'Chili': '🇨🇱',
  'Pérou': '🇵🇪', 'Équateur': '🇪🇨', 'Brésil': '🇧🇷', 'Colombie': '🇨🇴',
  'Paraguay': '🇵🇾', 'Uruguay': '🇺🇾', 'Bolivie': '🇧🇴', 'Venezuela': '🇻🇪',
  'France': '🇫🇷', 'Allemagne': '🇩🇪', 'Danemark': '🇩🇰', 'Italie': '🇮🇹',
  'Pays-Bas': '🇳🇱', 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Belgique': '🇧🇪', 'Suisse': '🇨🇭',
  'Autriche': '🇦🇹', 'Pologne': '🇵🇱', 'Serbie': '🇷🇸', 'Croatie': '🇭🇷',
  'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Slovénie': '🇸🇮', 'Turquie': '🇹🇷', 'Albanie': '🇦🇱',
  'Ukraine': '🇺🇦', 'Hongrie': '🇭🇺', 'République tchèque': '🇨🇿', 'Galles': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Japon': '🇯🇵', 'Corée du Sud': '🇰🇷', 'Australie': '🇦🇺', 'Arabie Saoudite': '🇸🇦',
  'Iran': '🇮🇷', 'Qatar': '🇶🇦', 'Indonésie': '🇮🇩', 'Cameroun': '🇨🇲',
  'Nigeria': '🇳🇬', 'Sénégal': '🇸🇳', 'Afrique du Sud': '🇿🇦', 'Côte d\'Ivoire': '🇨🇮',
  'Égypte': '🇪🇬', 'Algérie': '🇩🇿', 'Mali': '🇲🇱', 'RD Congo': '🇨🇩',
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">💡</span>
          <span>Le saviez-vous ?</span>
          <span className="text-2xl ml-1">{getFlag(teamName)}</span>
          <span>{teamName}</span>
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Facts */}
      <div className="space-y-4">
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
      <div className="absolute inset-0 flex items-end md:items-center justify-center pointer-events-none p-4 md:p-8">
        <div
          ref={sheetRef}
          className={`relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-auto ${
            isMobile
              ? 'w-full rounded-t-3xl rounded-b-none -mb-4 pb-8'
              : 'w-[450px] max-w-full rounded-2xl'
          }`}
          style={{ maxHeight: isMobile ? '80vh' : '85vh' }}
        >
          {/* Handle bar - mobile only */}
          {isMobile && (
            <div className="sticky top-0 pt-3 pb-2 bg-gradient-to-b from-gray-900 to-transparent rounded-t-3xl">
              <div className="mx-auto w-12 h-1 bg-white/30 rounded-full" />
            </div>
          )}

          {/* Scrollable content */}
          <div
            className={`overflow-y-auto px-6 pb-6 ${isMobile ? 'pt-2' : 'pt-6'}`}
            style={{ maxHeight: isMobile ? 'calc(80vh - 40px)' : 'calc(85vh - 48px)' }}
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
    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm font-semibold text-white/70 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-white/90 text-sm leading-relaxed">{text}</p>
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
