import { ICollectorService } from "../interfaces/collector/ICollectorServices";
import { ICollectorRepository } from "../interfaces/collector/ICollectorRepository";
import { IRedisRepository } from "../interfaces/redis/IRedisRepository";
import Collector, { ICollector } from "../models/Collector";
import bcrypt from "bcrypt";
import { MESSAGES } from "../constants/messages";
import { HTTP_STATUS } from "../constants/httpStatus";
import { generateAccessToken, generateRefreshToken, verifyToken, verifyGoogleToken } from "../utils/token";
import { TokenPayload } from "google-auth-library";
import OTP from "otp-generator";
import { sendOtp } from "../utils/mail";

export class CollectorService implements ICollectorService {
    constructor(
        private collectorRepository: ICollectorRepository,
        private redisRepository: IRedisRepository,
    ) { };

    async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; collector: ICollector; }> {
        try {
            const collector = await this.collectorRepository.getCollectorByEmail(email);

            if (!collector) {
                const error: any = new Error(MESSAGES.USER_NOT_FOUND);
                error.status = HTTP_STATUS.NOT_FOUND;
                throw error;
            }

            const isCorrectPassword = await bcrypt.compare(password, collector.password);

            if (!isCorrectPassword) {
                const error: any = new Error(MESSAGES.INVALID_PASSWORD);
                error.status = HTTP_STATUS.UNAUTHORIZED;
                throw error;
            }

            const accessToken = generateAccessToken(collector._id as string, 'collector');
            const refreshToken = generateRefreshToken(collector._id as string, 'collector');

            return { accessToken, refreshToken, collector };

        } catch (error) {
            console.error('Error while creating collector:', error);
            throw error;
        }
    };

    async signUp(collectorData: ICollector): Promise<void> {
        try {
            const { email } = collectorData;

            const existingCollector = await this.collectorRepository.getCollectorByEmail(email);

            if (existingCollector) {
                const error: any = new Error("Email already exists!");
                error.status = HTTP_STATUS.CONFLICT;
                throw error;
            }

            const otp = OTP.generate(4, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
            console.log("otp :", otp);
            await sendOtp(email, otp);
            await this.redisRepository.set(`collector-otp:${email}`, otp, 35);
            await this.redisRepository.set(`collector:${email}`, collectorData, 86400);
        } catch (error) {
            console.error('Error while storing otp and collectorata :', error);
            throw error;
        }
    };

    async verifyOtp(email: string, otp: string): Promise<{ accessToken: string; refreshToken: string; collector: ICollector }> {
        try {

            const prefix = "collector";
            const savedOtp = await this.redisRepository.get(`collector-otp:${email}`);
            console.log("Enterd otp:", otp);
            console.log("saved Otp :", savedOtp);

            if (savedOtp !== otp) {
                console.log("invalid otp")
                const error: any = new Error("Invalid OTP");
                error.status = HTTP_STATUS.UNAUTHORIZED;
                throw error;
            }

            const collectorData = await this.redisRepository.get(`collector:${email}`) as ICollector;

            console.log("OTP verified successfully for email:", collectorData);

            if (!collectorData) {
                throw new Error(MESSAGES.UNKNOWN_ERROR);
            }

            await this.redisRepository.delete(`collector:${email}`);

            const hashedPassword = await bcrypt.hash(collectorData.password, 10);
            collectorData.password = hashedPassword;
            // collectorData.serviceArea = 'not-provided';

            const collector = await this.collectorRepository.createCollector(collectorData);
            console.log("collectorrrrrrrrrr:", collector)

            const accessToken = generateAccessToken(collector._id as string, 'collector');
            const refreshToken = generateRefreshToken(collector._id as string, 'collector');

            return { accessToken, refreshToken, collector };

        } catch (error: any) {
            console.error("Error while verifying OTP and creating user:", error);
            throw error;
        }
    }

    async resendOtp(email: string): Promise<void> {
        try {
            // const prefix = "collector";
            const otp = OTP.generate(4, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
            console.log("otp :", otp);
            await sendOtp(email, otp);
            await this.redisRepository.set(`collector-otp:${email}`, otp, 35);

            // await this.redisRepository.get(`collector-otp:${email}`);
        } catch (error) {
            console.error('Error while resending otp:', error);
            throw error;
        }
    }

    async validateRefreshToken(token: string): Promise<{ accessToken: string; refreshToken: string; }> {
        try {

            const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET as string);

            const user = await this.collectorRepository.getCollectorById(decoded.userId);

            if (!user) {
                const error: any = new Error(MESSAGES.USER_NOT_FOUND);
                error.status = HTTP_STATUS.NOT_FOUND;
                throw error;
            }

            console.log("decoded in service:", decoded);

            const accessToken = generateAccessToken(user._id as string, 'collector');
            const refreshToken = generateRefreshToken(user._id as string, 'collector');

            return { accessToken, refreshToken };

        } catch (error) {
            console.error('Error while storing refreshToken :', error);
            throw error;
        }
    }

    async handleGoogleAuth(credential: string): Promise<{ accessToken: string; refreshToken: string; collector: ICollector; }> {
        try {

            const payload = await verifyGoogleToken(credential) as TokenPayload;

            if (!payload || !payload.email) {
                const error: any = new Error(MESSAGES.INVALID_INPUT);
                error.status = HTTP_STATUS.UNAUTHORIZED;
                throw error;
            }

            console.log("payload :", payload);

            let collector = await this.collectorRepository.getCollectorByEmail(payload.email);

            console.log("user :", collector);

            if (!collector) {
                collector = await this.collectorRepository.createCollector({
                    name: payload.name,
                    email: payload.email,
                    phone: 'N/A',
                    password: '',
                    profileUrl: payload.picture,
                    authProvider: "google",
                });
            }

            console.log("collector :", collector);

            const accessToken = generateAccessToken(collector._id as string, 'collector');
            const refreshToken = generateRefreshToken(collector._id as string, 'collector');

            return { accessToken, refreshToken, collector };

        } catch (error) {
            console.error('Error while storing refreshToken :', error);
            throw error;
        }
    }

    async getCollector(id: string): Promise<ICollector> {
        try {
            const projection = {
                _id: 0,
                password: 0,
                __v: 0
            }
            const collector = await this.collectorRepository.findById(id, projection);

            if (!collector) {
                const error: any = new Error(MESSAGES.USER_NOT_FOUND);
                error.status = HTTP_STATUS.NOT_FOUND;
                throw error;
            }

            return collector;

        } catch (error: any) {
            console.log("Error while fetching collectorData :", error.message);
            throw error;
        }
    }

    async getCollectors(collectorIds: string[]): Promise<ICollector[]> {
        try {
            const collectors = await this.collectorRepository.find({ _id: { $in: collectorIds } });
            console.log("collectors :", collectors);
            return collectors;
        } catch (error: any) {
            console.log("Error while fetching collectorData :", error.message);
            throw error;
        }
    }

    async updateCollector(id: string, collectorData: Partial<ICollector>): Promise<ICollector | null> {
        try {
            const collector = await this.collectorRepository.updateCollectorById(id, collectorData);

            if (!collector) {
                const error: any = new Error(MESSAGES.USER_NOT_FOUND);
                error.status = HTTP_STATUS.NOT_FOUND;
                throw error;
            }

            return collector;
        } catch (error: any) {
            console.log("Error while updating collector :", error.message);
            throw error;
        }
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        try {
            const collector = await this.collectorRepository.getCollectorById(userId);

            console.log("collector in service:", collector);

            if (!collector) {
                const error: any = new Error(MESSAGES.USER_NOT_FOUND);
                error.status = HTTP_STATUS.NOT_FOUND;
                throw error;
            }

            const isCorrectPassword = await bcrypt.compare(currentPassword, collector.password);

            if (!isCorrectPassword) {
                const error: any = new Error(MESSAGES.INVALID_PASSWORD);
                error.status = HTTP_STATUS.BAD_REQUEST;
                throw error;
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            collector.password = hashedPassword;

            await this.collectorRepository.updateCollectorById(userId, collector);
        } catch (error: any) {
            console.log("Error while changing collector password :", error.message);
            throw error;
        }
    }

    async getAvailableCollector(serviceAreaId: string, preferredDate: string): Promise<{ success: boolean; collector: Partial<ICollector>|null }> {
        try {
            const collectionDate = new Date(preferredDate);
            const dateKey = collectionDate.toISOString().split('T')[0];

            console.log("serviceAreaId :", serviceAreaId);
            console.log("dateKey :", dateKey);

        
            const filter = {
                serviceArea: serviceAreaId,
                isBlocked: false,
                // isVerified: true,
                verificationStatus: "approved",
                $or: [
                    { [`dailyTaskCounts.${dateKey}`]: { $lt: 5 } },
                    { [`dailyTaskCounts.${dateKey}`]: { $exists: false } }
                ]
            };

            const projection = {
                _id: 1,
                collectorId: 1, 
                name: 1,
                email: 1,
                phone: 1,
                dailyTaskCounts: 1
            }  

            const collectors = await this.collectorRepository.find(filter, projection);

            if (collectors.length === 0) {
                return {
                    success: true,
                    collector: null
                }
            }

            console.log("collectors:", collectors);

                const scoredCollectors = await Promise.all(collectors.map(async collector => ({
                    ...collector.toObject(),
                    score: await this.calculateCollectorScore(collector, dateKey)
                })));

                console.log("scoredCollectors :", scoredCollectors);
        
                scoredCollectors.sort((a: any, b: any) => b.score - a.score);
        
                return {
                    success: true,
                    collector: scoredCollectors[0]
                };
            
        } catch (error: any) {
            console.log("Error while fetching available collector :", error.message);
            throw error;
        }
    }

    async calculateCollectorScore(collector: ICollector, dateKey: string): Promise<number> {
        try {
            console.log("dateKey :", dateKey);
            console.log("collector in calculateCollectorScore :", collector);
            const dailyTasks = collector.dailyTaskCounts?.get?.(dateKey) || 0;
            console.log("dailyTasks :", dailyTasks);
            return 100 - dailyTasks;
        } catch (error: any) {
            console.log("Error while calculating collector score :", error.message);
            throw error;
        }
    }

    async assignCollectionToCollector(id: string, collectionId: string, preferredDate: string): Promise<void> {
        try {
            console.log("id :", id);
            console.log("collectionId :", collectionId);
            console.log("preferredDate :", preferredDate);
            await this.collectorRepository.updateById(id, { $push: { assignedTasks: collectionId } });

            const taskDateKey = new Date(preferredDate).toISOString().split('T')[0];
            await this.collectorRepository.updateById(id, { $inc: { [`dailyTaskCounts.${taskDateKey}`]: 1 } });

        } catch (error: any) {
            console.log("Error while assigning collection to collector :", error.message);
            throw error;
        }
    }

    async getAvailableCollectors(serviceAreaId: string): Promise<{ success: boolean; collectors: ICollector[] }> {
        try {
            const filter = {
                serviceArea: serviceAreaId,
                verificationStatus: "approved",
                availabilityStatus: "available",
                $expr: { $lt: ["$currentTasks", "$maxCapacity"] }
            }

            const projection = {
                _id: 1,
                collectorId: 1,
                name: 1,
                email: 1,
                phone: 1,
                availabilityStatus: 1,
                currentTasks: 1,
                maxCapacity: 1,
            }

            const collectors = await this.collectorRepository.find(filter, projection);

            return {
                success: true,
                collectors
            };
        } catch (error: any) {
            console.log("Error while fetching colloctors data :", error.message);
            throw error
        }
    }

    async deductTaskCount(collectorId: string): Promise<void> {
        try {
            await this.collectorRepository.updateById(
                collectorId,
                { $inc: { currentTasks: -1 } }
            );

        } catch (error: any) {
            console.error("Error while updating payment details :", error.message);
            throw error;
        }
    }
};