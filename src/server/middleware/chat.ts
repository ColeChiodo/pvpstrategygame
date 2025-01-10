import { NextFunction, Request, Response } from "express";

const chatMiddleware = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if(request.params.gameId !== undefined) {
        response.locals.roomId = request.params.gameId;
    } else {
        response.locals.roomId = 0;
    }

    next();
};

export default chatMiddleware;