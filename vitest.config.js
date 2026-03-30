import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.js'],
        exclude: ['node_modules/**'],

        // Coverage
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/**',
                'test/**',
                '**/*.test.js',
                'frontend/**'
            ],
            lines: 80,
            functions: 80,
            branches: 75,
            statements: 80
        },

        testTimeout: 10000,
        reporters: ['default', 'html'],
        outputFile: {
            html: './test-results.html'
        },
        setupFiles: ['./test/setup.js']
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@test': path.resolve(__dirname, 'test')
        }
    }
});
