import { promises } from 'dns';
import { Request, Response, NextFunction } from 'express';

export interface IUserController {
    login(req: Request, res: Response): Promise<void>;
    signUp(req: Request, res: Response): Promise<void>;
    verifyOtp(req: Request, res: Response): Promise<void>;
    resendOtp(req: Request, res: Response): Promise<void>;

    googleAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
    googleAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void>;
    googleAuthSuccess(req: Request, res: Response, next: NextFunction): void;
    googleAuthFailure(req: Request, res: Response): void;

    getUser(req: Request, res: Response): Promise<void>;
    updateUser(req: Request, res: Response): Promise<void>;
    uploadProfileImage(req: Request, res: Response): Promise<void>;
    validateRefreshToken(req: Request, res: Response): Promise<void>;
}