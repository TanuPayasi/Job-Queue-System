const express = require('express');
const router = express.Router();
const { pool } = require('../db/postgres');
const jobQueue = require('../queues/jobQueue');

router.post('/', async (req, res) => {
  try {
    const { type, payload } = req.body;

    if (!type || !payload)
      return res.status(400).json({ message: 'type and payload are required' });

    const validTypes = ['email', 'image-resize', 'report'];
    if (!validTypes.includes(type))
      return res.status(400).json({ message: `type must be one of: ${validTypes.join(', ')}` });

    if (type === 'email') {
      if (!payload.recipient || !payload.subject || !payload.body)
        return res.status(400).json({ message: 'email jobs require recipient, subject, and body' });
    }

    if (type === 'image-resize') {
      if (!payload.imageUrl || !payload.dimensions)
        return res.status(400).json({ message: 'image-resize jobs require imageUrl and dimensions' });
    }

    if (type === 'report') {
      if (!payload.reportType)
        return res.status(400).json({ message: 'report jobs require reportType' });
    }

    const dbResult = await pool.query(
      'INSERT INTO jobs (type, payload, status) VALUES ($1, $2, $3) RETURNING id',
      [type, JSON.stringify(payload), 'pending']
    );

    const dbId = dbResult.rows[0].id;

    const bullJob = await jobQueue.add(type, {
      type,
      payload,
      dbId,
    });

    res.status(201).json({
      message: 'Job created successfully',
      jobId: dbId,
      bullJobId: bullJob.id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;

    let query = 'SELECT * FROM jobs';
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    if (conditions.length > 0)
      query += ' WHERE ' + conditions.join(' AND ');

    query += ' ORDER BY created_at DESC';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM jobs ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`,
      params
    );

    const totalJobs = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalJobs / limit);
    const offset = (page - 1) * limit;

    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      jobs: result.rows,
      currentPage: parseInt(page),
      totalPages,
      totalJobs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Job not found' });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Job not found' });

    const job = result.rows[0];

    if (job.status !== 'failed')
      return res.status(400).json({ message: 'Only failed jobs can be retried' });

    await pool.query(
      'UPDATE jobs SET status = $1, error = NULL, attempts = 0, updated_at = NOW() WHERE id = $2',
      ['pending', job.id]
    );

    await jobQueue.add(job.type, {
      type: job.type,
      payload: job.payload,
      dbId: job.id,
    });

    res.json({ message: 'Job requeued successfully', jobId: job.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;