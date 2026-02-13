import type { ReactNode } from 'react';
import '../../App.css';

interface MainLayoutProps {
    children: ReactNode;
    sidebar: ReactNode;
}

export const MainLayout = ({ children, sidebar }: MainLayoutProps) => {
    return (
        <div className="app-container">
            {sidebar}
            <main className="main-content">
                <div className="scrollable-content">
                    {children}
                </div>
            </main>
        </div>
    );
};
