import { useEffect } from 'react';

const DESKTOP_MEDIA_QUERY = '(min-width: 1280px)';

export const useDashboardMainScrollLock = (enabled: boolean) => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const main = document.querySelector<HTMLElement>('main[data-dashboard-section-scroll-root]');
        if (!main) return undefined;

        const previousOverflowY = main.style.overflowY;
        const previousOverscrollBehavior = main.style.overscrollBehavior;
        const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

        const applyState = () => {
            if (enabled && mediaQuery.matches) {
                main.style.overflowY = 'hidden';
                main.style.overscrollBehavior = 'contain';
                return;
            }

            main.style.overflowY = previousOverflowY;
            main.style.overscrollBehavior = previousOverscrollBehavior;
        };

        applyState();

        const handleChange = () => applyState();
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            main.style.overflowY = previousOverflowY;
            main.style.overscrollBehavior = previousOverscrollBehavior;
        };
    }, [enabled]);
};

export default useDashboardMainScrollLock;
