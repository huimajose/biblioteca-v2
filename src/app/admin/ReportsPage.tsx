import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Ticket, X, ListFilter, History, Package, RotateCcw, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/utils/cn.ts';
import { motion, AnimatePresence } from 'motion/react';
import { BorrowTicket } from '@/components/BorrowTicket.tsx';
import { BookInfoModal } from '@/components/BookInfoModal.tsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_WATERMARK } from '@/constants.ts';
import { addCenteredWatermarkToAllPages, loadWatermarkImage } from '@/utils/pdfWatermark.ts';

export const ReportsPage = () => {
  const [reportType, setReportType] = useState<'activity' | 'genre' | 'inventory' | 'users' | 'top-books'>('activity');
  const [activities, setActivities] = useState<any[]>([]);
  const [activitySummary, setActivitySummary] = useState<any | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [topRange, setTopRange] = useState({ start: '', end: '' });
  const [topLimit, setTopLimit] = useState(10);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'borrowed' | 'returned' | 'pending' | 'rejected'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'user' | 'week' | 'day'>('none');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [confirmReturn, setConfirmReturn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);
  const [usersPageSize, setUsersPageSize] = useState(8);
  const [selectedBookInfo, setSelectedBookInfo] = useState<any | null>(null);
  const getActivityUserLabel = (activity: any) =>
    activity.isTempUser
      ? `${activity.userName || activity.userEmail || activity.userId || 'N/D'} (Temp)`
      : activity.userName || activity.userEmail || activity.userId || 'N/D';

  const topAdmin = useMemo(() => {
    const counts = activities.reduce((acc: Record<string, number>, a: any) => {
      if (String(a.status || '').toLowerCase() !== 'borrowed') return acc;
      const key = a.adminName || a.adminEmail || a.adminId || 'Sistema';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const entry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return entry ? { name: entry[0], count: entry[1] } : null;
  }, [activities]);

  const groupedActivity = useMemo(() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, number>();
    activities.forEach((a: any) => {
      if (groupBy === 'user') {
        const key = a.userName || a.userEmail || a.userId || 'N/D';
        map.set(key, (map.get(key) || 0) + 1);
        return;
      }
      if (groupBy === 'genre') {
        const key = a.bookGenre || 'Sem curso';
        map.set(key, (map.get(key) || 0) + 1);
        return;
      }
      const raw = a.borrowedDate;
      if (!raw) return;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      if (groupBy === 'day') {
        const key = d.toISOString().slice(0, 10);
        map.set(key, (map.get(key) || 0) + 1);
        return;
      }
      const day = d.getDay();
      const diff = (day + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - diff);
      const key = monday.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }, [activities, groupBy]);

  const pagedActivities = useMemo(() => {
    const start = (activityPage - 1) * activityPageSize;
    return activities.slice(start, start + activityPageSize);
  }, [activities, activityPage, activityPageSize]);

  const pagedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return userReports.slice(start, start + usersPageSize);
  }, [userReports, usersPage, usersPageSize]);

  const activeBorrowDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const borrowed = activities.filter((act: any) => String(act.status || '').toLowerCase() === 'borrowed');
    const withinDue = borrowed.filter((act: any) => {
      if (!act.dueDate) return true;
      const due = new Date(act.dueDate);
      due.setHours(0, 0, 0, 0);
      return due >= today;
    });
    const overdue = borrowed.filter((act: any) => {
      if (!act.dueDate) return false;
      const due = new Date(act.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < today;
    });

    return { withinDue, overdue };
  }, [activities]);


  useEffect(() => {
    if (reportType === 'genre' || reportType === 'inventory') {
      fetch('/api/books').then(res => res.json()).then(setBooks);
    }
    if (reportType === 'activity') {
      fetchReport();
    }
    if (reportType === 'users') {
      fetch('/api/admin/reports/users').then(res => res.json()).then(setUserReports);
    }
    if (reportType === 'top-books') {
      fetchTopBooks();
    }
  }, [reportType]);

  useEffect(() => {
    if (reportType !== 'activity') return;
    const timer = setTimeout(() => {
      fetchReport();
    }, 200);
    return () => clearTimeout(timer);
  }, [reportType, dates.start, dates.end, statusFilter]);

  useEffect(() => {
    if (reportType !== 'activity') return;
    setActivityPage(1);
    setUsersPage(1);
  }, [reportType, dates.start, dates.end, statusFilter]);

  const fetchReport = async () => {
    const params = new URLSearchParams(dates);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const query = params.toString();
    setFiltering(true);
    try {
      const res = await fetch(`/api/admin/reports/activity?${query}`);
      setActivities(await res.json());
      const summaryRes = await fetch(`/api/admin/reports/activity-summary?${query}`);
      if (summaryRes.ok) {
        setActivitySummary(await summaryRes.json());
      } else {
        setActivitySummary(null);
      }
    } finally {
      setFiltering(false);
    }
  };

  const applyQuickRange = (range: 'today' | 'week' | 'month' | '30d') => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let startDate = new Date(now);
    if (range === 'today') {
      startDate = new Date(now);
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 6);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate.setDate(startDate.getDate() - 29);
    }
    const start = startDate.toISOString().slice(0, 10);
    setDates({ start, end });
  };

  const exportActivityPdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de atividade da biblioteca', 40, 40);
    doc.setFontSize(10);
    doc.text(`Intervalo: ${dates.start || 'Todos'} - ${dates.end || 'Todos'}`, 40, 58);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 72);

    const params = new URLSearchParams(dates);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const query = params.toString();

    const summaryRes = await fetch(`/api/admin/reports/activity-summary?${query}`);
    const summary = summaryRes.ok ? await summaryRes.json() : null;

    const adminCounts = activities.reduce((acc: Record<string, number>, a: any) => {
      if (String(a.status || '').toLowerCase() !== 'borrowed') return acc;
      const key = a.adminName || a.adminEmail || a.adminId || 'Sistema';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topAdmin = summary?.topAdmins?.[0]
      ? [summary.topAdmins[0].name, summary.topAdmins[0].count]
      : Object.entries(adminCounts).sort((a, b) => b[1] - a[1])[0];
    if (topAdmin) {
      doc.setFontSize(10);
      doc.text(`Admin com mais emprestimos aprovados: ${topAdmin[0]} (${topAdmin[1]})`, 40, 90);
    }

    const trend = summary?.trend || [];
    const clicksRes = await fetch(`/api/admin/reports/top-clicked?days=30`);
    const clicksData = clicksRes.ok ? await clicksRes.json() : [];
    const topClicks = Array.isArray(clicksData)
      ? clicksData.slice(0, 6).map((b: any) => ({
          label: String(b.title || 'N/D').slice(0, 10),
          value: Number(b.totalClicks || 0),
        }))
      : [];
    const statusCounts = summary?.statusCounts || activities.reduce((acc: Record<string, number>, a: any) => {
      const s = String(a.status || '').toLowerCase();
      if (s === 'borrowed') acc.borrowed += 1;
      else if (s === 'returned') acc.returned += 1;
      else if (s === 'pending') acc.pending += 1;
      return acc;
    }, { borrowed: 0, returned: 0, pending: 0 });
    const statusData = [
      { label: 'Emprestado', value: statusCounts.borrowed },
      { label: 'Devolvido', value: statusCounts.returned },
      { label: 'Pendente', value: statusCounts.pending },
    ];

    const topGenres = summary?.topGenres || Object.entries(
      activities.reduce((acc: Record<string, number>, a: any) => {
        const key = a.bookGenre || 'Sem curso';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const drawBarChart = (
      x: number,
      y: number,
      width: number,
      height: number,
      data: { label: string; value: number }[],
      color: [number, number, number]
    ) => {
      const max = Math.max(1, ...data.map((d) => d.value));
      const gap = 6;
      const barW = (width - gap * (data.length - 1)) / data.length;
      data.forEach((d, i) => {
        const barH = Math.round((d.value / max) * height);
        const bx = x + i * (barW + gap);
        const by = y + (height - barH);
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(bx, by, barW, barH, 'F');
        doc.setFontSize(7);
        doc.setTextColor(80);
        doc.text(String(d.value), bx + barW / 2, by - 4, { align: 'center' });
        doc.text(d.label, bx + barW / 2, y + height + 10, { align: 'center' });
      });
      doc.setTextColor(0);
    };

    const userCounts = activities.reduce((acc: Record<string, number>, a: any) => {
      const key = a.userName || a.userEmail || a.userId || 'N/D';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const sortedUsers = summary?.users || Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    const topUsers = summary?.topUsers || sortedUsers.slice(0, 10);

    const adminRows = summary?.topAdmins || Object.entries(adminCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    let tableStartY = 120;

    if (adminRows.length) {
      autoTable(doc, {
        startY: tableStartY,
        head: [['Admins com mais aprovacoes', 'Total aprovado']],
        body: adminRows.map((row) => [row.name, String(row.count)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] },
      });
      const last = (doc as any).lastAutoTable?.finalY || tableStartY;
      tableStartY = last + 20;
    }

    if (topUsers.length) {
      autoTable(doc, {
        startY: tableStartY,
        head: [['Top utilizadores (mais emprestimos)', 'Total']],
        body: topUsers.map((row) => [row.name, String(row.count)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [101, 163, 13] },
      });
      const last = (doc as any).lastAutoTable?.finalY || tableStartY;
      tableStartY = last + 20;
    }

    if (sortedUsers.length) {
      autoTable(doc, {
        startY: tableStartY,
        head: [['Utilizadores com emprestimos', 'Total']],
        body: sortedUsers.map((row) => [row.name, String(row.count)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [132, 204, 22] },
      });
      const last = (doc as any).lastAutoTable?.finalY || tableStartY;
      tableStartY = last + 20;
    }

    if (groupBy !== 'none' && groupedActivity.length) {
      autoTable(doc, {
        startY: tableStartY,
        head: [[groupBy === 'user' ? 'Utilizador' : groupBy === 'week' ? 'Semana' : groupBy === 'day' ? 'Dia' : 'Curso', 'Total']],
        body: groupedActivity.map((row: any) => [row.label, String(row.count)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [101, 163, 13] },
      });
      const last = (doc as any).lastAutoTable?.finalY || tableStartY;
      tableStartY = last + 20;
    }

    const rows = activities.map((act) => {
      const statusLabel =
        act.status === 'borrowed' ? 'emprestado' :
        act.status === 'returned' ? 'devolvido' :
        act.status === 'pending' ? 'pendente' :
        act.status;
      return [
        new Date(act.borrowedDate).toLocaleDateString(),
        getActivityUserLabel(act),
        act.bookTitle,
        statusLabel,
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [['Data', 'Utilizador', 'Livro', 'Estado']],
      body: rows.length ? rows : [['-', '-', '-', '-']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [101, 163, 13] },
    });

    let chartY = (doc as any).lastAutoTable?.finalY || tableStartY;
    chartY += 30;

    const ensureSpace = (height: number) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (chartY + height > pageHeight - 40) {
        doc.addPage();
        chartY = 60;
      }
    };

    const drawChartBlock = (title: string, data: { label: string; value: number }[], color: [number, number, number]) => {
      if (!data.length) return;
      ensureSpace(90);
      doc.setFontSize(10);
      doc.text(title, 40, chartY);
      drawBarChart(40, chartY + 10, 220, 50, data, color);
      chartY += 80;
    };

    const drawWideChartBlock = (title: string, data: { label: string; value: number }[], color: [number, number, number]) => {
      if (!data.length) return;
      ensureSpace(90);
      doc.setFontSize(10);
      doc.text(title, 40, chartY);
      drawBarChart(40, chartY + 10, 520, 50, data, color);
      chartY += 80;
    };

    drawChartBlock('Tendencia de requisicoes', trend, [101, 163, 13]);
    drawChartBlock('Estados das requisicoes', statusData, [132, 204, 22]);
    drawWideChartBlock('Top generos', topGenres, [99, 102, 241]);
    drawWideChartBlock('Cliques por livro', topClicks, [244, 114, 182]);

    ensureSpace(30);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Legenda: barras representam total de requisicoes. Base: ${activities.length} registos.`, 40, chartY + 10);
    doc.setTextColor(0);

    const filterSummary = [
      `Intervalo: ${dates.start || 'Todos'} - ${dates.end || 'Todos'}`,
      `Estado: ${statusFilter === 'all' ? 'Todos' : statusFilter}`,
      `Grupo: ${groupBy === 'none' ? 'Nenhum' : groupBy}`,
    ].join(' | ');

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(filterSummary, 40, pageHeight - 24);
      doc.setTextColor(0);
    }

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {
      // ignore watermark if logo fails
    }

    doc.save('relatorio-atividade.pdf');
  };

  const exportTopBooksPdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de livros mais requisitados', 40, 40);
    doc.setFontSize(10);
    doc.text(`Intervalo: ${topRange.start || 'Todos'} - ${topRange.end || 'Todos'}`, 40, 58);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 72);

    const rows = (topBooks || []).map((b: any, index: number) => ([
      String(index + 1),
      b.title || 'N/D',
      b.author || 'N/D',
      b.isbn || 'N/D',
      String(b.totalBorrows ?? 0),
    ]));

    autoTable(doc, {
      startY: 90,
      head: [['#', 'Titulo', 'Autor', 'ISBN', 'Requisicoes']],
      body: rows.length ? rows : [['-', '-', '-', '-', '-']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [101, 163, 13] },
    });

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {
      // ignore watermark if logo fails
    }

    doc.save('relatorio-livros-mais-requisitados.pdf');
  };

  const fetchTopBooks = async () => {
    const params = new URLSearchParams();
    if (topRange.start) params.set('start', topRange.start);
    if (topRange.end) params.set('end', topRange.end);
    params.set('limit', String(topLimit || 10));
    const res = await fetch(`/api/admin/reports/top-books?${params.toString()}`);
    setTopBooks(await res.json());
  };

  const applyTopRange = (range: 'today' | 'week' | 'month' | '30d') => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let startDate = new Date(now);
    if (range === 'today') {
      startDate = new Date(now);
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 6);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate.setDate(startDate.getDate() - 29);
    }
    const start = startDate.toISOString().slice(0, 10);
    setTopRange({ start, end });
  };

  const handleReturn = async () => {
    if (!confirmReturn) return;
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: confirmReturn.tid })
      });
      if (res.ok) {
        fetchReport();
        setConfirmReturn(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const booksByGenre = books.reduce((acc: any, book: any) => {
    const genre = book.genre || 'Sem categoria';
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(book);
    return acc;
  }, {});

  const inventoryStats = {
    totalBooks: books.length,
    physicalBooks: books.filter(b => !b.isDigital).length,
    digitalBooks: books.filter(b => b.isDigital).length,
    outOfStock: books.filter(b => !b.isDigital && b.availableCopies === 0).length,
    lowStock: books.filter(b => !b.isDigital && b.availableCopies > 0 && b.availableCopies < 2).length,
    totalCopies: books.reduce((acc, b) => acc + (b.totalCopies || 0), 0),
    availableCopies: books.reduce((acc, b) => acc + (b.availableCopies || 0), 0),
  };

  const exportGenrePdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de inventario por curso', 40, 40);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 58);

    let currentY = 90;
    const genreEntries = Object.entries(booksByGenre);

    if (genreEntries.length === 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['Curso', 'Livros']],
        body: [['Sem dados', '0']],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [101, 163, 13] },
      });
    } else {
      for (const [genre, genreBooks] of genreEntries) {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        doc.setFontSize(12);
        doc.text(`${genre} (${genreBooks.length} livros)`, 40, currentY);

        autoTable(doc, {
          startY: currentY + 10,
          head: [['Titulo', 'Autor', 'ISBN', 'Tipo', 'Stock']],
          body: (genreBooks as any[]).map((book: any) => [
            book.title || 'N/D',
            book.author || 'N/D',
            book.isbn || 'N/D',
            book.isDigital ? 'Digital' : 'Fisico',
            book.isDigital ? 'Sempre disponivel' : String(book.availableCopies ?? 0),
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [101, 163, 13] },
        });

        currentY = ((doc as any).lastAutoTable?.finalY || currentY + 20) + 24;
      }
    }

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {}

    doc.save('relatorio-inventario-por-curso.pdf');
  };

  const exportInventoryPdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de estado de stock', 40, 40);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 58);
    doc.text(
      `Titulos: ${inventoryStats.totalBooks} | Exemplares: ${inventoryStats.totalCopies} | Disponiveis: ${inventoryStats.availableCopies}`,
      40,
      72
    );
    doc.text(
      `Esgotados: ${inventoryStats.outOfStock} | Stock baixo: ${inventoryStats.lowStock} | Digitais: ${inventoryStats.digitalBooks}`,
      40,
      86
    );

    autoTable(doc, {
      startY: 106,
      head: [['Titulo', 'Autor', 'ISBN', 'Tipo', 'Disponibilidade', 'Estado']],
      body: books.map((book: any) => [
        book.title || 'N/D',
        book.author || 'N/D',
        book.isbn || 'N/D',
        book.isDigital ? 'Digital' : 'Fisico',
        book.isDigital ? '-' : String(book.availableCopies ?? 0),
        book.isDigital
          ? 'Sempre disponivel'
          : book.availableCopies === 0
            ? 'Esgotado'
            : book.availableCopies === 1
              ? 'Stock baixo'
              : 'Em stock',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {}

    doc.save('relatorio-estado-stock.pdf');
  };

  const exportUsersPdf = async () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFontSize(16);
    doc.text('Relatorio de utilizadores e emprestimos', 40, 40);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 58);

    let currentY = 90;

    if (userReports.length === 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['Utilizador', 'Estado', 'Emprestimos ativos']],
        body: [['Sem utilizadores registados', '-', '0']],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [101, 163, 13] },
      });
    } else {
      for (const user of userReports) {
        if (currentY > 680) {
          doc.addPage();
          currentY = 50;
        }

        doc.setFillColor(247, 250, 252);
        doc.roundedRect(40, currentY, 515, 54, 10, 10, 'F');
        doc.setFontSize(12);
        doc.text(user.fullName || user.primaryEmail || user.clerkId, 52, currentY + 18);
        doc.setFontSize(9);
        doc.text(`Email: ${user.primaryEmail || 'N/D'}`, 52, currentY + 34);
        doc.text(`Perfil: ${user.status || 'N/D'}`, 280, currentY + 34);
        doc.text(`Registado em: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/D'}`, 400, currentY + 34);

        const borrows = Array.isArray(user.activeBorrows) ? user.activeBorrows : [];
        autoTable(doc, {
          startY: currentY + 66,
          head: [['Data', 'Livro', 'PID', 'Estado da conta']],
          body: borrows.length
            ? borrows.map((borrow: any) => [
                borrow.borrowedDate ? new Date(borrow.borrowedDate).toLocaleDateString() : 'N/D',
                borrow.bookTitle || 'N/D',
                String(borrow.physicalBookId ?? '-'),
                'Emprestimo ativo',
              ])
            : [['-', 'Sem emprestimos ativos', '-', 'Conta sem movimentos ativos']],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [132, 204, 22] },
        });

        currentY = ((doc as any).lastAutoTable?.finalY || currentY + 70) + 24;
      }
    }

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {}

    doc.save('relatorio-utilizadores-emprestimos.pdf');
  };

  const exportBorrowDeadlinePdf = async (mode: 'within' | 'overdue') => {
    const doc = new jsPDF('p', 'pt');
    const rowsSource = mode === 'within' ? activeBorrowDeadlines.withinDue : activeBorrowDeadlines.overdue;
    const title = mode === 'within'
      ? 'Relatorio de livros emprestados dentro do prazo'
      : 'Relatorio de livros emprestados fora do prazo';

    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(`Intervalo filtrado: ${dates.start || 'Todos'} - ${dates.end || 'Todos'}`, 40, 58);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 40, 72);

    autoTable(doc, {
      startY: 92,
      head: [['Data', 'Limite', 'Utilizador', 'Livro', 'Estado']],
      body: rowsSource.length
        ? rowsSource.map((act: any) => [
            act.borrowedDate ? new Date(act.borrowedDate).toLocaleDateString() : 'N/D',
            act.dueDate ? new Date(act.dueDate).toLocaleDateString() : 'Sem limite',
            getActivityUserLabel(act),
            act.bookTitle || 'N/D',
            mode === 'within' ? 'Dentro do prazo' : 'Fora do prazo',
          ])
        : [['Sem registos', '-', '-', '-', '-']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: mode === 'within' ? [16, 185, 129] : [239, 68, 68] },
    });

    try {
      const logo = await loadWatermarkImage(LOGO_WATERMARK);
      addCenteredWatermarkToAllPages(doc, logo, { width: 160 });
    } catch {}

    doc.save(mode === 'within' ? 'relatorio-emprestimos-dentro-prazo.pdf' : 'relatorio-emprestimos-fora-prazo.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button 
          onClick={() => setReportType('activity')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'activity' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <History className="w-4 h-4" /> Atividade
        </button>
        <button 
          onClick={() => setReportType('genre')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'genre' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <ListFilter className="w-4 h-4" /> Por curso
        </button>
        <button 
          onClick={() => setReportType('inventory')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'inventory' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <Package className="w-4 h-4" /> Estado do stock
        </button>
        <button 
          onClick={() => setReportType('users')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'users' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <Users className="w-4 h-4" /> Utilizadores e emprestimos
        </button>
        <button 
          onClick={() => setReportType('top-books')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
            reportType === 'top-books' ? "bg-lime-600 text-white shadow-lg" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <TrendingUp className="w-4 h-4" /> Mais requisitados
        </button>
      </div>

      {reportType === 'activity' && (
        <>
          <Card className="p-6 print:hidden">
            <h2 className="text-xl font-bold mb-4">Relatorios de atividade</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Data de inicio</label>
                <input type="date" className="px-4 py-2 border rounded-lg" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data de fim</label>
                <input type="date" className="px-4 py-2 border rounded-lg" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Todos</option>
                  <option value="borrowed">Emprestado</option>
                  <option value="returned">Devolvido</option>
                  <option value="pending">Pendente</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Agrupar por</label>
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                >
                  <option value="none">Nenhum</option>
                  <option value="user">Utilizador</option>
                  <option value="week">Semana</option>
                  <option value="day">Dia</option>
                  <option value="genre">Curso</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => applyQuickRange('today')}>Hoje</Button>
                <Button variant="secondary" onClick={() => applyQuickRange('week')}>Esta semana</Button>
                <Button variant="secondary" onClick={() => applyQuickRange('month')}>Este mes</Button>
                <Button variant="secondary" onClick={() => applyQuickRange('30d')}>Ultimos 30 dias</Button>
              </div>
              <Button onClick={fetchReport}>Filtrar atividades</Button>
              <Button variant="secondary" onClick={exportActivityPdf} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Baixar PDF
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportBorrowDeadlinePdf('within')}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Dentro do prazo
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportBorrowDeadlinePdf('overdue')}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Fora do prazo
              </Button>
              {filtering && (
                <span className="text-xs text-gray-400">A filtrar...</span>
              )}
              {topAdmin && (
                <span className="text-xs text-gray-500">
                  Admin com mais atividades: <span className="font-semibold">{topAdmin.name}</span> ({topAdmin.count})
                </span>
              )}
            </div>
          </Card>

          {activitySummary && (
            <Card className="p-6 print:hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-[10px] uppercase text-emerald-400 font-bold tracking-widest">Top admins</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {(activitySummary.topAdmins || []).slice(0, 5).map((row: any) => (
                      <div key={row.name} className="flex justify-between text-emerald-700">
                        <span className="truncate">{row.name}</span>
                        <span className="font-semibold">{row.count}</span>
                      </div>
                    ))}
                    {(!activitySummary.topAdmins || activitySummary.topAdmins.length === 0) && (
                      <p className="text-xs text-emerald-400">Sem dados.</p>
                    )}
                  </div>
                </div>
                <div className="bg-lime-50 border border-lime-100 rounded-xl p-4">
                  <p className="text-[10px] uppercase text-lime-400 font-bold tracking-widest">Top utilizadores</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {(activitySummary.topUsers || []).slice(0, 5).map((row: any) => (
                      <div key={row.name} className="flex justify-between text-lime-700">
                        <span className="truncate">{row.name}</span>
                        <span className="font-semibold">{row.count}</span>
                      </div>
                    ))}
                    {(!activitySummary.topUsers || activitySummary.topUsers.length === 0) && (
                      <p className="text-xs text-lime-400">Sem dados.</p>
                    )}
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-[10px] uppercase text-indigo-400 font-bold tracking-widest">Top cursos</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {(activitySummary.topGenres || []).slice(0, 5).map((row: any) => (
                      <div key={row.label} className="flex justify-between text-indigo-700">
                        <span className="truncate">{row.label}</span>
                        <span className="font-semibold">{row.value}</span>
                      </div>
                    ))}
                    {(!activitySummary.topGenres || activitySummary.topGenres.length === 0) && (
                      <p className="text-xs text-indigo-400">Sem dados.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {groupBy !== 'none' && (
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">Resumo por {groupBy === 'user' ? 'utilizador' : groupBy === 'week' ? 'semana' : groupBy === 'day' ? 'dia' : 'curso'}</h2>
              {groupedActivity.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados para agrupar.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="p-3 text-xs uppercase text-gray-400">{groupBy === 'user' ? 'Utilizador' : groupBy === 'week' ? 'Semana' : groupBy === 'day' ? 'Dia' : 'Curso'}</th>
                      <th className="p-3 text-xs uppercase text-gray-400 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupedActivity.map((row) => (
                      <tr key={row.label}>
                        <td className="p-3 text-sm">{row.label}</td>
                        <td className="p-3 text-sm text-right font-semibold">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          <Card className="overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-100 hidden print:block">
              <h1 className="text-2xl font-bold">Relatorio de atividade da biblioteca</h1>
              <p className="text-sm text-gray-500">Intervalo: {dates.start || 'Todos'} - {dates.end || 'Todos'}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-bottom border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-sm">Data</th>
                  <th className="p-4 font-semibold text-sm">Utilizador</th>
                  <th className="p-4 font-semibold text-sm">Livro</th>
                  <th className="p-4 font-semibold text-sm">Estado</th>
                  <th className="p-4 font-semibold text-sm print:hidden">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <History className="w-8 h-8 opacity-20" />
                        <p className="text-sm font-medium italic">Nao foram encontradas atividades para o intervalo selecionado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedActivities.map(act => (
                    <tr
                      key={act.tid}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBookInfo(act.book || {
                        id: act.bookId,
                        title: act.bookTitle,
                        author: act.bookAuthor,
                        isbn: act.isbn,
                        genre: act.bookGenre,
                        cover: act.bookCover,
                        availableCopies: act.bookAvailableCopies,
                        totalCopies: act.bookTotalCopies,
                        fileUrl: act.bookFileUrl,
                        isDigital: act.bookIsDigital,
                      })}
                    >
                      <td className="p-4 text-sm">{new Date(act.borrowedDate).toLocaleDateString()}</td>
                      <td className="p-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span>{getActivityUserLabel(act)}</span>
                          {act.isTempUser && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                              Temp
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        <p className="font-bold">{act.bookTitle}</p>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const statusLabel =
                            act.status === 'borrowed' ? 'emprestado' :
                            act.status === 'returned' ? 'devolvido' :
                            act.status === 'pending' ? 'pendente' :
                            act.status;
                          return (
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                              act.status === 'pending'
                                ? "bg-amber-100 text-amber-700"
                                : act.status === 'borrowed'
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-green-100 text-green-700"
                            )}>
                              {statusLabel}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-4 print:hidden">
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicket(act);
                            }}
                            className="p-2 text-lime-600 hover:bg-lime-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                            title="Ver talao"
                          >
                            <Ticket className="w-4 h-4" />
                          </button>
                          {act.status === 'borrowed' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmReturn(act);
                              }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                              title="Devolver livro"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {activities.length > activityPageSize && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  A mostrar {(activityPage - 1) * activityPageSize + 1}–
                  {Math.min(activityPage * activityPageSize, activities.length)} de {activities.length}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    className="px-2 py-1 border rounded-lg text-xs"
                    value={activityPageSize}
                    onChange={(e) => {
                      setActivityPageSize(Number(e.target.value));
                      setActivityPage(1);
                    }}
                  >
                    {[10, 20, 30, 50].map((size) => (
                      <option key={size} value={size}>{size}/pagina</option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                    disabled={activityPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setActivityPage((p) =>
                        Math.min(Math.ceil(activities.length / activityPageSize), p + 1)
                      )
                    }
                    disabled={activityPage >= Math.ceil(activities.length / activityPageSize)}
                  >
                    Proximo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {reportType === 'genre' && (
        <>
          <Card className="p-6 print:hidden flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Inventario por curso</h2>
              <p className="text-sm text-gray-500">Listagem de todos os livros agrupados por categoria.</p>
            </div>
            <Button variant="secondary" onClick={exportGenrePdf} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Baixar PDF
            </Button>
          </Card>

          <div className="space-y-8 print:space-y-4">
            {Object.keys(booksByGenre).length === 0 ? (
              <Card className="p-20 text-center flex flex-col items-center gap-4 text-gray-400">
                <ListFilter className="w-12 h-12 opacity-10" />
                <p className="text-lg font-medium italic">Nao foram encontrados livros no inventario.</p>
              </Card>
            ) : (
              Object.entries(booksByGenre).map(([genre, genreBooks]: [string, any]) => (
                <div key={genre}>
                  <Card className="overflow-hidden print:border-none print:shadow-none">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-lime-600 uppercase tracking-wider text-sm">{genre}</h3>
                      <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg border border-gray-200">{genreBooks.length} Livros</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400">Titulo</th>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400">Autor</th>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400">ISBN</th>
                          <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {genreBooks.map((book: any) => (
                          <tr
                            key={book.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedBookInfo(book)}
                          >
                            <td className="p-4 text-sm font-bold">{book.title}</td>
                            <td className="p-4 text-sm text-gray-600">{book.author}</td>
                            <td className="p-4 text-xs font-mono text-gray-400">{book.isbn}</td>
                            <td className="p-4 text-sm text-right font-bold">
                              {book.isDigital ? (
                                <span className="text-purple-600 uppercase text-[10px]">Digital</span>
                              ) : (
                                <span className={cn(book.availableCopies > 0 ? "text-green-600" : "text-red-600")}>
                                  {book.availableCopies}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {reportType === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
            <Card className="p-4 bg-lime-50 border-lime-100">
              <p className="text-[10px] font-bold text-lime-400 uppercase tracking-widest mb-1">Total de titulos</p>
              <p className="text-2xl font-black text-lime-700">{inventoryStats.totalBooks}</p>
              <p className="text-[10px] text-lime-400 mt-1">{inventoryStats.physicalBooks} Fisicos / {inventoryStats.digitalBooks} Digitais</p>
            </Card>
            <Card className="p-4 bg-emerald-50 border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Total de exemplares</p>
              <p className="text-2xl font-black text-emerald-700">{inventoryStats.totalCopies}</p>
              <p className="text-[10px] text-emerald-400 mt-1">{inventoryStats.availableCopies} Disponiveis para requisicao</p>
            </Card>
            <Card className="p-4 bg-red-50 border-red-100">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Esgotado</p>
              <p className="text-2xl font-black text-red-700">{inventoryStats.outOfStock}</p>
              <p className="text-[10px] text-red-400 mt-1">Titulos sem exemplares disponiveis</p>
            </Card>
            <Card className="p-4 bg-amber-50 border-amber-100">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Stock baixo</p>
              <p className="text-2xl font-black text-amber-700">{inventoryStats.lowStock}</p>
              <p className="text-[10px] text-amber-400 mt-1">Titulos com apenas 1 exemplar</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="text-xl font-bold">Estado completo do inventario</h2>
              <Button variant="secondary" onClick={exportInventoryPdf} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Baixar PDF
              </Button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Detalhes do livro</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">ISBN</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Tipo</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Disponibilidade</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {books.map(book => (
                  <tr
                    key={book.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedBookInfo(book)}
                  >
                    <td className="p-4">
                      <p className="text-sm font-bold">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author}</p>
                    </td>
                    <td className="p-4 text-xs font-mono text-gray-400">{book.isbn}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                        book.isDigital ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {book.isDigital ? 'Digital' : 'Fisico'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-right font-mono">
                      {book.isDigital ? '-' : `${book.availableCopies}`}
                    </td>
                    <td className="p-4 text-right">
                      {!book.isDigital && (
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          book.availableCopies === 0 ? "bg-red-100 text-red-700" : 
                          book.availableCopies === 1 ? "bg-amber-100 text-amber-700" : 
                          "bg-green-100 text-green-700"
                        )}>
                          {book.availableCopies === 0 ? 'Esgotado' : 
                           book.availableCopies === 1 ? 'Stock baixo' : 'Em stock'}
                        </span>
                      )}
                      {book.isDigital && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-lime-100 text-lime-700">
                          Sempre disponivel
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {reportType === 'users' && (
        <div className="space-y-6">
          <Card className="p-6 print:hidden flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Diretorio de utilizadores e emprestimos ativos</h2>
              <p className="text-sm text-gray-500">Lista completa de todos os utilizadores registados e dos itens atualmente requisitados.</p>
            </div>
            <Button variant="secondary" onClick={exportUsersPdf} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Baixar PDF conta corrente
            </Button>
          </Card>

          <Card className="overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-100 hidden print:block">
              <h1 className="text-2xl font-bold">Relatorio de utilizadores da biblioteca</h1>
              <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Informacao do utilizador</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Estado</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Registado em</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Emprestimos ativos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-gray-400">
                        <Users className="w-12 h-12 opacity-10" />
                        <p className="text-lg font-medium italic">Nao foram encontrados utilizadores registados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedUsers.map(user => (
                    <tr key={user.clerkId} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="p-4">
                        <p className="text-sm font-bold">{user.fullName || user.primaryEmail}</p>
                        <p className="text-[10px] text-gray-400">{user.primaryEmail}</p>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          user.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {user.status === 'active' ? 'ativo' : user.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        {user.activeBorrows.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">Sem emprestimos ativos</span>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-lime-50/60">
                              <tr>
                                <th className="p-2 text-[9px] uppercase text-lime-500">Livro</th>
                                <th className="p-2 text-[9px] uppercase text-lime-500">PID</th>
                                <th className="p-2 text-[9px] uppercase text-lime-500 text-right">Data</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-lime-50">
                              {user.activeBorrows.map((borrow: any) => (
                                <tr key={borrow.tid} className="bg-lime-50/30">
                                  <td className="p-2 text-[10px] font-semibold text-lime-900">{borrow.bookTitle}</td>
                                  <td className="p-2 text-[9px] font-mono text-lime-500">{borrow.physicalBookId}</td>
                                  <td className="p-2 text-[9px] text-right text-lime-500">
                                    {new Date(borrow.borrowedDate).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {userReports.length > usersPageSize && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  A mostrar {(usersPage - 1) * usersPageSize + 1}–
                  {Math.min(usersPage * usersPageSize, userReports.length)} de {userReports.length}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    className="px-2 py-1 border rounded-lg text-xs"
                    value={usersPageSize}
                    onChange={(e) => {
                      setUsersPageSize(Number(e.target.value));
                      setUsersPage(1);
                    }}
                  >
                    {[8, 16, 24, 40].map((size) => (
                      <option key={size} value={size}>{size}/pagina</option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    disabled={usersPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setUsersPage((p) =>
                        Math.min(Math.ceil(userReports.length / usersPageSize), p + 1)
                      )
                    }
                    disabled={usersPage >= Math.ceil(userReports.length / usersPageSize)}
                  >
                    Proximo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {reportType === 'top-books' && (
        <div className="space-y-6">
          <Card className="p-6 print:hidden flex flex-wrap gap-4 items-end justify-between">
            <div>
              <h2 className="text-xl font-bold">Livros mais requisitados</h2>
              <p className="text-sm text-gray-500">Ranking dos titulos com mais requisicoes.</p>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Data de inicio</label>
                <input type="date" className="px-4 py-2 border rounded-lg" value={topRange.start} onChange={e => setTopRange({ ...topRange, start: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data de fim</label>
                <input type="date" className="px-4 py-2 border rounded-lg" value={topRange.end} onChange={e => setTopRange({ ...topRange, end: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Top</label>
                <select className="px-4 py-2 border rounded-lg" value={topLimit} onChange={(e) => setTopLimit(Number(e.target.value))}>
                  {[5, 10, 20, 30].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => applyTopRange('today')}>Hoje</Button>
                <Button variant="secondary" onClick={() => applyTopRange('week')}>Esta semana</Button>
                <Button variant="secondary" onClick={() => applyTopRange('month')}>Este mes</Button>
                <Button variant="secondary" onClick={() => applyTopRange('30d')}>Ultimos 30 dias</Button>
              </div>
              <Button onClick={fetchTopBooks}>Filtrar</Button>
              <Button variant="secondary" onClick={exportTopBooksPdf} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Baixar PDF
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-gray-100 hidden print:block">
              <h1 className="text-2xl font-bold">Relatorio de livros mais requisitados</h1>
              <p className="text-sm text-gray-500">Intervalo: {topRange.start || 'Todos'} - {topRange.end || 'Todos'}</p>
              <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()}</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">#</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Titulo</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">Autor</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400">ISBN</th>
                  <th className="p-4 font-semibold text-xs uppercase text-gray-400 text-right">Requisicoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <TrendingUp className="w-8 h-8 opacity-20" />
                        <p className="text-sm font-medium italic">Ainda nao ha dados suficientes para o ranking.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  topBooks.map((b: any, index: number) => (
                    <tr
                      key={`${b.bookId}-${index}`}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBookInfo(b)}
                    >
                      <td className="p-4 text-sm font-bold">{index + 1}</td>
                      <td className="p-4 text-sm font-semibold">{b.title}</td>
                      <td className="p-4 text-sm text-gray-600">{b.author}</td>
                      <td className="p-4 text-xs font-mono text-gray-400">{b.isbn}</td>
                      <td className="p-4 text-sm text-right font-bold">{b.totalBorrows}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <AnimatePresence>
        {selectedTicket && (
          <BorrowTicket activity={selectedTicket} onClose={() => setSelectedTicket(null)} />
        )}
        {selectedBookInfo && (
          <BookInfoModal
            book={selectedBookInfo}
            onClose={() => setSelectedBookInfo(null)}
          />
        )}
        
        {confirmReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center gap-3 text-amber-600">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Confirmar devolucao</h3>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-600">Tem a certeza de que quer marcar este livro como devolvido? Isto ira atualizar o inventario e notificar reservas pendentes.</p>
                
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold">Livro</span>
                    <span className="font-bold">{confirmReturn.bookTitle}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold">Utilizador</span>
                    <span className="font-bold">{confirmReturn.userName || confirmReturn.userEmail || confirmReturn.userId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold">ID fisico</span>
                    <span className="font-mono">{confirmReturn.physicalBookId}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmReturn(null)} disabled={loading}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleReturn} disabled={loading}>
                  {loading ? 'A processar...' : 'Confirmar devolucao'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
