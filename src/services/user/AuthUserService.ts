import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AuthRequest } from "../../models/interfaces/user/auth/AuthRequest";
import prismaClient from "../../prisma";

class AuthUserService {
    async execute({ email, password }: AuthRequest) {
        if (!email) {
            throw new Error("We need your e-mail!")
        }

        if (!password) {
            throw new Error("We need your password!")
        }

        // Verificar no banco de dados se existe um usuário com o e-mail passado
        const user = await prismaClient.user.findFirst({
            where: {
                email: email
            }
        });

        if (!user) {
            throw new Error("Wrong username or passord!")
        }

        // Verificar se a senha está correta
        const passwordMatch = await compare(password, user?.password)

        if (!passwordMatch) {
            throw new Error("Wrong password!")
        }

        const token = sign(
            {
                name: user?.name,
                email: user?.email
            },
            process.env.JWT_SECRET as string,
            {
                subject: user?.id,
                expiresIn: "30d"
            }
        );

        return {
            id: user?.id,
            name: user?.name,
            email: user?.email,
            token: token
        }
    }
}

export {AuthUserService}