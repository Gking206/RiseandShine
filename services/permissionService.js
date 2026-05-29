'use strict';

const config = require('../config/appConfig');

const ROLE_PERMISSIONS = {
  super_admin: [
    'manage_users', 'create_users', 'create_admins', 'create_super_admins',
    'manage_members', 'edit_permissions', 'promote_users', 'demote_users',
    'disable_accounts', 'reset_passwords', 'manage_finances', 'manage_events',
    'manage_teachings', 'manage_all_reports', 'access_analytics', 'manage_settings',
    'manage_announcements', 'manage_social', 'view_all_members', 'view_confidential_reports',
    'reassign_members', 'manage_galleries', 'approve_testimonies', 'manage_evangelism',
    'view_finances', 'export_data', 'manage_backups', 'view_logs',
  ],
  admin: [
    'manage_assigned_members', 'manage_testimonies', 'organize_events',
    'create_confidential_reports', 'follow_evangelism', 'upload_teachings',
    'supervise_follow_up', 'view_assigned_members', 'approve_testimonies',
    'manage_evangelism', 'create_events', 'upload_galleries',
  ],
  membre: [
    'view_events', 'access_teachings', 'access_galleries', 'submit_testimonies',
    'share_experiences', 'register_evangelism', 'update_profile', 'view_community',
  ],
};

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(userRole, permission) {
  const permissions = getRolePermissions(userRole);
  return permissions.includes(permission);
}

function hasRole(userRole, requiredRole) {
  if (requiredRole === 'super_admin') return userRole === 'super_admin';
  if (requiredRole === 'admin') return userRole === 'super_admin' || userRole === 'admin';
  return true;
}

function isSuperAdmin(role) {
  return role === config.roles.SUPER_ADMIN;
}

function isAdmin(role) {
  return role === config.roles.ADMIN || role === config.roles.SUPER_ADMIN;
}

function isMembre(role) {
  return role === config.roles.MEMBRE;
}

module.exports = {
  getRolePermissions,
  hasPermission,
  hasRole,
  isSuperAdmin,
  isAdmin,
  isMembre,
};
