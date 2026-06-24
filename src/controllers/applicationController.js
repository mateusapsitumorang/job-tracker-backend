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
    const { 
      status, 
      search, 
      sortBy, sort_by,
      sortDir, sort_dir, order: orderParam, 
      limit, pageSize: pageSizeParam,
      page: pageParam 
    } = req.query;

    const sortField = sortBy || sort_by || 'createdAt';
    const sortDirection = sortDir || sort_dir || orderParam || 'desc';

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

    const pageSizeFromLimit = limit ? parseInt(limit, 10) : null;
    const pageSizeFromParam = pageSizeParam ? parseInt(pageSizeParam, 10) : null;
    const take = pageSizeFromLimit || pageSizeFromParam || 20;
    const finalTake = Math.min(take, 1000); // 🔧 Max 1000
    
    const page = Math.max(parseInt(pageParam, 10) || 1, 1);
    const skip = (page - 1) * finalTake;

    console.log('📊 QUERY PARAMS:', { sortField, sortDirection, finalTake, page, skip });

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { [sortField]: sortDirection === 'asc' ? 'asc' : 'desc' },
        take: finalTake,
        skip,
      }),
      prisma.application.count({ where }),
    ]);

    return res.json({ items, total, page, pageSize: finalTake });
  } catch (err) {
    console.error('❌ Error getApplications:', err);
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

export const patchApplication = async (req, res) => {
  try {
    const existing = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Lamaran tidak ditemukan.' });
    }

    const { status, appliedDate, interviewDate, notes, source } = req.body;

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (appliedDate !== undefined) updateData.appliedDate = appliedDate ? new Date(appliedDate) : null;
    if (interviewDate !== undefined) updateData.interviewDate = interviewDate ? new Date(interviewDate) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (source !== undefined) updateData.source = source;

    const application = await prisma.application.update({
      where: { id: req.params.id },
      data: updateData,
    });

    if (status && status !== existing.status) {
      await addLog(application.id, 'STATUS_CHANGED', `Status diubah dari ${existing.status} ke ${status}`);
    }

    return res.json({ application });
  } catch (err) {
    console.error('❌ Error patchApplication:', err);
    return res.status(500).json({ message: 'Gagal memperbarui status lamaran.' });
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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [total, byStatus, upcomingInterviews, recentApps] = await Promise.all([
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
      prisma.application.findMany({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo }
        },
        select: { createdAt: true }
      })
    ]);

    const offers = byStatus.find((s) => s.status === 'OFFER')?._count._all || 0;
    const accepted = byStatus.find((s) => s.status === 'ACCEPTED')?._count._all || 0;
    const rejected = byStatus.find((s) => s.status === 'REJECTED')?._count._all || 0;

    const successRate = total > 0 ? Math.round(((offers + accepted) / total) * 100) : 0;

    const daysMap = { 0: 'M', 1: 'Sn', 2: 'Sl', 3: 'R', 4: 'K', 5: 'J', 6: 'S' };
    const weeklyRaw = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weeklyRaw.push({
        day: daysMap[d.getDay()],
        value: 0,
        dateString: d.toDateString()
      });
    }

    recentApps.forEach(app => {
      const appDateString = new Date(app.createdAt).toDateString();
      const dayIndex = weeklyRaw.findIndex(w => w.dateString === appDateString);
      if (dayIndex !== -1) {
        weeklyRaw[dayIndex].value += 1;
      }
    });

    const weekly = weeklyRaw.map(item => ({ day: item.day, value: item.value }));

    return res.json({
      total,
      byStatus,
      successRate,
      rejected,
      upcomingInterviews,
      weekly, 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil ringkasan dashboard.' });
  }
};