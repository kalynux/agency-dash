# Delivery Agency Dashboard

A production-ready, delivery agency dashboard built with React, TypeScript, and Tailwind CSS. Inspired by Shopify's admin interface, this dashboard provides a comprehensive solution for managing products, orders, agencies, and analytics.

![Dashboard Preview](https://placehold.co/1200x600/6366f1/ffffff?text=Dashboard+Preview)

## Features

### Authentication
- Clean, centered login screen with role-based access
- Demo credentials for testing different user roles
- Session persistence with localStorage

### Dashboard Overview
- Real-time analytics with interactive charts
- Key metrics cards with trend indicators
- Sales performance visualization
- Category breakdown charts
- Quick action buttons
- Low stock alerts

### Orders Management
- Advanced data table with sorting and filtering
- Bulk selection and actions
- Order status management
- Detailed order view with timeline
- Customer and payment information
- Export functionality

### Products Management
- Grid and list view toggle
- Product cards with inventory badges
- Bulk editing capabilities
- Product creation wizard
- Image management
- Variant support
- Low stock notifications

### Agency Management (Admin Only)
- Agency directory with performance metrics
- Approval workflow for new agencies
- Commission configuration
- Risk assessment indicators
- Payout tracking
- Document verification

### Analytics & Reports
- Custom date range selection
- Sales performance charts
- Category breakdown
- Customer analytics
- Payment method statistics
- Export capabilities

### Notifications
- Real-time notification center
- Unread badges
- Notification preferences
- Mark as read functionality

### Settings
- Profile management
- Store configuration
- Regional settings (currency, timezone, language)
- Theme selection (light/dark/system)
- Notification preferences
- Security settings (password, 2FA)
- Billing and subscription management

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (40+ components)
- **State Management**: Zustand with persistence
- **Routing**: React Router v6
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components (Sidebar, Header, AuthLayout, DashboardLayout)
│   ├── ui/              # shadcn/ui components
│   └── features/        # Feature-specific components (LoginForm, OrderDetails, ProductForm, etc.)
├── pages/               # Page components (Overview, Orders, Products, etc.)
├── store/               # Zustand stores (auth, ui, products, orders, vendors, etc.)
├── data/                # Mock data for development
├── types/               # TypeScript type definitions
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
└── App.tsx              # Main application component
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ecommerce-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@marketplace.com | password |
| Agency | agency@example.com | password |
| Staff | staff@example.com | password |

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## API Integration

The dashboard is designed to easily integrate with a backend API. Key integration points:

### Authentication
- Update `useAuthStore` in `src/store/index.ts` to call your auth API
- The store already handles JWT persistence

### Data Fetching
- Each store has a `fetch*` method that currently uses mock data
- Replace these with actual API calls using your preferred HTTP client (axios, fetch, etc.)

### Example API Integration

```typescript
// src/services/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-storage');
  if (token) {
    config.headers.Authorization = `Bearer ${JSON.parse(token).state.user.token}`;
  }
  return config;
});
```

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=https://your-api-url.com
VITE_APP_NAME=WiMall
```

## Customization

### Theming

The dashboard uses CSS variables for theming. Update `src/index.css`:

```css
:root {
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  /* ... other variables */
}
```

### Adding New Pages

1. Create a new page component in `src/pages/`
2. Add the route in `src/App.tsx`
3. Add navigation item in `src/components/layout/Sidebar.tsx`

### Adding New Stores

1. Create a new store in `src/store/`
2. Export it from `src/store/index.ts`
3. Use it in your components with `useYourStore()`

## Performance Optimizations

- Component-level code splitting with React.lazy
- Virtualized lists for large tables (TanStack Table)
- Image optimization with lazy loading
- Debounced search inputs
- Memoized computations with useMemo

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA labels and roles

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, email support@wimall.com or join our Slack channel.

---

Built with ❤️ by the WiMall Team
