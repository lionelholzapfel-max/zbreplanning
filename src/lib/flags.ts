// Shared flag lookup for match cards. Flags are team identity (content), not chrome.
const FLAGS: Record<string, string> = {
  'Mexique': '🇲🇽', 'Afrique du Sud': '🇿🇦', 'Corée du Sud': '🇰🇷', 'République tchèque': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnie-Herzégovine': '🇧🇦', 'Qatar': '🇶🇦', 'Suisse': '🇨🇭',
  'Brésil': '🇧🇷', 'Maroc': '🇲🇦', 'Haïti': '🇭🇹', 'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Allemagne': '🇩🇪', 'Japon': '🇯🇵', 'Honduras': '🇭🇳', 'Turquie': '🇹🇷',
  'Argentine': '🇦🇷', 'Ouganda': '🇺🇬', 'Australie': '🇦🇺', 'Bahreïn': '🇧🇭',
  'France': '🇫🇷', 'Colombie': '🇨🇴', 'Panama': '🇵🇦', 'Nouvelle-Zélande': '🇳🇿',
  'Espagne': '🇪🇸', 'Pays-Bas': '🇳🇱', 'Équateur': '🇪🇨', 'Corée du Nord': '🇰🇵',
  'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Pologne': '🇵🇱', 'Sénégal': '🇸🇳', 'Slovénie': '🇸🇮',
  'Belgique': '🇧🇪', 'Croatie': '🇭🇷', 'Grèce': '🇬🇷', 'Ukraine': '🇺🇦',
  'Portugal': '🇵🇹', 'Italie': '🇮🇹', 'Irlande': '🇮🇪', 'Égypte': '🇪🇬',
  'USA': '🇺🇸', 'États-Unis': '🇺🇸', 'Chili': '🇨🇱', 'Arabie Saoudite': '🇸🇦',
  'Uruguay': '🇺🇾', 'Nigeria': '🇳🇬', 'Pérou': '🇵🇪', 'Tunisie': '🇹🇳',
  'Suède': '🇸🇪', 'Paraguay': '🇵🇾', 'Côte d\'Ivoire': '🇨🇮', 'Norvège': '🇳🇴',
  'RD Congo': '🇨🇩', 'Congo': '🇨🇩', 'Algérie': '🇩🇿', 'Autriche': '🇦🇹',
  'Cap-Vert': '🇨🇻', 'Ghana': '🇬🇭', 'Iran': '🇮🇷', 'Irak': '🇮🇶',
  'Jordanie': '🇯🇴', 'Ouzbékistan': '🇺🇿', 'Curaçao': '🇨🇼',
  'Vainqueur': '🎯', 'Perdant': '❌',
};

export function getFlag(country: string): string {
  for (const [key, flag] of Object.entries(FLAGS)) {
    if (country.includes(key)) return flag;
  }
  return '⚽';
}
