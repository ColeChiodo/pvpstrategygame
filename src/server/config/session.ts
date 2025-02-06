import type { Express, RequestHandler } from "express";
import flash from "express-flash";
import session from "express-session";

let sessionMiddleware: RequestHandler | undefined = undefined;
const MongoStore = require('connect-mongo');

const sessionSecret = process.env.SESSION_SECRET || 'defaultSecretKey';

export default function (app: Express): RequestHandler {
    if(sessionMiddleware === undefined) {
        sessionMiddleware = session({
            secret: sessionSecret,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
              mongoUrl: process.env.DATABASE_URL,
              ttl: 3 * 24 * 60 * 60, // Session expiry time (3 days)
            }),
            cookie: {
              secure: false,
              //sameSite: "none",
              maxAge: 1000 * 60 * 60 * 24,
            }
        });

        app.use(sessionMiddleware);
        app.use(flash());
    }
    
    return sessionMiddleware;
}