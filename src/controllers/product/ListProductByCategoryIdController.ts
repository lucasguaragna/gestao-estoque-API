import { Request, Response } from "express";
import { ListProductByCategoryIdService } from "../../services/product/ListProductByCategoryIdService";

class ListProductByCategoryIdController {

    async handle(request: Request, response: Response) {
        const category_id = request.query.category_id as string;
        const listProductsByCagetoryIdService = new ListProductByCategoryIdService();
        const products = await listProductsByCagetoryIdService.execute({ category_id });
        return response.json({ products });
    }
}

export {ListProductByCategoryIdController}