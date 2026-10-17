// Helper to format currency in Indian numbering format (e.g. ₹11,970)
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper to format date cleanly (e.g. 15 Feb 2027)
export const formatDate = (date) => {
  if (!date) return 'Not available';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Not available';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const getQuarter = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 to 11

  // Q1: Jan-Mar (0, 1, 2)
  // Q2: Apr-Jun (3, 4, 5)
  // Q3: Jul-Sep (6, 7, 8)
  // Q4: Oct-Dec (9, 10, 11)
  const quarterNum = Math.floor(month / 3) + 1;
  const startMonth = (quarterNum - 1) * 3;
  const endMonth = startMonth + 2;

  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

  return {
    label: `Q${quarterNum} ${year}`,
    quarterNum,
    year,
    start,
    end,
  };
};

export const getPayoutDeadline = (quarterEndDate) => {
  const deadline = new Date(quarterEndDate);
  deadline.setDate(deadline.getDate() + 45);
  return deadline;
};

export const getRoyaltyFacts = (book, today = new Date()) => {
  if (!book) {
    return {
      hasBook: false,
      summaryText: 'General inquiry with no specific book selected.',
    };
  }

  const isPublished = book.status === 'Published & Live';
  const pending = book.royaltyPending || 0;
  const earned = book.totalRoyaltyEarned || 0;
  const paid = book.royaltyPaid || 0;
  const belowThreshold = pending > 0 && pending < 1000;
  const neverPaid = !paid || paid === 0;

  const currentQuarter = getQuarter(today);
  const nextPayoutBy = getPayoutDeadline(currentQuarter.end);

  // Overdue calculation: pending >= 1000 and either:
  // 1. last payout older than 135 days (90 days quarter + 45 days window)
  // 2. never paid, but publication date is older than 135 days
  let possiblyOverdue = false;
  const msInDay = 24 * 60 * 60 * 1000;

  if (pending >= 1000 && isPublished) {
    if (book.lastRoyaltyPayoutDate) {
      const daysSincePayout =
        (today.getTime() - new Date(book.lastRoyaltyPayoutDate).getTime()) / msInDay;
      if (daysSincePayout > 135) {
        possiblyOverdue = true;
      }
    } else if (book.publicationDate) {
      const daysSincePub = (today.getTime() - new Date(book.publicationDate).getTime()) / msInDay;
      if (daysSincePub > 135) {
        possiblyOverdue = true;
      }
    }
  }

  return {
    hasBook: true,
    isPublished,
    status: book.status,
    totalCopiesSold: book.totalCopiesSold || 0,
    totalRoyaltyEarned: earned,
    royaltyPaid: paid,
    royaltyPending: pending,
    formattedEarned: formatCurrency(earned),
    formattedPaid: formatCurrency(paid),
    formattedPending: formatCurrency(pending),
    belowThreshold,
    neverPaid,
    lastPayoutDate: book.lastRoyaltyPayoutDate ? formatDate(book.lastRoyaltyPayoutDate) : null,
    currentQuarterLabel: currentQuarter.label,
    currentQuarterEnds: formatDate(currentQuarter.end),
    nextPayoutBy: formatDate(nextPayoutBy),
    possiblyOverdue,
  };
};

export default {
  formatCurrency,
  formatDate,
  getQuarter,
  getPayoutDeadline,
  getRoyaltyFacts,
};
