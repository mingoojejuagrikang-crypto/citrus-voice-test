import { defineConfig } from 'vite';
import transformersPkg from './node_modules/@huggingface/transformers/package.json' with { type: 'json' };

export default defineConfig({
  root: 'app',
  base: './',
  define: {
    __TRANSFORMERS_VERSION__: JSON.stringify(transformersPkg.version),
  },
  build: {
    outDir: '../dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'app/index.html',
        benchmark: 'app/benchmark.html',
      },
    },
  },
});
