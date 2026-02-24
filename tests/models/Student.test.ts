// npm test -- tests/models/Student.test.ts
import mongoose from 'mongoose';
import Student from '../../src/models/Student';
import User from '../../src/models/User';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test.local' });

describe('Student Model Test', () => {
    beforeAll(async () => {
        const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erica-capstone-test';
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        await mongoose.connect(mongoURI);
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.dropDatabase();
            await mongoose.connection.close();
        }
    });

    afterEach(async () => {
        await Student.deleteMany({});
        await User.deleteMany({});
    });

    it('create & save student successfully', async () => {
        const user = new User({
            email: 'student@test.com',
            password: 'password',
            name: 'Test Student',
            role: 'student'
        });
        const savedUser = await user.save();

        const studentData = {
            userId: savedUser._id,
            name: 'Test Student',
            major: '컴퓨터공학부',
            secondMajorType: '선택',
            academicStatus: '재학생',
            completedSemesters: 6
        };

        // @ts-ignore
        const validStudent = new Student(studentData);
        const savedStudent = await validStudent.save();

        expect(savedStudent._id).toBeDefined();
        expect(savedStudent.userId.toString()).toBe(savedUser._id.toString());
        expect(savedStudent.major).toBe('컴퓨터공학부');
        expect(savedStudent.secondMajorType).toBe('선택');
        expect(savedStudent.secondMajor).toBeUndefined();
        expect(savedStudent.academicStatus).toBe('재학생');
        expect(savedStudent.completedSemesters).toBe(6);
    });

    it('create student with second major successfully', async () => {
        const user = new User({
            email: 'student2@test.com',
            password: 'password',
            name: 'Test Student 2',
            role: 'student'
        });
        const savedUser = await user.save();

        const studentData = {
            userId: savedUser._id,
            name: 'Test Student 2',
            major: '기계공학부',
            secondMajorType: '다중전공',
            secondMajor: '인공지능학과',
            academicStatus: '재학생',
            completedSemesters: 4
        };

        // @ts-ignore
        const validStudent = new Student(studentData);
        const savedStudent = await validStudent.save();

        expect(savedStudent.secondMajorType).toBe('다중전공');
        expect(savedStudent.secondMajor).toBe('인공지능학과');
    });

    it('create student with invalid completedSemesters should fail', async () => {
        const user = new User({
            email: 'student3@test.com',
            password: 'password',
            name: 'Test',
            role: 'student'
        });
        const savedUser = await user.save();

        const studentData = {
            userId: savedUser._id,
            name: 'Test',
            major: '물리학과',
            secondMajorType: '선택',
            academicStatus: '재학생',
            completedSemesters: 13, // 1~12 범위를 초과
        };

        // @ts-ignore
        const invalidStudent = new Student(studentData);
        let err;
        try {
            await invalidStudent.save();
        } catch (error) {
            err = error;
        }

        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        // @ts-ignore
        expect(err.errors.completedSemesters).toBeDefined();
    });

    it('create student with invalid secondMajorType should fail', async () => {
        const user = new User({
            email: 'student4@test.com',
            password: 'password',
            name: 'Test',
            role: 'student'
        });
        const savedUser = await user.save();

        const studentData = {
            userId: savedUser._id,
            name: 'Test',
            major: '화학과',
            secondMajorType: '잘못된유형', // 유효하지 않은 타입
            academicStatus: '재학생',
            completedSemesters: 2,
        };

        // @ts-ignore
        const invalidStudent = new Student(studentData);
        let err;
        try {
            await invalidStudent.save();
        } catch (error) {
            err = error;
        }

        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        // @ts-ignore
        expect(err.errors.secondMajorType).toBeDefined();
    });
});
