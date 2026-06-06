module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            colors: {
                glass: 'rgba(255,255,255,0.12)',
                primary: '#8b5cf6',
                accent: '#7c3aed'
            },
            boxShadow: {
                glass: '0 20px 80px rgba(15, 23, 42, 0.18)'
            }
        }
    },
    plugins: []
};
