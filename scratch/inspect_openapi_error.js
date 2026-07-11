import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/';
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  console.log("URL:", url);
  console.log("Key:", key ? key.substring(0, 10) + '...' : 'none');
  try {
    const response = await axios.get(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log("OK:", response.status);
  } catch (err) {
    console.error("Error status:", err.response ? err.response.status : 'no response');
    console.error("Error headers:", err.response ? err.response.headers : 'no response');
    console.error("Error data:", err.response ? err.response.data : 'no response');
  }
}

main();
