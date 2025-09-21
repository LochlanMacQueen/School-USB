
// Grab elements
const goBtn = document.getElementById('go');
const promptEl = document.getElementById('prompt');
const outEl = document.getElementById('out');
const modelEl = document.getElementById('model');
const statusEl = document.getElementById('status');

// Helper functions
function setStatus(msg) {
  statusEl.textContent = 'Status: ' + msg;
}
function setOut(msg){
  outEl.textContent = msg;
}
function appendOut(msg){
  outEl.textContent += msg;
}

// Load llm library
let webllm;
try {
  webllm = await import('https://unpkg.com/@mlc-ai/web-llm?module');
  setStatus('web-llm loaded (unpkg)');
} catch (e1) {
  try {
    webllm = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm');
    setStatus('web-llm loaded (jsdelivr)');
  } catch (e2) {
    setStatus('FAILED to load web-llm. Check your network / CDN blocks.');
    console.error('CDN load errors', e1, e2);
  }
}

if (navigator.gpu) {
  setStatus('WebGPU detected. Ready to load a model.');
} else {
  setStatus('No WebGPU detected. It may run slowly or fall back.');
}

// keep model running to avoid reloading each prompt
let engine = null;
let initializing = false;

// check if model is loaded
async function ensureInit() {
  if (engine || initializing) return;
  if (!webllm) throw new Error('web-llm not available');

  initializing = true;
  const modelId = modelEl.value; 
  setOut('');
  setStatus(`Loading ${modelId}… (first time downloads; later runs work offline)`);

  try {
    engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (p) => {
        const pct = Math.round((p?.progress ?? 0) * 100);
        setOut(`Loading: ${pct}%`);
      },
    });
    setStatus(`Loaded ${modelId}.`);
  } catch (err) {
    console.error(err);
    setOut('ERROR during model init: ' + (err?.message || err));
    setStatus('Model init failed. See console for details.');
  } finally {
    initializing = false;
  }
} 

//when run is clicked we load model
goBtn.addEventListener('click', async () => {
  try {
    await ensureInit();
    if (!engine) return;

    const q = (promptEl.value || '').trim();
    if (!q) {
      setOut('Type a prompt first');
      return;
    }
    setOut('Thinking...');

    // ask the engine to create a completion, and request it as a stream
    const stream = await engine.chat.completions.create({ 
      messages: [{ role: 'user', content: q}],
      stream: true,
      temperature: 0.7,
      max_tokens: 256,
    });
    setOut('');

    // read and append streamed chunks
    for await (const chunk of stream) {
      const t = chunk?.choices?.[0]?.delta?.content ?? '';
      appendOut(t);
    }
    appendOut('\n');
  } catch (err) {
    console.error(err);
    setOut('ERROR: ' + (err?.message || err));
    setStatus('Run failed. See console for details.');
  }
});
