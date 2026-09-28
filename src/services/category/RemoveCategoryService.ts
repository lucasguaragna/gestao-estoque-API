import { RemoveCategoryRequest } from "../../models/interfaces/category/RemoveCategoryRequest";
import prismaClient from "../../prisma";

class RemoveCategoryService {

    async execute({ category_id }: RemoveCategoryRequest) {    
        
        const category = await prismaClient.category.findFirst(
            {
                where: {
                    id: category_id
                }
            });
        
        if (!category) {
            throw new Error("Category not found");
        }

        if (category_id) {
            const category = await prismaClient.category.delete({
                where: {
                    id: category_id,
                }
            });

            return category;
        }
    }
}

export { RemoveCategoryService }