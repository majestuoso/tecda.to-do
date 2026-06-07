// backend/src/index.ts
import { PrismaClient } from '@prisma/client';
import express from 'express';
const app = express();
const prisma = new PrismaClient();
app.use(express.json());
app.get('/', async (req, res) => {
    res.json({ message: "Servidor operativo" });
});
app.listen(5000, () => {
    console.log('🚀 Servidor en puerto 5000');
});
//# sourceMappingURL=index.js.map