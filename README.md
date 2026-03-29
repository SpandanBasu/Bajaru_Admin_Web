# Bajaru Admin Panel

A clean, standalone React admin dashboard for managing inventory and procurement.

## Stack

- **React 19** + **TypeScript**
- **Vite 7** (bundler & dev server)
- **Tailwind CSS v4**
- **Radix UI** (accessible components)
- **Framer Motion** (animations)
- **Recharts** (charts)
- **TanStack React Query**
- **Wouter** (routing)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm

### Install & Run

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
bajaru-admin/
├── public/            # Static assets (logo, favicon)
├── src/
│   ├── components/
│   │   ├── layout/    # App shell: sidebar, header, layout
│   │   └── ui/        # 50+ Radix UI components (shadcn/ui style)
│   ├── hooks/         # useIsMobile, useToast
│   ├── lib/
│   │   ├── store.tsx  # Global state (products, procurement, user profile)
│   │   └── utils.ts   # cn() helper
│   └── pages/
│       ├── dashboard.tsx
│       ├── products.tsx
│       ├── procurement.tsx
│       └── not-found.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Environment Variables

No environment variables are required. See `.env.example` for notes on connecting your own backend later.

## Connecting Your Own Backend

All data lives in `src/lib/store.tsx` as in-memory state with mock data.
To wire up your own API:

1. Replace the `initialProducts` and `initialProcurement` arrays with API calls.
2. Use the existing React Query setup in `src/App.tsx` to manage server state.
3. Add `VITE_API_BASE_URL=https://your-api.com` to a `.env` file and reference it as `import.meta.env.VITE_API_BASE_URL`.
