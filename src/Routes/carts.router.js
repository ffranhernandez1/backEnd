import { Router } from "express";
import { createCart, getCartById, saveProductInCart, updateCart, updateQuantityProductInCart, deleteProductInCart, deleteProductsInCart, purchaseProducts} from "../Controller/carrito.controller.js"

const cartsRouter = Router()


cartsRouter.post("/",createCart)

cartsRouter.get("/:cid",getCartById)

cartsRouter.post("/:cid/product/:pid",saveProductInCart)

cartsRouter.delete("/:cid/products/:pid",deleteProductInCart)

cartsRouter.put("/:cid",updateCart)

cartsRouter.put("/:cid/products/:pid",updateQuantityProductInCart)

cartsRouter.delete("/:cid",deleteProductsInCart)

cartsRouter.post("/:cid/purchase",purchaseProducts)

export {cartsRouter}