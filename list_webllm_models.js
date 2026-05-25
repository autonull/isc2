import { prebuiltAppConfig } from '@mlc-ai/web-llm';
console.log(prebuiltAppConfig.model_list.map(m => m.model_id).filter(m => m.includes('TinyLlama') || m.includes('Qwen') || m.includes('Smol') || m.includes('1B') || m.includes('0.5B') || m.includes('gemma')));
