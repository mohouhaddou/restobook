'use strict';

const sequelize = require('../../../../models/db');

function json(value) {
  return JSON.stringify(value == null ? null : value);
}

async function query(sql, replacements = {}) {
  const [rows] = await sequelize.query(sql, { replacements });
  return rows;
}

async function one(sql, replacements = {}) {
  const rows = await query(sql, replacements);
  return rows[0] || null;
}

async function exec(sql, replacements = {}) {
  return sequelize.query(sql, { replacements });
}

function parseJsonFields(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const field of fields) {
    if (typeof out[field] === 'string') {
      try { out[field] = JSON.parse(out[field]); } catch {}
    }
  }
  return out;
}

async function audit({ userId = null, campaignId = null, taskId = null, sourceId = null, action, oldValue = null, newValue = null, ipAddress = null, reason = null, result = 'ok', durationMs = null, errorCode = null }) {
  await exec(
    `INSERT INTO acquisition_audit_logs
      (user_id, campaign_id, task_id, source_id, action, old_value, new_value, ip_address, reason, result, duration_ms, error_code)
     VALUES
      (:userId, :campaignId, :taskId, :sourceId, :action, CAST(:oldValue AS JSON), CAST(:newValue AS JSON), :ipAddress, :reason, :result, :durationMs, :errorCode)`,
    {
      userId,
      campaignId,
      taskId,
      sourceId,
      action,
      oldValue: json(oldValue),
      newValue: json(newValue),
      ipAddress,
      reason,
      result,
      durationMs,
      errorCode,
    }
  );
}

module.exports = { audit, exec, json, one, parseJsonFields, query, sequelize };
