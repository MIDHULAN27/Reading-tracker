import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Custom Hook for Dynamic SEO & document title syncing in SPA routing.
 * Ensures Lighthouse audits pass with descriptive, semantic meta tags.
 */
export default function useSEOSync() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'Booklyn — Modern Virtual Library & Reading Tracker';
    let description = 'Organize your books, log reading hours, and track progress in a beautiful, premium reading sanctuary.';

    if (path.startsWith('/book/')) {
      title = 'Book Details | Booklyn';
      description = 'Read reviews, log progress, and configure custom page limits for your book choices.';
    } else if (path.startsWith('/paper/')) {
      title = 'Research Paper | Booklyn';
      description = 'Examine citations, study parameters, and navigate open-access document resources on Booklyn.';
    } else {
      switch (path) {
        case '/':
          title = 'Dashboard | Booklyn';
          description = 'View your reading streak milestones, check daily reading progress rings, log reading hours, and browse personalized recommendations.';
          break;
        case '/library':
          title = 'My Library | Booklyn';
          description = 'Manage your personal reading collection across multiple shelves: Want to Read, Currently Reading, Completed, and Favorites.';
          break;
        case '/discover':
          title = 'Discover Books | Booklyn';
          description = 'Search millions of books globally, explore trending titles daily, and quick-add new finds to your library shelves.';
          break;
        case '/saved-shelf':
          title = 'Saved Shelf & Bookmarks | Booklyn';
          description = 'View and manage your bookmarked research papers, academic studies, and saved bookshelf collection.';
          break;
        case '/reading-profile':
          title = 'Reading Profile & Achievements | Booklyn';
          description = 'Check your unlockable gamified milestones, view overall stats, and configure offline data synchronization logs.';
          break;
        case '/goals':
          title = 'Reading Goals | Booklyn';
          description = 'Set your daily reading target, challenge yourself with reading streaks, and unlock achievements.';
          break;
        case '/analytics':
          title = 'Reading Analytics | Booklyn';
          description = 'Deep dive into your reading metrics, monthly completion heatmaps, pages read totals, and interactive statistics charts.';
          break;
        case '/settings':
          title = 'Account Settings | Booklyn';
          description = 'Configure your customizable daily reading goals, adjust profile preferences, and toggle dark or light mode.';
          break;
        case '/auth':
          title = 'Sign In | Booklyn';
          description = 'Securely authenticate, access persistent reading profiles, and synchronize your library shelves across all devices.';
          break;
        default:
          break;
      }
    }

    // Sync title
    document.title = title;

    // Sync meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    }
  }, [location]);
}

