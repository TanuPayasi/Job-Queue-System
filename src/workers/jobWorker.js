const { Worker } = require('bullmq');
const { pool } = require('../db/postgres');
require('dotenv').config();

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
};

const processJob = async (job) => {
  console.log(`Processing job ${job.id} of type ${job.data.type} (attempt ${job.attemptsMade + 1})`);

  await pool.query(
    'UPDATE jobs SET status = $1, attempts = $2, updated_at = NOW() WHERE id = $3',
    ['processing', job.attemptsMade + 1, job.data.dbId]
  );

  if (job.data.payload.simulateFailure && job.attemptsMade < 2) {
    throw new Error('Simulated failure for testing retry logic');
  }

  let result;

  if (job.data.type === 'email') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = {
      sent: true,
      recipient: job.data.payload.recipient,
      timestamp: new Date().toISOString(),
    };
  }

  else if (job.data.type === 'image-resize') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    result = {
      resized: true,
      originalUrl: job.data.payload.imageUrl,
      dimensions: job.data.payload.dimensions,
      timestamp: new Date().toISOString(),
    };
  }

  else if (job.data.type === 'report') {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    result = {
      generated: true,
      reportType: job.data.payload.reportType,
      recordCount: Math.floor(Math.random() * 1000) + 100,
      timestamp: new Date().toISOString(),
    };
  }

  else {
    throw new Error(`Unknown job type: ${job.data.type}`);
  }

  await pool.query(
    'UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3',
    ['completed', JSON.stringify(result), job.data.dbId]
  );

  return result;
};

const worker = new Worker('jobs', processJob, {
  connection,
  concurrency: 5,
});

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on('failed', async (job, error) => {
  console.error(`Job ${job.id} failed:`, error.message);

  if (job.attemptsMade >= job.opts.attempts) {
    await pool.query(
      'UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3',
      ['failed', error.message, job.data.dbId]
    );
  }
});

module.exports = worker;