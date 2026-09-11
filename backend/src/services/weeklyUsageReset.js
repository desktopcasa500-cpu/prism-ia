import { pool } from '../db/pool.js';

export async function resetExpiredWeeklyLocks() {
  const result = await pool.query(
    `UPDATE users
        SET weekly_locked_until = NULL
      WHERE weekly_locked_until IS NOT NULL
        AND weekly_locked_until <= now()
      RETURNING id`,
  );
  return result.rowCount || 0;
}
