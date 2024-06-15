/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                gloock: ['"Gloock"', 'display'],
                roboto: ['"Roboto"', 'display'],
                creepster: ["Creepster", 'display'],
                'gentium-book': ['"Gentium Book Plus"', 'body'],
                'germania-one': ['"Germania One"', 'display'],
            },
        },
    },
    plugins: [],
};
