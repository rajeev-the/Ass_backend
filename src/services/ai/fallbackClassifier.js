import { CATEGORIES, PRIORITIES } from '../../utils/constants.js';

export const classifyWithFallback = (text = '') => {
  const t = text.toLowerCase();
  let category = 'General Inquiry';
  let priority = 'Low';
  let reason = 'Default classification based on inquiry keywords';

  if (/description|bio|profile|package/i.test(t)) {
    category = 'General Inquiry';
    priority = 'Low';
    reason = 'Keywords related to author bio or description update inquiry';
  } else if (/isbn|metadata|wrong book|barcode/i.test(t)) {
    category = 'ISBN & Metadata Issues';
    priority = 'High';
    reason = 'Keywords detected related to ISBN or metadata matching';
  } else if (/royalt|payout|payment|paid|bank|₹|money/i.test(t)) {
    category = 'Royalty & Payments';
    priority = /month|never|not received/i.test(t) ? 'High' : 'Medium';
    reason = 'Keywords detected related to royalty payouts or calculations';
  } else if (/print|blurr|binding|misalign|defect|torn|pages/i.test(t)) {
    category = 'Printing & Quality';
    priority = 'High';
    reason = 'Keywords detected related to physical printing quality or defects';
  } else if (/amazon|flipkart|unavailable|listing|not showing|out of stock/i.test(t)) {
    category = 'Distribution & Availability';
    priority = 'High';
    reason = 'Keywords detected related to book listing distribution and availability';
  } else if (/typeset|cover|proof|stage|production|when will|delay/i.test(t)) {
    category = 'Book Status & Production Updates';
    priority = 'Medium';
    reason = 'Keywords detected related to book production stage progress';
  }

  // Boost priority one level for urgent/delay/legal keywords
  if (/urgent|legal|lawyer|6 months|months/i.test(t)) {
    if (priority === 'High') priority = 'Critical';
    else if (priority === 'Medium') priority = 'High';
    else if (priority === 'Low') priority = 'Medium';
  }

  // Hard policy rule in code: ISBN & Metadata Issues must be at least High
  if (category === 'ISBN & Metadata Issues' && (priority === 'Low' || priority === 'Medium')) {
    priority = 'High';
  }

  // Ensure validity against shared enums
  if (!CATEGORIES.includes(category)) category = 'General Inquiry';
  if (!PRIORITIES.includes(priority)) priority = 'Medium';

  return {
    category,
    priority,
    confidence: 0.85,
    reason,
    source: 'fallback',
  };
};

export default classifyWithFallback;
