# ATS Resume Project

Modern AI resume evaluation platform built with Next.js / Tailwind CSS frontend and Express / Prisma backend.

## Setup

1. Install Python dependencies (if using legacy Flask backend):
   ```bash
   python -m pip install -r requirements.txt
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Create or update `.env` with your keys:
   ```env
   GOOGLE_API_KEY="..."
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="replace-with-a-strong-secret"
   NEXT_PUBLIC_SERVER_URL="http://localhost:4000"
   ```

4. Initialize Prisma and database:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. Start backend server:
   ```bash
   npm run dev:server
   ```

6. Start Next.js frontend:
   ```bash
   npm run dev
   ```

## Notes

- Uploads are stored in `uploads/`.
- The backend uses SQLite by default with `dev.db`.
- Replace `JWT_SECRET` with a secure value before production.
