/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import { fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SystemController } from './../controllers/SystemController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SettingsController } from './../controllers/SettingsController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { MockController } from './../controllers/MockController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ChatController } from './../controllers/ChatController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './../controllers/AuthController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { IngestController } from './../controllers/rag/IngestController';
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';
const multer = require('multer');




// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "ChatTaskResponse": {
        "dataType": "refObject",
        "properties": {
            "taskId": { "dataType": "string", "required": true },
            "message": { "dataType": "string", "required": true },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ChatRequest": {
        "dataType": "refObject",
        "properties": {
            "query": { "dataType": "string", "required": true },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ChatStatusResponse": {
        "dataType": "refObject",
        "properties": {
            "status": { "dataType": "union", "subSchemas": [{ "dataType": "enum", "enums": ["queued"] }, { "dataType": "enum", "enums": ["processing"] }, { "dataType": "enum", "enums": ["completed"] }, { "dataType": "enum", "enums": ["failed"] }], "required": true },
            "progress": { "dataType": "string", "required": true },
            "displayMessage": { "dataType": "string", "required": true },
            "result": { "dataType": "any" },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AuthResponse": {
        "dataType": "refObject",
        "properties": {
            "user": { "dataType": "nestedObjectLiteral", "nestedProperties": { "role": { "dataType": "string", "required": true }, "name": { "dataType": "string", "required": true }, "email": { "dataType": "string", "required": true }, "id": { "dataType": "string", "required": true } }, "required": true },
            "token": { "dataType": "string" },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IngestResponse": {
        "dataType": "refObject",
        "properties": {
            "username": { "dataType": "string" },
            "password": { "dataType": "string" },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RegisterRequest": {
        "dataType": "refObject",
        "properties": {
            "email": { "dataType": "string", "required": true },
            "password": { "dataType": "string", "required": true },
            "name": { "dataType": "string", "required": true },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IngestResponse": {
        "dataType": "refObject",
        "properties": {
            "message": { "dataType": "string", "required": true },
            "chunks": { "dataType": "double", "required": true },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_string.any_": {
        "dataType": "refAlias",
        "type": { "dataType": "nestedObjectLiteral", "nestedProperties": {}, "additionalProperties": { "dataType": "any" }, "validators": {} },
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IngestRequest": {
        "dataType": "refObject",
        "properties": {
            "text": { "dataType": "string", "required": true },
            "metadata": { "ref": "Record_string.any_" },
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, { "noImplicitAdditionalProperties": "silently-remove-extras", "bodyCoercion": true });

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router, opts?: { multer?: ReturnType<typeof multer> }) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################

    const upload = opts?.multer || multer({ "limits": { "fileSize": 8388608 } });


    const argsSystemController_healthCheck: Record<string, TsoaRoute.ParameterSchema> = {
    };
    app.get('/api/system/health',
        ...(fetchMiddlewares<RequestHandler>(SystemController)),
        ...(fetchMiddlewares<RequestHandler>(SystemController.prototype.healthCheck)),

        async function SystemController_healthCheck(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSystemController_healthCheck, request, response });

                const controller = new SystemController();

                await templateService.apiHandler({
                    methodName: 'healthCheck',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsSettingsController_getProfile: Record<string, TsoaRoute.ParameterSchema> = {
    };
    app.get('/api/settings/profile',
        ...(fetchMiddlewares<RequestHandler>(SettingsController)),
        ...(fetchMiddlewares<RequestHandler>(SettingsController.prototype.getProfile)),

        async function SettingsController_getProfile(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSettingsController_getProfile, request, response });

                const controller = new SettingsController();

                await templateService.apiHandler({
                    methodName: 'getProfile',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsSettingsController_updateProfile: Record<string, TsoaRoute.ParameterSchema> = {
    };
    app.put('/api/settings/profile',
        ...(fetchMiddlewares<RequestHandler>(SettingsController)),
        ...(fetchMiddlewares<RequestHandler>(SettingsController.prototype.updateProfile)),

        async function SettingsController_updateProfile(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSettingsController_updateProfile, request, response });

                const controller = new SettingsController();

                await templateService.apiHandler({
                    methodName: 'updateProfile',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsMockController_test: Record<string, TsoaRoute.ParameterSchema> = {
    };
    app.get('/api/mock/test',
        ...(fetchMiddlewares<RequestHandler>(MockController)),
        ...(fetchMiddlewares<RequestHandler>(MockController.prototype.test)),

        async function MockController_test(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsMockController_test, request, response });

                const controller = new MockController();

                await templateService.apiHandler({
                    methodName: 'test',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsChatController_createChatTask: Record<string, TsoaRoute.ParameterSchema> = {
        body: { "in": "body", "name": "body", "required": true, "ref": "ChatRequest" },
    };
    app.post('/api/chat',
        ...(fetchMiddlewares<RequestHandler>(ChatController)),
        ...(fetchMiddlewares<RequestHandler>(ChatController.prototype.createChatTask)),

        async function ChatController_createChatTask(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsChatController_createChatTask, request, response });

                const controller = new ChatController();

                await templateService.apiHandler({
                    methodName: 'createChatTask',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsChatController_getChatStatus: Record<string, TsoaRoute.ParameterSchema> = {
        taskId: { "in": "path", "name": "taskId", "required": true, "dataType": "string" },
    };
    app.get('/api/chat/status/:taskId',
        ...(fetchMiddlewares<RequestHandler>(ChatController)),
        ...(fetchMiddlewares<RequestHandler>(ChatController.prototype.getChatStatus)),

        async function ChatController_getChatStatus(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsChatController_getChatStatus, request, response });

                const controller = new ChatController();

                await templateService.apiHandler({
                    methodName: 'getChatStatus',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsAuthController_login: Record<string, TsoaRoute.ParameterSchema> = {
        body: { "in": "body", "name": "body", "required": true, "ref": "LoginRequest" },
    };
    app.post('/api/auth/login',
        ...(fetchMiddlewares<RequestHandler>(AuthController)),
        ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.login)),

        async function AuthController_login(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_login, request, response });

                const controller = new AuthController();

                await templateService.apiHandler({
                    methodName: 'login',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsAuthController_register: Record<string, TsoaRoute.ParameterSchema> = {
    };
    app.post('/api/auth/register',
        ...(fetchMiddlewares<RequestHandler>(AuthController)),
        ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.register)),

        async function AuthController_register(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_register, request, response });

                const controller = new AuthController();

                await templateService.apiHandler({
                    methodName: 'register',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsAuthController_logout: Record<string, TsoaRoute.ParameterSchema> = {
    };
    app.post('/api/auth/logout',
        ...(fetchMiddlewares<RequestHandler>(AuthController)),
        ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.logout)),

        async function AuthController_logout(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_logout, request, response });

                const controller = new AuthController();

                await templateService.apiHandler({
                    methodName: 'logout',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsIngestController_ingestDocument: Record<string, TsoaRoute.ParameterSchema> = {
        body: { "in": "body", "name": "body", "required": true, "ref": "IngestRequest" },
    };
    app.post('/api/ingest',
        ...(fetchMiddlewares<RequestHandler>(IngestController)),
        ...(fetchMiddlewares<RequestHandler>(IngestController.prototype.ingestDocument)),

        async function IngestController_ingestDocument(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIngestController_ingestDocument, request, response });

                const controller = new IngestController();

                await templateService.apiHandler({
                    methodName: 'ingestDocument',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    const argsIngestController_uploadDocument: Record<string, TsoaRoute.ParameterSchema> = {
        file: { "in": "formData", "name": "file", "required": true, "dataType": "file" },
        source: { "in": "formData", "name": "source", "dataType": "string" },
    };
    app.post('/api/ingest/upload',
        upload.fields([
            {
                name: "file",
                maxCount: 1
            }
        ]),
        ...(fetchMiddlewares<RequestHandler>(IngestController)),
        ...(fetchMiddlewares<RequestHandler>(IngestController.prototype.uploadDocument)),

        async function IngestController_uploadDocument(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIngestController_uploadDocument, request, response });

                const controller = new IngestController();

                await templateService.apiHandler({
                    methodName: 'uploadDocument',
                    controller,
                    response,
                    next,
                    validatedArgs,
                    successStatus: undefined,
                });
            } catch (err) {
                return next(err);
            }
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
