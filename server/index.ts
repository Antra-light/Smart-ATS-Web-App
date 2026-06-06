import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'smartats-secret';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});

const upload = multer({ storage });

function createToken(userId: number) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15d' });
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
        (req as any).userId = payload.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

async function extractResumeText(filePath: string, mimeType: string) {
    const buffer = fs.readFileSync(filePath);
    if (mimeType.includes('pdf')) {
        const data = await pdfParse(buffer);
        return data.text || '';
    }
    const worker = await Tesseract.createWorker();
    await worker.load();
    await worker.reinitialize('eng');
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    return text || '';
}

async function callGemini(prompt: string) {
    if (!GOOGLE_API_KEY) {
        throw new Error('Missing GOOGLE_API_KEY in environment.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta2/models/gemini-1.5-preview:generate?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: { text: prompt } })
    });
    const json = await response.json();
    const text = json?.candidates?.[0]?.content || json?.candidates?.[0]?.output || json?.outputText || '';
    return typeof text === 'string' ? text : JSON.stringify(text);
}

function buildPrompt(resumeText: string, jd: string) {
    return `You are a senior ATS evaluator and AI resume coach. Given a resume and a job description, return ONLY JSON with keys: JD Match, MissingKeywords, Profile Summary, InterviewQuestions, ImprovementSuggestions. Use no markdown and no extra text.\n\nResume text:\n${resumeText}\n\nJob Description:\n${jd}`;
}

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ error: 'Email already registered.' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, password: hashed } });
    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    res.json({ user });
});

app.post('/api/resumes', authMiddleware, upload.single('resume'), async (req, res) => {
    try {
        const userId = (req as any).userId;
        const file = req.file;
        const { jd, title } = req.body;
        if (!file || !jd) {
            return res.status(400).json({ error: 'Job description and resume file are required.' });
        }
        const uploadType = file.mimetype.includes('pdf') ? 'pdf' : 'image';
        const extractedText = await extractResumeText(file.path, file.mimetype);
        const prompt = buildPrompt(extractedText, jd);
        const rawResponse = await callGemini(prompt);
        const urlSafe = rawResponse.trim();
        let responseJson = {};
        try {
            responseJson = JSON.parse(urlSafe);
        } catch {
            responseJson = { raw: urlSafe };
        }
        const resume = await prisma.resume.create({
            data: {
                title: title || file.originalname,
                filename: file.filename,
                uploadType,
                text: extractedText,
                userId,
                evaluations: {
                    create: {
                        score: responseJson['JD Match'] || 'N/A',
                        feedback: JSON.stringify(responseJson)
                    }
                }
            },
            include: { evaluations: true }
        });
        return res.json({ resume });
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Resume evaluation failed.' });
    }
});

app.get('/api/resumes', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const resumes = await prisma.resume.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { evaluations: true }
    });
    res.json({ resumes });
});

app.delete('/api/resumes/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const resumeId = Number(req.params.id);
    const existing = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: 'Resume not found.' });
    }
    await prisma.evaluation.deleteMany({ where: { resumeId } });
    await prisma.resume.delete({ where: { id: resumeId } });
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
