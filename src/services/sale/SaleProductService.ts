import prismaClient from "../../prisma";
import { SaleProductRequest } from "../../models/interfaces/sale/SaleProductRequest";

class SaleProductService {

    async execute({ product_id, amount }: SaleProductRequest) {
        
        if (!product_id || !amount) {
            throw new Error("Missing product_id or amount")
        }

        const soldProduct = await prismaClient.product.findFirst({
            where: {
                id: product_id
            },
        });

        if (soldProduct?.amount > amount && amount > 0) {
            const newAmount = (soldProduct?.amount - amount);
            const saveSale = await prismaClient.product.update({
                where: {
                    id: product_id
                },
                data: {
                    amount: newAmount
                },
                select: {
                    id: true,
                    name: true,
                    amount: true
                }
            });

            return saveSale;
        } else {
            throw new Error("Sale can not be done!")
        }
    }
}

export { SaleProductService}