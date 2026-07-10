// Rule-based content-safety scanner for uploaded material.
// Text (PDF contents, titles, descriptions, generated exam questions) is
// checked against category wordlists; images can't be auto-analyzed and are
// queued for manual review instead. No external services involved.

export type ScanStatus = 'clean' | 'review' | 'flagged';

export interface TermMatch {
  term: string;
  category: string;
  count: number;
}

export interface ScanOutcome {
  status: ScanStatus;
  categories: string[];
  matches: TermMatch[];
  note: string | null;
}

// Categories: 'flagged' severity blocks (adult/profanity), 'review' severity
// asks a human to look (violence/substances often appear legitimately in
// history or health lessons).
const WORDLISTS: { category: string; severity: 'flagged' | 'review'; terms: string[] }[] = [
  {
    category: 'adult',
    severity: 'flagged',
    terms: [
      'porn', 'pornography', 'pornographic', 'xxx', 'nude', 'nudes', 'nudity',
      'erotic', 'erotica', 'sexual', 'sexually', 'intercourse', 'orgasm',
      'masturbate', 'masturbation', 'fetish', 'stripper', 'prostitute', 'brothel',
      'explicit', 'nsfw', 'hentai', 'incest', 'genitals', 'penis', 'vagina',
    ],
  },
  {
    category: 'profanity',
    severity: 'flagged',
    terms: [
      'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'shit', 'shitty',
      'bullshit', 'bitch', 'bitches', 'bastard', 'asshole', 'arsehole', 'dickhead',
      'cunt', 'whore', 'slut', 'douchebag', 'jackass', 'pissed',
      // common Hindi profanity (transliterated)
      'chutiya', 'bhosdike', 'madarchod', 'behenchod', 'harami', 'kamina',
    ],
  },
  {
    category: 'violence',
    severity: 'review',
    terms: [
      'murder', 'murdered', 'massacre', 'behead', 'beheading', 'torture',
      'suicide', 'self-harm', 'shooting', 'gunfight', 'bloodshed', 'stabbing',
      'terrorist', 'terrorism', 'bomb', 'bombing', 'hostage', 'lynching',
    ],
  },
  {
    category: 'substances',
    severity: 'review',
    terms: [
      'cocaine', 'heroin', 'marijuana', 'cannabis', 'weed', 'meth',
      'methamphetamine', 'opium', 'ecstasy', 'vape', 'vaping', 'cigarette',
      'cigarettes', 'tobacco', 'alcohol', 'whiskey', 'vodka', 'drunk', 'gambling',
    ],
  },
];

type Severity = 'flagged' | 'review';
interface Matcher { term: string; category: string; severity: Severity; re: RegExp; }

// Whole-word matching only (avoids the classic "Scunthorpe" false positives)
function toMatcher(term: string, category: string, severity: Severity): Matcher {
  return { term, category, severity, re: new RegExp(`\\b${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi') };
}

const MATCHERS: Matcher[] = WORDLISTS.flatMap((list) =>
  list.terms.map((term) => toMatcher(term, list.category, list.severity))
);

// Per-org tuning (from SafetySetting). extraTerms add to the built-in lists;
// mutedCategories are dropped entirely (built-in AND extra terms in them).
export interface ScanConfig {
  extraTerms?: { term: string; category: string; severity: Severity }[];
  mutedCategories?: string[];
}

// Build the matcher set for an org: built-ins + custom terms, minus muted categories.
export function buildMatchers(config?: ScanConfig): Matcher[] {
  if (!config || (!config.extraTerms?.length && !config.mutedCategories?.length)) return MATCHERS;
  const muted = new Set((config.mutedCategories || []).map((c) => c.toLowerCase()));
  const custom = (config.extraTerms || [])
    .filter((t) => t.term && String(t.term).trim())
    .map((t) => toMatcher(String(t.term).trim(), t.category || 'custom', t.severity === 'review' ? 'review' : 'flagged'));
  return [...MATCHERS, ...custom].filter((m) => !muted.has(m.category.toLowerCase()));
}

export function scanText(text: string, config?: ScanConfig): ScanOutcome {
  const matches: TermMatch[] = [];
  const categories = new Set<string>();
  let worst: ScanStatus = 'clean';

  for (const m of buildMatchers(config)) {
    const found = text.match(m.re);
    if (found && found.length > 0) {
      matches.push({ term: m.term, category: m.category, count: found.length });
      categories.add(m.category);
      if (m.severity === 'flagged') worst = 'flagged';
      else if (worst !== 'flagged') worst = 'review';
    }
  }

  return {
    status: worst,
    categories: [...categories],
    matches: matches.sort((a, b) => b.count - a.count).slice(0, 20),
    note: worst === 'clean' ? null
      : worst === 'flagged' ? 'Contains terms not appropriate for kids and students'
        : 'Contains terms that may need context — please review',
  };
}

// Images (photos, scans, logos) can't be analyzed by rules — human review
export function imageOutcome(kind: string): ScanOutcome {
  return {
    status: 'review',
    categories: [],
    matches: [],
    note: `${kind} is an image — automatic scanning cannot analyze pictures, please review it manually`,
  };
}

export function unscannableOutcome(ext: string): ScanOutcome {
  return {
    status: 'review',
    categories: [],
    matches: [],
    note: `${ext.toUpperCase()} files cannot be scanned automatically — please review manually`,
  };
}
