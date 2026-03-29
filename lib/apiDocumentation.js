// [API DOCUMENTATION — OpenAPI/Swagger Schema Generation]
// Self-documenting APIs enable 100K user ecosystems (partners, integrations)

export const API_SCHEMA = {
    openapi: '3.0.0',
    info: {
        title: 'Lyra AI Therapist API',
        version: '1.0.0',
        description: 'Production-grade therapeutic AI backend for 100K+ concurrent users',
        contact: {
            name: 'Lyra Support',
            email: 'support@lyra.ai',
        },
    },
    servers: [
        {
            url: '/v1',
            description: 'API v1 endpoints',
        },
    ],
    paths: {
        // ─── AUTHENTICATION ──────────────────────────────────────────────────
        '/auth/signup': {
            post: {
                tags: ['Authentication'],
                summary: 'User registration',
                description: 'Create a new user account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                                    password: { type: 'string', minLength: 6, example: 'SecurePassword123!' },
                                },
                                required: ['email', 'password'],
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'User registered successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        accessToken: { type: 'string' },
                                        refreshToken: { type: 'string' },
                                        userId: { type: 'string', format: 'uuid' },
                                    },
                                },
                            },
                        },
                    },
                    '400': { description: 'Invalid input or user exists' },
                    '429': { description: 'Rate limit exceeded' },
                },
            },
        },

        '/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'User login',
                description: 'Authenticate and receive JWT tokens',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string' },
                                },
                                required: ['email', 'password'],
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Login successful' },
                    '401': { description: 'Invalid credentials' },
                },
            },
        },

        '/auth/refresh': {
            post: {
                tags: ['Authentication'],
                summary: 'Refresh access token',
                description: 'Get new access token using refresh token',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': { description: 'Token refreshed' },
                    '401': { description: 'Refresh token invalid/expired' },
                },
            },
        },

        '/auth/logout': {
            post: {
                tags: ['Authentication'],
                summary: 'User logout',
                description: 'Revoke tokens and end session',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': { description: 'Logged out successfully' },
                },
            },
        },

        // ─── CHAT (THERAPY) ──────────────────────────────────────────────────
        '/api/chat/completions': {
            post: {
                tags: ['Therapy'],
                summary: 'Chat with AI therapist',
                description: 'Send message and receive therapeutic response',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    messages: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                role: { type: 'string', enum: ['user', 'assistant'] },
                                                content: { type: 'string', maxLength: 4000 },
                                            },
                                        },
                                    },
                                    temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
                                },
                                required: ['messages'],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Therapist response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        assessments: { type: 'object' },
                                        sessionId: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '401': { description: 'Unauthorized' },
                    '429': { description: 'Rate limit exceeded' },
                },
            },
        },

        // ─── HEALTH CHECK ────────────────────────────────────────────────────
        '/health': {
            get: {
                tags: ['System'],
                summary: 'Health check',
                description: 'System status, database, memory, uptime',
                responses: {
                    '200': {
                        description: 'System healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                                        checks: { type: 'object' },
                                        timestamp: { type: 'string', format: 'date-time' },
                                    },
                                },
                            },
                        },
                    },
                    '503': { description: 'System unhealthy' },
                },
            },
        },
    },

    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT access token (15-minute expiry)',
            },
        },

        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    code: { type: 'string' },
                    details: { type: 'object' },
                },
            },

            User: {
                type: 'object',
                properties: {
                    userId: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    createdAt: { type: 'string', format: 'date-time' },
                    sessionCount: { type: 'integer', minimum: 0 },
                },
            },

            Message: {
                type: 'object',
                properties: {
                    role: { type: 'string', enum: ['user', 'assistant'] },
                    content: { type: 'string', maxLength: 4000 },
                    timestamp: { type: 'string', format: 'date-time' },
                },
            },
        },
    },

    tags: [
        { name: 'Authentication', description: 'User authentication & token management' },
        { name: 'Therapy', description: 'Therapeutic conversation endpoints' },
        { name: 'System', description: 'System health & monitoring' },
    ],
};

/**
 * Endpoint metadata for rate limiting & monitoring
 */
export const ENDPOINT_METADATA = {
    'POST /v1/auth/signup': {
        rateLimit: '5/15min',
        authentication: 'none',
        cost: 'high',
        description: 'User registration',
    },
    'POST /v1/auth/login': {
        rateLimit: '5/15min',
        authentication: 'none',
        cost: 'high',
        description: 'User login',
    },
    'POST /v1/auth/refresh': {
        rateLimit: 'unlimited',
        authentication: 'optional',
        cost: 'low',
        description: 'Token refresh',
    },
    'POST /v1/auth/logout': {
        rateLimit: 'unlimited',
        authentication: 'required',
        cost: 'low',
        description: 'User logout',
    },
    'POST /v1/api/chat/completions': {
        rateLimit: '10/5min',
        authentication: 'required',
        cost: 'very_high',
        description: 'Chat with therapist (calls OpenAI API)',
    },
    'GET /health': {
        rateLimit: '100/1min',
        authentication: 'none',
        cost: 'low',
        description: 'System health check',
    },
};

/**
 * Generate API documentation endpoint
 * Usage: GET /api/docs.json → returns OpenAPI schema
 */
export function apiDocsEndpoint(_req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.json(API_SCHEMA);
}

/**
 * Generate Swagger UI HTML
 * Usage: GET /api/docs → returns interactive Swagger UI
 */
export function swaggerUIEndpoint(_req, res) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Lyra API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/docs.json',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis],
            layout: "BaseLayout"
        })
    </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
}

/**
 * Get endpoint statistics for monitoring
 */
export function getEndpointStats() {
    return {
        totalEndpoints: Object.keys(ENDPOINT_METADATA).length,
        byAuthentication: {
            required: Object.values(ENDPOINT_METADATA).filter(e => e.authentication === 'required').length,
            optional: Object.values(ENDPOINT_METADATA).filter(e => e.authentication === 'optional').length,
            none: Object.values(ENDPOINT_METADATA).filter(e => e.authentication === 'none').length,
        },
        byCost: {
            high: Object.values(ENDPOINT_METADATA).filter(e => e.cost === 'high').length,
            very_high: Object.values(ENDPOINT_METADATA).filter(e => e.cost === 'very_high').length,
            low: Object.values(ENDPOINT_METADATA).filter(e => e.cost === 'low').length,
        },
    };
}
