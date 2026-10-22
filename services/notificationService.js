'use strict';

const db = require('./db');
const config = require('../config/appConfig');

async function createNotification(userId, type, message, data = {}) {
  return db.create(config.collections.NOTIFICATIONS, {
    userId,
    type,
    message,
    data,
    lu: false,
  });
}

async function notifyUser(userId, message, type = 'info') {
  return createNotification(userId, type, message);
}

async function notifyAdmins(message, type = 'info') {
  const admins = await db.findMany(config.collections.USERS, { role: 'admin' });
  const superAdmins = await db.findMany(config.collections.USERS, { role: 'super_admin' });
  const all = [...admins, ...superAdmins];
  await Promise.all(all.map(u => createNotification(u.id, type, message)));
}

async function notifySuperAdmins(message, type = 'info') {
  const superAdmins = await db.findMany(config.collections.USERS, { role: 'super_admin' });
  await Promise.all(superAdmins.map(u => createNotification(u.id, type, message)));
}

async function getUserNotifications(userId, options = {}) {
  const all = await db.findAll(config.collections.NOTIFICATIONS, {
    filter: { userId },
    sort: { field: 'createdAt', order: 'desc' },
    limit: options.limit || 50,
  });
  return all.data;
}

async function getUnreadCount(userId) {
  return db.count(config.collections.NOTIFICATIONS, { userId, lu: false });
}

async function markAsRead(notificationId) {
  return db.update(config.collections.NOTIFICATIONS, notificationId, { lu: true });
}

async function markAllAsRead(userId) {
  const notifs = await db.findMany(config.collections.NOTIFICATIONS, { userId, lu: false });
  await Promise.all(notifs.map(n => db.update(config.collections.NOTIFICATIONS, n.id, { lu: true })));
  return notifs.length;
}

module.exports = {
  createNotification,
  notifyUser,
  notifyAdmins,
  notifySuperAdmins,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
