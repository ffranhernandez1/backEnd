
import express from "express"
import { engine } from "express-handlebars"
import { Server } from "socket.io"
import path from "path"
import mongoose from "mongoose"
import session from "express-session"
import MongoStore from "connect-mongo"
import passport from "passport"
import cookieParser from "cookie-parser"
import compression from "express-compression"
import swaggerJSDoc from "swagger-jsdoc"
import swaggerUiExpress from "swagger-ui-express"

import {viewsRouter} from "./Routes/view.router.js"
import { __dirname, authToken } from "./utils.js"
import {productsRouter} from "./Routes/products.router.js"
import {cartsRouter} from "./Routes/carts.router.js"
import {chatRouter} from "./Routes/chat.router.js"
import {sessionRouter} from "./Routes/session.router.js"
import {intializePassport} from "./config/passport.config.js"
import {configuration} from "./config.js"
import { ProductsRepository } from "./dao/repository/products.repository.js"
import { PRODUCTS_DAO } from "./dao/index.js"
import { ChatRepository } from "./dao/repository/chat.repository.js"
import { MESSAGES_DAO } from "./dao/index.js"
import { PRODUCTS_MODEL } from "./dao/mongo/models/products.js"
import { loggerRouter } from "./Routes/logger.router.js"
import { usersRouter } from "./Routes/users.router.js"
import { USER_DAO } from "./dao/index.js"
import { UsersRepository } from "./dao/repository/users.repository.js"
import { transport } from "./mailler/nodemailer.js"
import { paymentsRouter } from "./Routes/payment.router.js"

configuration()

const app = express()

app.use(compression({
    brotli: {enabled: true,zlib:{}}
}))

const PORT = process.env.PORT

const MONGO_URL = process.env.URL_MONGOOSE

mongoose.connect(MONGO_URL)

const ENVIRONMENT = process.env.ENVIRONMENT 


app.use(cookieParser("C0D3RS3CR3T"))
 

app.use(session({ 
    store : MongoStore.create({
        mongoUrl: MONGO_URL,
        mongoOptions: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
        ttl: 100
    }),
    secret: "coderSecret",
    resave: false,
    saveUninitialized: false
}))

intializePassport()
app.use(passport.initialize())
app.use(passport.session()) 

app.use(express.json())
app.use(express.urlencoded({extended : true}))

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, "./views"));

app.use(express.static("../public"))

const swaggerOptions = {
    definition: {
        openapi: "3.0.1" ,
        info: {   
            title: "Documentación",
            description: "Acciones de las rutas products y carts"
        }
    }, 
    apis: [`${__dirname}/docs/**/*.yaml`]
}

const specs = swaggerJSDoc(swaggerOptions) 

app.use("/products",productsRouter)
app.use("/carts",cartsRouter)
app.use("/views",authToken,viewsRouter) 
app.use("/chat",authToken,chatRouter)
app.use("/",sessionRouter)   
app.use("/loggerTest",loggerRouter) 
app.use("/api/users",usersRouter) 
app.use("/api/docs",swaggerUiExpress.serve, swaggerUiExpress.setup(specs))
app.use(paymentsRouter)

const server = app.listen(PORT,()=>{
    console.log("Escuchando desde el puerto " + PORT + " en modo " + ENVIRONMENT) 
})  
  
server.on("error",(err)=>{
    console.log(err)
})

const ioServer = new Server(server)

const productsService = new ProductsRepository(PRODUCTS_DAO)
const userService = new UsersRepository(USER_DAO)
const chatService = new ChatRepository(MESSAGES_DAO)

ioServer.on("connection", async (socket) => {
    console.log("Nueva conexión establecida"); 

    socket.on("disconnect",()=>{
        console.log("Usuario desconectado")
    })

      socket.on("new-product", async (data) => {
      const newProduct = await productsService.saveProduct(data) 

      const productos = process.env.PORT === "8080" ? await PRODUCTS_MODEL.find({}).lean({}) : await productsService.getProducts()
      socket.emit("update-products", productos)
    });

    socket.on("delete-product",async(data)=>{  
        let id = data;
        const product = await productsService.getProductById(id)
        const user = await userService.getUserByEmail(product.owner)
        if(user.role === "premium"){
            const result = await productsService.deleteProduct(id)
            await transport.sendMail({
                from: "Product deleted <coder123@gmail.com>", 
                to: user.email,
                subject: "User Product Deleted",
                headers: {
                    'Expiry-Date': new Date(Date.now() + 3600 * 1000).toUTCString()
                },
                html:`<h1>Tu producto ha sido eliminado</h1>`
               })
        }else{
            const result = await productsService.deleteProduct(pid)
        }

        const productos = process.env.PORT === "8080" ? await PRODUCTS_MODEL.find({}).lean({}) : await productsService.getProducts()
        socket.emit("update-products", productos)
    })

    const productos = process.env.PORT === "8080" ? await PRODUCTS_MODEL.find({}).lean({}) : await productsService.getProducts()
    socket.emit("update-products", productos)

    socket.on("guardar-mensaje",async(data)=>{
       await chatService.createMessage(data)
       const mensajes = await chatService.getMessages()
       socket.emit("enviar-mensajes",mensajes)
    })

    const mensajes = await chatService.getMessages()
    socket.emit("enviar-mensajes",mensajes)

    socket.on("Nuevos-mensajes",async(data)=>{

        const mensajes = await chatService.getMessages()
        socket.emit("enviar-mensajes",mensajes)
    })
});