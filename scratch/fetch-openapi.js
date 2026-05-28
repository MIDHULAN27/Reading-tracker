import axios from 'axios';

const url = 'https://omkgbynqmndlbjpyigbn.supabase.co/rest/v1/';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta2dieW5xbW5kbGJqcHlpZ2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MjY5NDksImV4cCI6MjA5NTAwMjk0OX0._Rx0xZ9ubWY3atgRXMQGqLTKdaUoMH-XNDWy3LXEP_8';

async function main() {
  try {
    const response = await axios.get(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log("PostgREST Schema Keys:", Object.keys(response.data.paths || {}));
    console.log("Definitions Keys:", Object.keys(response.data.definitions || {}));
  } catch (err) {
    console.error("Failed to fetch schema:", err.message);
  }
}

main();
