import Counter from '../models/Counter.js';

export async function generateTicketNumber() {
  const counter = await Counter.findByIdAndUpdate(
    'ticketNumber',
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );

  const formattedSeq = String(counter.seq).padStart(6, '0');
  return `BL-${formattedSeq}`;
}

export default generateTicketNumber;
