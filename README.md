# Jewellery Khazana Order Manager

Internal order action report system for Shopify orders.

## Features

- Employee and admin login
- Employee order capture with order date, order number, product image hyperlink, status, reason, and AWB number
- Employees cannot edit saved order details; they can only update the status/reason/AWB later
- Admin dashboard with date filter and status totals
- Admin user management for employees
- Excel export enabled after 9 PM for the selected date
- MongoDB Atlas storage and Vercel-ready Next.js app

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill the values.

3. Create the first admin:

   ```bash
   npm run seed
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

## Vercel deployment

Add these environment variables in Vercel Project Settings:

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

After deployment, run the seed script locally against the same MongoDB URI once, or create an admin user directly in the database.
