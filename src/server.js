const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { initDB } = require('./db/postgres');
const { initSocket } = require('./socket/index');
const jobQueue = require('./queues/jobQueue');
const worker = require('./workers/jobWorker');

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

initSocket(httpServer);

app.use(cors());
app.use(express.json());

app.use('/api/jobs', require('./routes/jobs'));

app.get('/', (req, res) => {
  res.json({ message: 'Job Queue API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong',
  });
});

const start = async () => {
  await initDB();
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Worker running with concurrency 5`);
  });
};

start();