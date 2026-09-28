import { Request, Response, NextFunction } from "express";
import { Payload } from "../models/interfaces/user/auth/Payload";
import { verify } from "jsonwebtoken"

export function isAuthenticated(request: Request, response: Response, next: NextFunction) {
    // Acessar token jwt
    const authToken = request.headers.authorization;

    if (!authToken) {
        return response.status(401).end();
    }

    const [, token] = authToken.split(" ");

    try {
        // Validar token
        const { sub } = verify(token, process.env.JWT_SECRET) as Payload;
        request.user_id = sub;
        return next(); // Deixa que a requisição prossiga

    } catch (error) {
        return response.send(401).end()
    }
}