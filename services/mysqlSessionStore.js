'use strict';

// Store express-session qui conserve les sessions dans la table MySQL `sessions`.
// Les sessions survivent ainsi aux redémarrages du serveur (Hostinger relance
// régulièrement les applications Node.js).

const session = require('express-session');

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

class MySQLSessionStore extends session.Store {
  constructor(db, { ttlMs }) {
    super();
    this.db = db;
    this.ttlMs = ttlMs;
    const timer = setInterval(() => this._cleanup().catch(() => {}), CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  async _pool() {
    await this.db.init();
    return this.db.pool;
  }

  _expires(sess) {
    const cookieExpires = sess && sess.cookie && sess.cookie.expires;
    return cookieExpires ? new Date(cookieExpires).getTime() : Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    this._pool()
      .then(pool => pool.query('SELECT `data`, `expires` FROM `sessions` WHERE `session_id` = ?', [sid]))
      .then(([rows]) => {
        if (!rows.length || Number(rows[0].expires) < Date.now()) return cb(null, null);
        cb(null, JSON.parse(rows[0].data));
      })
      .catch(err => cb(err));
  }

  set(sid, sess, cb = () => {}) {
    const expires = this._expires(sess);
    this._pool()
      .then(pool => pool.query(
        'INSERT INTO `sessions` (`session_id`, `expires`, `data`) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE `expires` = VALUES(`expires`), `data` = VALUES(`data`)',
        [sid, expires, JSON.stringify(sess)]
      ))
      .then(() => cb(null))
      .catch(err => cb(err));
  }

  touch(sid, sess, cb = () => {}) {
    this._pool()
      .then(pool => pool.query('UPDATE `sessions` SET `expires` = ? WHERE `session_id` = ?', [this._expires(sess), sid]))
      .then(() => cb(null))
      .catch(err => cb(err));
  }

  destroy(sid, cb = () => {}) {
    this._pool()
      .then(pool => pool.query('DELETE FROM `sessions` WHERE `session_id` = ?', [sid]))
      .then(() => cb(null))
      .catch(err => cb(err));
  }

  async _cleanup() {
    const pool = await this._pool();
    await pool.query('DELETE FROM `sessions` WHERE `expires` < ?', [Date.now()]);
  }
}

module.exports = MySQLSessionStore;
