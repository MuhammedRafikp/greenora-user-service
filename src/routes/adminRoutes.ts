import { Router } from 'express';

import { AdminController } from '../controllers/adminController';
import { AdminService } from '../services/adminService'
import adminRepository from '../repositories/adminRepository';
import userRepository from '../repositories/userRepository';
import collectorRepository from '../repositories/collectorRepository';
import { validateAdmin } from "../middlewares/auth";

const adminService = new AdminService(adminRepository, userRepository, collectorRepository);
const adminController = new AdminController(adminService);

const router = Router();

router.post('/login', adminController.login.bind(adminController));
router.post('/signup', adminController.createAdmin.bind(adminController));
router.post('/refresh-token', adminController.validateRefreshToken.bind(adminController));

router.get('/users', validateAdmin, adminController.getUsers.bind(adminController));
router.get('/collectors', validateAdmin, adminController.getCollectors.bind(adminController));
router.patch('/update-user-status/:id', validateAdmin, adminController.updateUserStatus.bind(adminController));
router.patch('/update-collector-status/:id', validateAdmin, adminController.updateCollectorStatus.bind(adminController));

export default router;