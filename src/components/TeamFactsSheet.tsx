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

  // Mobile: Bottom sheet with backdrop
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />

        {/* Bottom Sheet */}
        <div
          ref={sheetRef}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-t-3xl p-6 pb-8 animate-slide-up border-t border-white/10 shadow-2xl"
          style={{ maxHeight: '85vh', overflowY: 'auto' }}
        >
          {/* Handle bar */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full" />

          <div className="mt-2">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Popover
  return (
    <div
      ref={sheetRef}
      className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-[400px] max-w-[90vw] bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-xl rounded-2xl p-5 animate-pop-in border border-white/10 shadow-2xl"
    >
      {/* Arrow */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900/98 border-l border-t border-white/10 rotate-45" />

      {content}
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
        className={`w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all text-white/60 hover:text-white/90 text-sm ${className}`}
        aria-label={`Info sur ${teamName}`}
        style={{ minWidth: '44px', minHeight: '44px', padding: '8px' }}
      >
        ℹ️
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
