export const COMPANY_OVERVIEW = `
BookLeaf Publishing is a self-publishing company operating in India and the US.
We offer publishing packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid package with marketing and distribution add-ons).
We handle cover design, typesetting, ISBN assignment, printing, distribution, and royalty management for our authors.
Our in-house printing facility and warehouse are located in Delhi. We also work with print partners including Repro India and Epitome Books.
`.trim();

export const ROYALTY_POLICY = `
BookLeaf follows an 80/20 royalty split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping charges.
Royalties are calculated quarterly and paid within 45 days of the quarter ending.
Minimum payout threshold: ₹1,000. If accumulated royalties are below this, they roll over to the next quarter.
Payouts are made via bank transfer to the account linked in the author’s dashboard.
Authors can view a detailed royalty breakdown in their dashboard, showing sales figures per platform.
`.trim();

export const ISBN_POLICY = `
Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
ISBNs are registered under BookLeaf’s publisher imprint. If an author wants an ISBN under their own imprint, they need to obtain it independently.
If an author reports an ISBN error (duplicate, wrong book linked), it is treated as a high-priority issue and escalated to the production team.
Metadata updates (title, author bio, book description) typically reflect on platforms within 3–5 business days.
`.trim();

export const PRINTING_QUALITY = `
In-house printing handles most orders at our Delhi facility. Overflow or specific format requirements go to Repro India or Epitome Books.
Standard print turnaround: 5–7 business days from order confirmation.
If an author reports a quality issue (misprints, binding defects, color inconsistency, blurry text or images), BookLeaf arranges a free reprint after verification.
The author must share photos of the defective copy to initiate the verification and complimentary reprint process.
`.trim();

export const DISTRIBUTION = `
Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
New listings typically go live within 7–10 business days after publication is complete.
If a book is showing as unavailable on a platform, it usually indicates a stock sync issue—BookLeaf’s team can trigger a re-sync within 24–48 hours.
`.trim();

export const PRODUCTION_STAGES = `
A book goes through the following stages in sequence:
1. Manuscript Received
2. Editing (if opted)
3. Cover Design
4. Typesetting
5. Proofreading
6. ISBN Assignment
7. Printing
8. Distribution Setup
9. Published & Live
Authors are updated at each stage via email. Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).
`.trim();

export const TONE_GUIDELINES = `
- Always empathetic and professional. Authors are our partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: include actual numbers, dates, and statuses wherever possible rather than vague reassurances.
- If something is BookLeaf's fault (delayed royalties, ISBN error, print defects), own it directly. No corporate deflection.
- If the issue requires escalation or investigation, give a clear timeline (e.g. "Our team will look into this and get back to you within 48 hours") rather than open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.
- 120–220 words, plain text, short paragraphs, no markdown formatting, no placeholders.
- Sign off exactly:
Warm regards,
BookLeaf Author Support
`.trim();

export const SAMPLES = {
  'Royalty & Payments': [
    {
      query:
        "I published my book 4 months ago and still haven't received any royalty. What's going on?",
      guidance:
        'Acknowledge the frustration. Explain the quarterly royalty cycle and 45-day payout window. Check if their bank details are linked. Provide the specific next payout date. If the payment is genuinely overdue, escalate with a 48-hour resolution timeline.',
    },
    {
      query: 'My royalty amount seems too low. I sold 200 copies but only received ₹3,000.',
      guidance:
        'Explain the net profit calculation: MRP minus printing, platform commission, and shipping. Offer to share a detailed line-by-line royalty breakdown. Don’t be defensive—offer transparency.',
    },
  ],
  'ISBN & Metadata Issues': [
    {
      query: 'My book is showing a different ISBN on Amazon than what’s on the physical copy.',
      guidance:
        'Treat as high priority. Acknowledge this is a serious data issue. Confirm you are escalating to the production team immediately. Provide a 48-hour resolution timeline.',
    },
  ],
  'Printing & Quality': [
    {
      query:
        'I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.',
      guidance:
        'Apologise sincerely. Ask the author to share photos of the defective copies. Confirm that BookLeaf will arrange a free reprint once verified. Provide a timeline of 5–7 business days for the reprint.',
    },
  ],
  'Distribution & Availability': [
    {
      query: 'My book is published but it’s showing as "Currently Unavailable" on Amazon.',
      guidance:
        'Explain that this is typically a stock sync issue. Confirm you’re triggering a re-sync with the distribution team. Set expectation: 24–48 hours for it to go live again.',
    },
  ],
  'Book Status & Production Updates': [
    {
      query: 'It’s been 3 weeks and my book is still in typesetting. When will it be done?',
      guidance:
        'Check the actual production status. If it’s delayed, be honest about why (e.g., waiting on author approval for proofs). Provide a specific updated timeline. Don’t blame the author even if the delay is on their side—frame it collaboratively.',
    },
  ],
  'General Inquiry': [
    {
      query: 'Can I update the description of my book on Amazon after it’s already live?',
      guidance:
        'Yes, metadata updates can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3–5 business days.',
    },
  ],
};

// Map category to the exact minimal KB sections (Cost control rule 8.3 & 8.4)
export const getKbSectionsForCategory = (category) => {
  switch (category) {
    case 'Royalty & Payments':
      return [ROYALTY_POLICY];
    case 'ISBN & Metadata Issues':
      return [ISBN_POLICY];
    case 'Printing & Quality':
      return [PRINTING_QUALITY];
    case 'Distribution & Availability':
      return [DISTRIBUTION];
    case 'Book Status & Production Updates':
      return [PRODUCTION_STAGES];
    case 'General Inquiry':
    default:
      return [COMPANY_OVERVIEW, ISBN_POLICY];
  }
};

export const getMatchingSample = (category) => {
  const samples = SAMPLES[category] || SAMPLES['General Inquiry'];
  const s = samples[0];
  return `Example Query: "${s.query}"\nGuidance: ${s.guidance}`;
};

export default {
  COMPANY_OVERVIEW,
  ROYALTY_POLICY,
  ISBN_POLICY,
  PRINTING_QUALITY,
  DISTRIBUTION,
  PRODUCTION_STAGES,
  TONE_GUIDELINES,
  SAMPLES,
  getKbSectionsForCategory,
  getMatchingSample,
};
