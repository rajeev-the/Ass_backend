export const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export const PRIORITY_RANKS = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export const PRODUCTION_STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
];

export const USER_ROLES = ['author', 'admin'];

export const MESSAGE_TYPES = ['reply', 'internal_note', 'system'];

export const MESSAGE_SENDERS = ['author', 'admin', 'system'];

export const CLASSIFICATION_SOURCES = ['ai', 'fallback', 'admin'];

export const CLASSIFICATION_STATUSES = ['pending', 'done', 'failed', 'skipped'];

export const DRAFT_STATUSES = ['none', 'pending', 'ready', 'failed'];

export const ALLOWED_STATUS_TRANSITIONS = {
  Open: ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Open', 'Resolved', 'Closed'],
  Resolved: ['In Progress', 'Closed'], // author reply can also transition to Open
  Closed: ['In Progress'],
};

export const STATUS_SLUGS = {
  open: 'Open',
  in_progress: 'In Progress',
  'in-progress': 'In Progress',
  'in progress': 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_SLUGS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const CATEGORY_SLUGS = {
  royalty: 'Royalty & Payments',
  isbn: 'ISBN & Metadata Issues',
  printing: 'Printing & Quality',
  distribution: 'Distribution & Availability',
  production: 'Book Status & Production Updates',
  general: 'General Inquiry',
};

export const normalizeStatus = (val) => {
  if (!val) return undefined;
  if (STATUSES.includes(val)) return val;
  const lower = String(val).toLowerCase().trim();
  return STATUS_SLUGS[lower] || val;
};

export const normalizePriority = (val) => {
  if (!val) return undefined;
  if (PRIORITIES.includes(val)) return val;
  const lower = String(val).toLowerCase().trim();
  return PRIORITY_SLUGS[lower] || val;
};

export const normalizeCategory = (val) => {
  if (!val) return undefined;
  if (CATEGORIES.includes(val)) return val;
  const lower = String(val).toLowerCase().trim();
  return CATEGORY_SLUGS[lower] || val;
};
