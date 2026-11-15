/** Re-renders public pages after content changes (implemented by the prerenderer). */
export interface Publisher {
    /** Re-render these site paths (e.g. '/exhibitions/foo'); paths that no longer resolve are removed. */
    render(paths: string[]): Promise<void>;
    /** Re-render every page and the sitemap. */
    rebuildAll(): Promise<{ pages: number }>;
}

export const noopPublisher: Publisher = {
    render: async () => {},
    rebuildAll: async () => ({ pages: 0 }),
};
