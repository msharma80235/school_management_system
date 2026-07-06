import { Request, Response } from 'express';
import prisma from '../prisma/client';

// Admin: add a holiday (single day or a range)
export async function createHoliday(req: Request, res: Response): Promise<void> {
  try {
    const { title, date, end_date, description } = req.body;
    const orgId = req.user!.orgId;

    if (!title || !date) {
      res.status(400).json({ error: 'Title and date are required' });
      return;
    }

    if (end_date && end_date < date) {
      res.status(400).json({ error: 'End date cannot be before start date' });
      return;
    }

    const holiday = await prisma.holiday.create({
      data: {
        title,
        date,
        end_date: end_date || null,
        description: description || null,
        created_by: req.user?.userId || null,
        org_id: orgId,
      },
    });

    res.status(201).json({ message: 'Holiday added', holiday });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// All authenticated users: list holidays (optionally for a specific year)
export async function listHolidays(req: Request, res: Response): Promise<void> {
  try {
    const { year } = req.query;
    const where: any = { org_id: req.user!.orgId };
    if (year) where.date = { startsWith: `${year}-` };

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    res.json({ holidays });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: delete a holiday
export async function deleteHoliday(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.holiday.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Holiday not found' }); return; }

    await prisma.holiday.delete({ where: { id } });
    res.json({ message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
