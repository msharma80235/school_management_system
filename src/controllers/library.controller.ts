import { Request, Response } from 'express';
import prisma from '../prisma/client';

const FINE_PER_DAY = 1; // currency units per day overdue

const loanInclude = {
  book: { select: { id: true, title: true, author: true } },
  student: { select: { id: true, first_name: true, last_name: true, roll_number: true } },
};

const today = () => new Date().toISOString().slice(0, 10);

function daysLate(dueDate: string, asOf = today()): number {
  const due = new Date(dueDate + 'T00:00:00Z').getTime();
  const now = new Date(asOf + 'T00:00:00Z').getTime();
  return Math.max(0, Math.floor((now - due) / 86400000));
}

// Issue a book to a student.
export async function issueBook(req: Request, res: Response): Promise<void> {
  try {
    const { book_id, student_id, due_date } = req.body;
    const orgId = req.user!.orgId!;

    if (!book_id || !student_id || !due_date) {
      res.status(400).json({ error: 'book_id, student_id, and due_date are required' }); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) { res.status(400).json({ error: 'due_date must be YYYY-MM-DD' }); return; }
    if (due_date < today()) { res.status(400).json({ error: 'Due date cannot be in the past' }); return; }

    const book = await prisma.book.findFirst({ where: { id: book_id, org_id: orgId } });
    if (!book) { res.status(404).json({ error: 'Book not found' }); return; }
    if (book.approval_status !== 'approved') { res.status(400).json({ error: 'This book is not approved for lending' }); return; }

    const student = await prisma.student.findFirst({ where: { id: student_id, org_id: orgId, is_active: true } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const activeLoans = await prisma.bookLoan.count({ where: { book_id, returned_at: null } });
    if (activeLoans >= book.total_copies) { res.status(409).json({ error: 'No copies available — all are currently out' }); return; }

    const alreadyOut = await prisma.bookLoan.findFirst({ where: { book_id, student_id, returned_at: null } });
    if (alreadyOut) { res.status(409).json({ error: 'This student already has this book out' }); return; }

    const loan = await prisma.bookLoan.create({
      data: { book_id, student_id, due_date, issued_by: req.user!.userId, org_id: orgId },
      include: loanInclude,
    });

    res.status(201).json({ message: `"${book.title}" issued to ${student.first_name} ${student.last_name}`, loan });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Return a book; computes an overdue fine.
export async function returnBook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const loan = await prisma.bookLoan.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!loan) { res.status(404).json({ error: 'Loan not found' }); return; }
    if (loan.returned_at) { res.status(400).json({ error: 'This book has already been returned' }); return; }

    const fine = daysLate(loan.due_date) * FINE_PER_DAY;
    const updated = await prisma.bookLoan.update({
      where: { id },
      data: { returned_at: new Date(), fine, fine_paid: fine === 0 },
      include: loanInclude,
    });

    res.json({ message: fine > 0 ? `Returned with a fine of ${fine}` : 'Returned', loan: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Mark an outstanding fine as paid.
export async function payFine(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const loan = await prisma.bookLoan.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!loan) { res.status(404).json({ error: 'Loan not found' }); return; }
    if (loan.fine <= 0) { res.status(400).json({ error: 'No fine on this loan' }); return; }

    const updated = await prisma.bookLoan.update({ where: { id }, data: { fine_paid: true }, include: loanInclude });
    res.json({ message: 'Fine marked paid', loan: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin/teacher: list loans (status = active | overdue | returned) with a summary.
export async function listLoans(req: Request, res: Response): Promise<void> {
  try {
    const { status, student_id, book_id } = req.query as Record<string, string>;
    const where: any = { org_id: req.user!.orgId };
    if (student_id) where.student_id = student_id;
    if (book_id) where.book_id = book_id;
    if (status === 'active') where.returned_at = null;
    else if (status === 'returned') where.returned_at = { not: null };
    else if (status === 'overdue') { where.returned_at = null; where.due_date = { lt: today() }; }

    const loans = await prisma.bookLoan.findMany({ where, include: loanInclude, orderBy: { issued_at: 'desc' } });

    // Annotate each open loan with live overdue days.
    const annotated = loans.map((l) => ({
      ...l,
      overdue_days: l.returned_at ? 0 : daysLate(l.due_date),
      current_fine: l.returned_at ? l.fine : daysLate(l.due_date) * FINE_PER_DAY,
    }));

    const [outstanding, overdue, unpaidFines] = await Promise.all([
      prisma.bookLoan.count({ where: { org_id: req.user!.orgId, returned_at: null } }),
      prisma.bookLoan.count({ where: { org_id: req.user!.orgId, returned_at: null, due_date: { lt: today() } } }),
      prisma.bookLoan.aggregate({ where: { org_id: req.user!.orgId, fine: { gt: 0 }, fine_paid: false }, _sum: { fine: true } }),
    ]);

    res.json({ loans: annotated, summary: { outstanding, overdue, unpaid_fine_total: unpaidFines._sum.fine || 0 } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student: my current + past loans.
export async function myLoans(req: Request, res: Response): Promise<void> {
  try {
    const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId } });
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const loans = await prisma.bookLoan.findMany({
      where: { student_id: student.id },
      include: { book: { select: { id: true, title: true, author: true } } },
      orderBy: { issued_at: 'desc' },
    });
    const annotated = loans.map((l) => ({ ...l, overdue_days: l.returned_at ? 0 : daysLate(l.due_date) }));

    res.json({ loans: annotated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
