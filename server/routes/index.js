import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import conversationRoutes from './conversationRoutes.js';
import messageRoutes from './messageRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import groupRoutes from './groupRoutes.js';
import searchRoutes from './searchRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import aiRoutes from './aiRoutes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'VakSetu API Server is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// Users routes
router.use('/users', userRoutes);

// Conversations routes
router.use('/conversations', conversationRoutes);

// Messages routes
router.use('/messages', messageRoutes);

// File Upload routes
router.use('/upload', uploadRoutes);

// Group Chat routes
router.use('/groups', groupRoutes);

// Search routes
router.use('/search', searchRoutes);

// Notifications routes
router.use('/notifications', notificationRoutes);

// AI Assistant routes
router.use('/ai', aiRoutes);

export default router;


