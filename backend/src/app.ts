import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*', // Habilitado para desenvolvimento local, ajustar para prod depois
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());

import patientsRouter from './routes/patients.js';
import appointmentsRouter from './routes/appointments.js';
import clinicFlowRouter from './routes/clinicFlow.js';
import transactionsRouter from './routes/transactions.js';
import proceduresRouter from './routes/procedures.js';
import profilesRouter from './routes/profiles.js';
import unitsRouter from './routes/units.js';
import inventoryRouter from './routes/inventory.js';
import fixedCostsRouter from './routes/fixedCosts.js';
import bomRouter from './routes/bom.js';
import reportsRouter from './routes/reports.js';

// Rota de status de saúde
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Rotas da API
app.use('/api/patients', patientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/clinic-flow', clinicFlowRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/procedures', proceduresRouter);
app.use('/api/procedures', bomRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/units', unitsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/fixed-costs', fixedCostsRouter);
app.use('/api/reports', reportsRouter);

// Tratamento de rotas não encontradas
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Tratamento global de erros
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

export default app;
