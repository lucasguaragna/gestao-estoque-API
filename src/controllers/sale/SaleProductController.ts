import { Request, Response } from "express";
import { SaleProductRequest } from "../../models/interfaces/sale/SaleProductRequest";
import { SaleProductService } from "../../services/sale/SaleProductService";

class SaleProductController{

    async handle(request: Request, response: Response) {
        const product_id = request.query.product_id as string;
        const { amount }: SaleProductRequest = request.body;
        const saleProductService = new SaleProductService();
        const soldProduct = saleProductService.execute({ product_id, amount });
        return response.json(soldProduct)
    }
}

export { SaleProductController }