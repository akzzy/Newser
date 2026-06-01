async function start() {
  try {
    await import('./src/app.js');
  } catch (err) {
    console.error("Failed to load ES Module:", err);
  }
}
start();
