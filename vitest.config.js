import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.test for test environment
dotenv.config({ path: '.env.test' });

export default defineConfig({
    test: {
        // Environment
        environment: 'node',

        // Coverage
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: [
                'lib/**/*.js',
                'routes/**/*.js',
                'middleware/**/*.js',
                'src/**/*.js'
            ],
            exclude: [
                'node_modules/',
                'test/',
                '**/*.test.js',
                '**/*.spec.js'
            ],
            statements: 70,
            branches: 60,
            functions: 70,
            lines: 70
        },

        // Global setup/teardown
        setupFiles: [],

        // Globals (no need to import describe/it/test)
        globals: true,

        // Include patterns
        include: [
            'test/**/*.{test,spec}.js',
            'tests/**/*.{test,spec}.js'
        ],

        // Exclude patterns
        exclude: [
            'node_modules',
            'dist',
            '.idea',
            '.git',
            '.cache'
        ],

        // Test reporters
        reporters: ['verbose'],

        // Timeout
        testTimeout: 10000,

        // Hook timeout
        hookTimeout: 10000,

        // Threads
        threads: true,
        maxThreads: 4,
        minThreads: 1,
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            '@lib': path.resolve(__dirname, './lib'),
            '@routes': path.resolve(__dirname, './routes'),
            '@middleware': path.resolve(__dirname, './middleware'),
            '@src': path.resolve(__dirname, './src'),
        }
    }
});
