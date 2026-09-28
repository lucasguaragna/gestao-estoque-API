import prismaClient from "../../prisma";

interface RemoveProductRequest {
    product_id: string;
}

class RemoveProductService {

    async execute({ product_id }: RemoveProductRequest) {
        if (!product_id) {
            throw new Error("Missing product_id!")
        }

        const removeProduct = await prismaClient.product.delete({
            where: {
                id: product_id
            },
        });

        return removeProduct;
    }
}

export {RemoveProductService}