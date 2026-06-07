const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('subscribe', (jobId) => {
      socket.join(`job:${jobId}`);
      console.log(`Client subscribed to job:${jobId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const emitJobUpdate = (jobId, data) => {
  if (io) {
    io.to(`job:${jobId}`).emit('job:update', data);
  }
};

module.exports = { initSocket, emitJobUpdate };