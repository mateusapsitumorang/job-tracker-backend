import prisma from '../config/db.js';

const addLog = (applicationId, action, note) =>
  prisma.activityLog.create({ data: { applicationId, action, note } });

export const createApplication = async (req, res) => {
  try {
    const { companyName, position, status, appliedDate, interviewDate, notes, source } = req.body;

    const application = await prisma.application.create({
      data: {
        userId: req.userId,
        companyName,
        position,
        status: status || 'APPLIED',
        appliedDate: appliedDate ? new Date(appliedDate) : null,
        interviewDate: interviewDate ? new Date(interviewDate) : null,
        notes,
        source,
      },
    });

    await addLog(application.id, 'CREATED', `Lamaran ditambahkan untuk ${companyName} - ${position}`);

    return res.status(201).json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menambahkan lamaran.' });
  }
};

export const getApplications = async (req, res) => {
  try {
    const { status, search, sortBy = 'createdAt', order = 'desc', page = 1, pageSize = 20 } = req.query;

    const where = {
      userId: req.userId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const take = Math.min(parseInt(pageSize, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { [sortBy]: order === 'asc' ? 'asc' : 'desc' },
        take,
        skip,
      }),
      prisma.application.count({ where }),
    ]);

    return res.json({ items, total, page: Number(page), pageSize: take });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil data lamaran.' });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { logs: { orderBy: { createdAt: 'desc' } } },
    });

    if (!application) {
      return res.status(404).json({ message: 'Lamaran tidak ditemukan.' });
    }

    return res.json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil data lamaran.' });
  }
};

export const updateApplication = async (req, res) => {
  try {
    const existing = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Lamaran tidak ditemukan.' });
    }

    const { companyName, position, status, appliedDate, interviewDate, notes, source } = req.body;

    const application = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(position !== undefined && { position }),
        ...(status !== undefined && { status }),
        ...(appliedDate !== undefined && { appliedDate: appliedDate ? new Date(appliedDate) : null }),
        ...(interviewDate !== undefined && { interviewDate: interviewDate ? new Date(interviewDate) : null }),
        ...(notes !== undefined && { notes }),
        ...(source !== undefined && { source }),
      },
    });

    if (status && status !== existing.status) {
      await addLog(application.id, 'STATUS_CHANGED', `Status diubah dari ${existing.status} ke ${status}`);
    } else {
      await addLog(application.id, 'UPDATED', 'Data lamaran diperbarui');
    }

    return res.json({ application });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memperbarui lamaran.' });
  }
};

export const deleteApplication = async (req, res) => {
  try {
    const existing = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Lamaran tidak ditemukan.' });
    }

    await prisma.application.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Lamaran berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menghapus lamaran.' });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.userId;

    const [total, byStatus, upcomingInterviews] = await Promise.all([
      prisma.application.count({ where: { userId } }),
      prisma.application.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.application.findMany({
        where: { userId, interviewDate: { gte: new Date() } },
        orderBy: { interviewDate: 'asc' },
        take: 5,
      }),
    ]);

    const offers = byStatus.find((s) => s.status === 'OFFER')?._count._all || 0;
    const accepted = byStatus.find((s) => s.status === 'ACCEPTED')?._count._all || 0;
    const rejected = byStatus.find((s) => s.status === 'REJECTED')?._count._all || 0;

    const successRate = total > 0 ? Math.round(((offers + accepted) / total) * 100) : 0;

    return res.json({
      total,
      byStatus,
      successRate,
      rejected,
      upcomingInterviews,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil ringkasan dashboard.' });
  }
};
