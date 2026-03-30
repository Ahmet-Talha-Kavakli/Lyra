# Lyra Frontend

Modern React + TypeScript frontend for Lyra AI Therapy Assistant.

## Stack

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool (fast, modern)
- **Tailwind CSS** — Styling
- **Zustand** — State management
- **Lucide React** — Icons
- **WebSocket** — Real-time communication

## Features

- ✅ User authentication (login/signup)
- ✅ Real-time chat with therapy AI
- ✅ Audio & video capture support
- ✅ Action unit analysis visualization
- ✅ Session management
- ✅ Responsive design for 100K+ concurrent users
- ✅ Security: httpOnly cookies, CSRF protection ready

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your backend URLs
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   └── chat/         # Chat-related components
│   ├── pages/            # Page-level components
│   │   ├── auth/         # Authentication pages
│   │   └── chat/         # Chat interface
│   ├── store/            # Zustand state management
│   │   ├── authStore.ts
│   │   └── sessionStore.ts
│   ├── services/         # API & WebSocket services (from existing code)
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html            # HTML entry point
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## API Integration

Frontend connects to backend at `${VITE_API_URL}` (default: `http://localhost:3000/api`)

### Key Endpoints Used

- `POST /api/auth/signup` — Register new user
- `POST /api/auth/login` — User login
- `GET /api/auth/verify` — Verify token
- `WebSocket /ws` — Real-time therapy chat

## Performance Notes

- Code splitting with Vite (vendor + UI bundles)
- Lazy loading for routes (future optimization)
- Efficient re-renders with Zustand
- Image optimization ready

## Security

- ✅ HTTPS/WSS support
- ✅ httpOnly cookie handling
- ✅ CSRF token support (backend validates)
- ✅ Content Security Policy headers
- ✅ No sensitive data in localStorage (tokens only)

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

## Deployment

See root `/DEPLOYMENT.md` for full deployment guide.

For Vercel:

```bash
npm install
npm run build
```

Output in `dist/` directory.
