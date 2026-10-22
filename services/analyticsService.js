'use strict';

const db = require('./db');
const config = require('../config/appConfig');

async function getDashboardStats(userId, role) {
  const isSuperAdmin = role === 'super_admin';

  let membersQuery = {};
  if (!isSuperAdmin) membersQuery = { adminId: userId };

  const [
    totalMembers, activeMembers, totalEvents, upcomingEvents,
    totalEvangelism, pendingTestimonies, totalFinancesIn, totalFinancesOut,
    totalTeachings, totalAnnouncements,
  ] = await Promise.all([
    db.count(config.collections.MEMBERS, isSuperAdmin ? {} : { adminId: userId }),
    db.count(config.collections.MEMBERS, isSuperAdmin ? { statut: 'actif' } : { adminId: userId, statut: 'actif' }),
    db.count(config.collections.EVENTS, {}),
    db.count(config.collections.EVENTS, { statut: 'a_venir' }),
    db.count(config.collections.EVANGELISM, isSuperAdmin ? {} : { adminId: userId }),
    db.count(config.collections.TESTIMONIES, { statut: 'en_attente' }),
    db.sum(config.collections.FINANCES, 'montant', { type: 'don', statut: 'approuve' }),
    db.sum(config.collections.FINANCES, 'montant', { type: 'depense', statut: 'approuve' }),
    db.count(config.collections.TEACHINGS, {}),
    db.count(config.collections.ANNOUNCEMENTS, { actif: true }),
  ]);

  return {
    membres: { total: totalMembers, actifs: activeMembers },
    evenements: { total: totalEvents, aVenir: upcomingEvents },
    evangelisme: { total: totalEvangelism },
    temoignages: { enAttente: pendingTestimonies },
    finances: { entrees: totalFinancesIn, sorties: totalFinancesOut, solde: totalFinancesIn - totalFinancesOut },
    enseignements: { total: totalTeachings },
    annonces: { actives: totalAnnouncements },
  };
}

async function getEvangelismStats(userId, role) {
  const isSuperAdmin = role === 'super_admin';
  const query = isSuperAdmin ? {} : { adminId: userId };
  const all = await db.findMany(config.collections.EVANGELISM, query);

  const byStatus = all.reduce((acc, e) => {
    acc[e.statut] = (acc[e.statut] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const monthlyData = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = 0;
  }
  all.forEach(e => {
    const d = new Date(e.dateEvangelisation || e.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in monthlyData) monthlyData[key]++;
  });

  return { total: all.length, parStatut: byStatus, parMois: monthlyData };
}

async function getFinanceStats() {
  const all = await db.findAll(config.collections.FINANCES, {
    sort: { field: 'createdAt', order: 'desc' },
  });
  const records = all.data;

  const totalDons = records.filter(r => r.type === 'don' && r.statut === 'approuve').reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const totalOffrendes = records.filter(r => r.type === 'offrande' && r.statut === 'approuve').reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const totalDepenses = records.filter(r => r.type === 'depense' && r.statut === 'approuve').reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const solde = totalDons + totalOffrendes - totalDepenses;

  const monthlyData = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { entrees: 0, sorties: 0 };
  }
  records.filter(r => r.statut === 'approuve').forEach(r => {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in monthlyData) {
      if (r.type === 'depense') monthlyData[key].sorties += Number(r.montant) || 0;
      else monthlyData[key].entrees += Number(r.montant) || 0;
    }
  });

  return { totalDons, totalOffrendes, totalDepenses, solde, parMois: monthlyData };
}

async function getMembersGrowth() {
  const all = await db.findAll(config.collections.MEMBERS, {});
  const members = all.data;
  const monthlyData = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = 0;
  }
  members.forEach(m => {
    const d = new Date(m.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in monthlyData) monthlyData[key]++;
  });
  return { total: members.length, parMois: monthlyData };
}

module.exports = { getDashboardStats, getEvangelismStats, getFinanceStats, getMembersGrowth };
