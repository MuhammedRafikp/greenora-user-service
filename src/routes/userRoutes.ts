import { Router } from "express";
import { UserController } from "../controllers/userController";
import { UserService } from "../services/userService";
import userRepository from "../repositories/userRepository";
import redisRepository from "../repositories/redisRepository";
import passport from 'passport';
import multer from 'multer';
const upload = multer();

const userService = new UserService(userRepository, redisRepository);
const userController = new UserController(userService);

const router = Router();

router.post('/login', userController.login.bind(userController));
router.post('/signup', userController.signUp.bind(userController));
router.post('/verify-otp', userController.verifyOtp.bind(userController));
router.post('/resend-otp', userController.resendOtp.bind(userController));

router.get('/google', userController.googleAuth.bind(userController));
router.get('/google/callback', userController.googleAuthCallback.bind(userController));
router.get('/google/success', userController.googleAuthSuccess.bind(userController));
router.get('/google/failure', userController.googleAuthFailure.bind(userController));

router.get('/profile', userController.getUser.bind(userController));
router.put('/update-profile', upload.single('profileImage'), userController.updateUser.bind(userController));

export default router;