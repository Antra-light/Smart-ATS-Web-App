import './globals.css';

export const metadata = {
    title: 'Smart ATS',
    description: 'AI-powered resume optimization and ATS evaluation platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
