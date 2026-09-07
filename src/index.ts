import 'dotenv/config';
import app from './app';

if (require.main === module) {
  const port = Number(process.env.PORT ?? 4008);
  app.listen(port, () => console.log(`Server listening on port ${port}`));
}
