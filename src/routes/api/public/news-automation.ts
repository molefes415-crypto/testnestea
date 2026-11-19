import { createFileRoute } from '@tanstack/react-router';
import { handleNewsAutomation } from '@/lib/news-automation-http';

export const Route = createFileRoute('/api/public/news-automation')({
  server: { handlers: {
    POST: ({ request }) => handleNewsAutomation(request, () => import('@/lib/news-automation.server')),
  } },
});