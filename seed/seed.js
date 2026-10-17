import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import connectDB, { disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Book from '../src/models/Book.js';
import Ticket from '../src/models/Ticket.js';
import Message from '../src/models/Message.js';
import Counter from '../src/models/Counter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSeed() {
  console.log('🌱 Starting BookLeaf database seed...');

  await connectDB();

  // 1. Wipe collections
  console.log('🧹 Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Book.deleteMany({}),
    Ticket.deleteMany({}),
    Message.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  // 2. Load sample data JSON
  const sampleDataPath = path.join(__dirname, 'bookleaf_sample_data.json');
  if (!fs.existsSync(sampleDataPath)) {
    throw new Error(`Sample data file not found at: ${sampleDataPath}`);
  }
  const rawData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
  const authorsData = rawData.authors || [];

  // 3. Create Authors with password Author@123
  console.log(`👤 Seeding ${authorsData.length} authors...`);
  const authorPasswordHash = await bcrypt.hash('Author@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

  const authorMap = new Map(); // authorCode -> User doc
  const createdAuthors = [];

  for (const a of authorsData) {
    const authorUser = await User.create({
      role: 'author',
      name: a.name,
      email: a.email.toLowerCase().trim(),
      passwordHash: authorPasswordHash,
      authorCode: a.author_id,
      phone: a.phone || null,
      city: a.city || null,
      joinedDate: a.joined_date ? new Date(a.joined_date) : null,
    });
    authorMap.set(a.author_id, authorUser);
    createdAuthors.push(authorUser);
  }

  // 4. Create Books linked to authors
  console.log('📚 Seeding books...');
  const bookMap = new Map(); // bookCode -> Book doc
  let _bookCount = 0;

  for (const a of authorsData) {
    const authorUser = authorMap.get(a.author_id);
    const books = a.books || [];

    for (const b of books) {
      const bookDoc = await Book.create({
        bookCode: b.book_id,
        author: authorUser._id,
        title: b.title,
        isbn: b.isbn || null,
        genre: b.genre || null,
        publicationDate: b.publication_date ? new Date(b.publication_date) : null,
        status: b.status,
        mrp: b.mrp !== undefined ? b.mrp : null,
        royaltyPerCopy: b.author_royalty_per_copy !== undefined ? b.author_royalty_per_copy : null,
        totalCopiesSold: b.total_copies_sold || 0,
        totalRoyaltyEarned: b.total_royalty_earned || 0,
        royaltyPaid: b.royalty_paid || 0,
        royaltyPending: b.royalty_pending !== undefined ? b.royalty_pending : 0,
        lastRoyaltyPayoutDate: b.last_royalty_payout_date
          ? new Date(b.last_royalty_payout_date)
          : null,
        printPartner: b.print_partner || null,
        availableOn: b.available_on || [],
      });
      bookMap.set(b.book_id, bookDoc);
      _bookCount++;
    }
  }

  // 5. Create Admins
  console.log('🛡️  Seeding admin accounts...');
  const opsAdmin = await User.create({
    role: 'admin',
    name: 'Ops Admin',
    email: 'admin@bookleaf.com',
    passwordHash: adminPasswordHash,
    city: 'New Delhi',
    joinedDate: new Date('2022-01-01'),
  });

  const supportAgent = await User.create({
    role: 'admin',
    name: 'Support Agent',
    email: 'support@bookleaf.com',
    passwordHash: adminPasswordHash,
    city: 'New Delhi',
    joinedDate: new Date('2022-06-01'),
  });

  // 6. Create 6 Demo Tickets
  console.log('🎫 Seeding demo tickets and messages...');

  // Ticket 1: Ananya Reddy (AUTH003), Between Two Temples (BK005)
  const ananya = authorMap.get('AUTH003');
  const bk005 = bookMap.get('BK005');
  const t1 = await Ticket.create({
    ticketNumber: 'BL-000001',
    author: ananya._id,
    book: bk005._id,
    subject: 'No royalty received yet',
    description:
      'My book Between Two Temples was published in 2024 and copies have been sold, but I have not received any royalty payout yet in my bank account. Could you please check when my royalty will be processed?',
    status: 'Open',
    category: {
      value: 'Royalty & Payments',
      source: 'ai',
      aiValue: 'Royalty & Payments',
      confidence: 0.98,
    },
    priority: {
      value: 'High',
      source: 'ai',
      aiValue: 'High',
      reason: 'Author inquiring about overdue royalty payout',
    },
    priorityRank: 1,
    ai: {
      classificationStatus: 'done',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(Date.now() - 2 * 3600 * 1000),
  });
  await Message.create({
    ticket: t1._id,
    sender: ananya._id,
    senderRole: 'author',
    type: 'reply',
    body: t1.description,
    createdAt: t1.createdAt,
  });

  // Ticket 2: Rohit Kapoor (AUTH002), Code & Karma (BK003)
  const rohit = authorMap.get('AUTH002');
  const bk003 = bookMap.get('BK003');
  const t2 = await Ticket.create({
    ticketNumber: 'BL-000002',
    author: rohit._id,
    book: bk003._id,
    subject: 'ISBN on Amazon differs from print',
    description:
      'I noticed that the ISBN displayed on my Amazon India listing is different from the printed barcode on the back cover of my author copies. This is causing confusion for buyers and metadata indexing.',
    status: 'In Progress',
    category: {
      value: 'ISBN & Metadata Issues',
      source: 'ai',
      aiValue: 'ISBN & Metadata Issues',
      confidence: 0.99,
    },
    priority: {
      value: 'Critical',
      source: 'ai',
      aiValue: 'Critical',
      reason: 'Active mismatch between print and live store ISBN',
    },
    priorityRank: 0,
    assignedTo: opsAdmin._id,
    firstResponseAt: new Date(Date.now() - 12 * 3600 * 1000),
    ai: {
      classificationStatus: 'done',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(Date.now() - 10 * 3600 * 1000),
  });
  await Message.create({
    ticket: t2._id,
    sender: rohit._id,
    senderRole: 'author',
    type: 'reply',
    body: t2.description,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000),
  });
  await Message.create({
    ticket: t2._id,
    sender: opsAdmin._id,
    senderRole: 'admin',
    type: 'internal_note',
    body: 'Escalated to production team in Delhi to verify Repro India metadata feed. Checking barcode batch.',
    createdAt: new Date(Date.now() - 10 * 3600 * 1000),
  });

  // Ticket 3: Sneha Kulkarni (AUTH007), Midnight in Mysore (BK013)
  const sneha = authorMap.get('AUTH007');
  const bk013 = bookMap.get('BK013');
  const t3 = await Ticket.create({
    ticketNumber: 'BL-000003',
    author: sneha._id,
    book: bk013._id,
    subject: 'Stuck in cover design stage for 3 weeks',
    description:
      "My manuscript was approved almost a month ago, but the portal has been showing 'In Production - Cover Design' for over 3 weeks now. Can someone share an update on when I will see the initial proofs?",
    status: 'Open',
    category: {
      value: 'Book Status & Production Updates',
      source: 'ai',
      aiValue: 'Book Status & Production Updates',
      confidence: 0.94,
    },
    priority: {
      value: 'Medium',
      source: 'ai',
      aiValue: 'Medium',
      reason: 'Production stage delay inquiry',
    },
    priorityRank: 2,
    ai: {
      classificationStatus: 'done',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(Date.now() - 5 * 3600 * 1000),
  });
  await Message.create({
    ticket: t3._id,
    sender: sneha._id,
    senderRole: 'author',
    type: 'reply',
    body: t3.description,
    createdAt: t3.createdAt,
  });

  // Ticket 4: Priya Sharma (AUTH001), Whispers of the Ganges (BK001)
  const priya = authorMap.get('AUTH001');
  const bk001 = bookMap.get('BK001');
  const t4 = await Ticket.create({
    ticketNumber: 'BL-000004',
    author: priya._id,
    book: bk001._id,
    subject: 'Blurry author copies received',
    description:
      'I received my batch of 10 author copies today. The cover artwork looks slightly blurred and the font on page 42-48 is pixelated. Could I request a reprint?',
    status: 'Resolved',
    category: {
      value: 'Printing & Quality',
      source: 'ai',
      aiValue: 'Printing & Quality',
      confidence: 0.96,
    },
    priority: {
      value: 'High',
      source: 'ai',
      aiValue: 'High',
      reason: 'Defective print batch reported by author',
    },
    priorityRank: 1,
    assignedTo: supportAgent._id,
    firstResponseAt: new Date(Date.now() - 14 * 3600 * 1000),
    resolvedAt: new Date(Date.now() - 4 * 3600 * 1000),
    ai: {
      classificationStatus: 'done',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(Date.now() - 4 * 3600 * 1000),
  });
  await Message.create({
    ticket: t4._id,
    sender: priya._id,
    senderRole: 'author',
    type: 'reply',
    body: t4.description,
    createdAt: new Date(Date.now() - 20 * 3600 * 1000),
  });
  await Message.create({
    ticket: t4._id,
    sender: supportAgent._id,
    senderRole: 'admin',
    type: 'reply',
    body: 'Dear Priya,\n\nThank you for reaching out and sharing details. Our production team verified the print run with our Delhi printing facility and confirmed a slight alignment issue. We have initiated a complimentary reprint of your 10 copies, which will be dispatched within 5-7 business days.\n\nWarm regards,\nBookLeaf Author Support',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000),
  });

  // Ticket 5: Meera Nair (AUTH005), Letters from Lakshadweep (BK009)
  const meera = authorMap.get('AUTH005');
  const bk009 = bookMap.get('BK009');
  const t5 = await Ticket.create({
    ticketNumber: 'BL-000005',
    author: meera._id,
    book: bk009._id,
    subject: 'Unavailable on Amazon US',
    description:
      "My readers in the United States informed me that Letters from Lakshadweep is marked as 'Currently Unavailable' on Amazon.com, even though it was live last week. Could you please investigate?",
    status: 'Open',
    category: {
      value: 'Distribution & Availability',
      source: 'ai',
      aiValue: 'Distribution & Availability',
      confidence: 0.97,
    },
    priority: {
      value: 'High',
      source: 'ai',
      aiValue: 'High',
      reason: 'Book unavailable on major platform',
    },
    priorityRank: 1,
    ai: {
      classificationStatus: 'done',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(Date.now() - 8 * 3600 * 1000),
  });
  await Message.create({
    ticket: t5._id,
    sender: meera._id,
    senderRole: 'author',
    type: 'reply',
    body: t5.description,
    createdAt: t5.createdAt,
  });

  // Ticket 6: Arjun Malhotra (AUTH006), General (null book)
  const arjun = authorMap.get('AUTH006');
  const t6 = await Ticket.create({
    ticketNumber: 'BL-000006',
    author: arjun._id,
    book: null,
    subject: 'Update author bio and photo',
    description:
      'I recently won a regional literary mention and would like to update my author bio across my profile and future book listings. How can I submit the new bio and headshot?',
    status: 'Open',
    category: {
      value: 'General Inquiry',
      source: 'ai',
      aiValue: 'General Inquiry',
      confidence: 0.92,
    },
    priority: {
      value: 'Low',
      source: 'ai',
      aiValue: 'Low',
      reason: 'Informational bio update request',
    },
    priorityRank: 3,
    ai: {
      classificationStatus: 'done',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(Date.now() - 1 * 3600 * 1000),
  });
  await Message.create({
    ticket: t6._id,
    sender: arjun._id,
    senderRole: 'author',
    type: 'reply',
    body: t6.description,
    createdAt: t6.createdAt,
  });

  // 7. Seed Counter to sequence 6
  await Counter.findByIdAndUpdate(
    'ticketNumber',
    { seq: 6 },
    { upsert: true, returnDocument: 'after' }
  );

  // 8. Verification & Summary Output
  const totalAuthors = await User.countDocuments({ role: 'author' });
  const totalAdmins = await User.countDocuments({ role: 'admin' });
  const totalBooks = await Book.countDocuments();
  const totalTickets = await Ticket.countDocuments();
  const totalMessages = await Message.countDocuments();

  console.log('\n================ SEED VERIFICATION ================');
  console.log(`Authors created : ${totalAuthors} (Expected: 10)`);
  console.log(`Books created   : ${totalBooks} (Expected: 18)`);
  console.log(`Admins created  : ${totalAdmins} (Expected: 2)`);
  console.log(`Tickets created : ${totalTickets} (Expected: 6)`);
  console.log(`Messages created: ${totalMessages}`);
  console.log('====================================================\n');

  console.log('🔑 Credentials Table:');
  console.log(
    '-------------------------------------------------------------------------------------'
  );
  console.log(
    '| Role   | Email                      | Password    | Name / Code                    |'
  );
  console.log(
    '-------------------------------------------------------------------------------------'
  );
  console.log(
    '| admin  | admin@bookleaf.com         | Admin@123   | Ops Admin                      |'
  );
  console.log(
    '| admin  | support@bookleaf.com       | Admin@123   | Support Agent                  |'
  );
  for (const a of createdAuthors) {
    console.log(`| author | ${a.email.padEnd(26)} | Author@123  | ${a.name} (${a.authorCode})`);
  }
  console.log(
    '-------------------------------------------------------------------------------------\n'
  );

  if (totalAuthors !== 10 || totalBooks !== 18 || totalAdmins !== 2 || totalTickets !== 6) {
    throw new Error('❌ Verification failed: counts do not match expected values.');
  }

  console.log('✅ Seeding completed successfully!');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}

export default runSeed;
