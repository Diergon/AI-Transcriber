const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('NO_KEY');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(key, { apiVersion: 'v1' });
(async () => {
  try {
    const list = await genAI.models.list();
    console.log(JSON.stringify(list.models?.slice(0,20).map(m => ({name: m.name, supported: m.supportedGenerationMethods})), null, 2));
  } catch (e) {
    console.error('ERR', e.toString());
    process.exit(2);
  }
})();
