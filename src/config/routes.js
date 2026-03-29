/**
 * Central Route Configuration
 * Domain-Driven Design: All routes organized by module
 *
 * This file maps Express route prefixes to module route handlers
 * Making it easy to find, test, and maintain specific domains
 */

// ─── MODULE ROUTES ─────────────────────────────────────────────
// Import all domain routes
import authRoutes from '../modules/auth/routes/index.js';
import therapyRoutes from '../modules/therapy/routes/index.js';
import chatRoutes from '../modules/chat/routes/index.js';
import analysisRoutes from '../modules/analysis/routes/index.js';
import sessionRoutes from '../modules/session/routes/index.js';
import knowledgeRoutes from '../modules/knowledge/routes/index.js';
import psychologyRoutes from '../modules/psychology/routes/index.js';

// Legacy routes (refactoring in progress)
import legacyAuthRouter from '../../routes/auth.js';
import legacyUserRouter from '../../routes/user.js';
import legacySessionRouter from '../../routes/session.js';
import legacyKnowledgeRouter from '../../routes/knowledge.js';
import legacyAnalysisRouter from '../../routes/analysis.js';
import legacyCharacterRouter from '../../routes/character.js';
import legacyAdminRouter from '../../routes/admin.js';

/**
 * Register all routes with Express app
 * Routes are organized by domain for clarity
 */
export function registerRoutes(app) {
    // ─── NEW DDD ROUTES (Preferred) ────────────────────────────
    // These are the modern, organized routes
    // app.use('/auth', authRoutes);
    // app.use('/therapy', therapyRoutes);
    // app.use('/v1/api/chat', chatRoutes);

    // ─── LEGACY ROUTES (During Refactoring) ────────────────────
    // Using old routes until DDD refactoring complete
    app.use('/auth', legacyAuthRouter);
    app.use('/', legacyUserRouter);
    app.use('/', legacySessionRouter);
    app.use('/', legacyKnowledgeRouter);
    app.use('/', legacyAnalysisRouter);
    app.use('/', legacyCharacterRouter);
    app.use('/', legacyAdminRouter);

    return app;
}

/**
 * Export route modules for testing
 */
export {
    authRoutes,
    therapyRoutes,
    chatRoutes,
    analysisRoutes,
    sessionRoutes,
    knowledgeRoutes,
    psychologyRoutes,
};
