import { Request, Response } from "express";

export interface IAdminController {
    login(req: Request, res: Response): Promise<void>;
    createAdmin(req: Request, res: Response): Promise<any>;
    getUsers(req: Request, res: Response): Promise<void>;
    getCollectors(req: Request, res: Response): Promise<void>;
    updateUserStatus(req: Request, res: Response): Promise<void>;
    updateCollectorStatus(req: Request, res: Response): Promise<void>;
}