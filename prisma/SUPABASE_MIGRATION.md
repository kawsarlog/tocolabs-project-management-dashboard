# SQLite → Supabase Postgres Migration (Prisma)

এই প্রজেক্টটা এখন লোকালি `SQLite` ব্যবহার করছে। পরবর্তীতে `Supabase Postgres`-এ নিতে হলে সাধারণত এই স্টেপগুলো লাগে।

## 1) Supabase Database বানান
- Supabase-এর Dashboard থেকে একটি Postgres project/database নিন।
- তারপর connection string নিন (Settings → Database → Connection string)।

## 2) `prisma/schema.prisma` আপডেট করুন
`datasource db` অংশে provider `sqlite` থেকে `postgresql` করুন।

উদাহরণ:
```prisma
datasource db {
  provider = "postgresql"
}
```

## 3) `.env` সেট করুন
`DATABASE_URL`-এ Supabase-এর connection string দিন।

## 4) Migrations চালান
- Development/prototype হলে: `npx prisma migrate dev`
- Deploy/production হলে: `npx prisma migrate deploy`

## Notes
- Models গুলো multi-tenant হিসেবে `Business`-ভিত্তিক। তাই row-level isolation app-layer-এ করা হচ্ছে।
- Supabase-এ চাইলে future phase-এ আপনি Postgres + RLS যোগ করে আরও শক্ত isolation করতে পারবেন।

